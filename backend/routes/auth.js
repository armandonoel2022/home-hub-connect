const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();
const USERS_FILE = 'users.json';
const TICKETS_FILE = 'tickets.json';
const PASSWORD_RESET_FILE = 'password-reset-requests.json';

function mapUser(u) {
  const { PasswordHash, passwordHash, ...safe } = u;
  return safe;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = readData(USERS_FILE);

    const user = users.find(u =>
      u.email && u.email.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    // Check password
    if (user.passwordHash) {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    } else {
      // Default password for users without hash
      if (password.toLowerCase() !== 'safeone') {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
      }
    }

    // Determine if user must change password
    // mustChangePassword is true if: no custom passwordHash (still using default), or flag is explicitly set
    const mustChangePassword = !user.passwordHash || !!user.mustChangePassword;

    const token = jwt.sign(
      { id: user.id, email: user.email, isAdmin: !!user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({ token, user: mapUser(user), mustChangePassword });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  const users = readData(USERS_FILE);
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json(mapUser(user));
});

// POST /api/auth/refresh
router.post('/refresh', auth, (req, res) => {
  const token = jwt.sign(
    { id: req.user.id, email: req.user.email, isAdmin: req.user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  res.json({ token });
});

// POST /api/auth/change-password
router.post('/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  const users = readData(USERS_FILE);
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ message: 'Usuario no encontrado' });

  const user = users[idx];
  
  // Verify current password
  if (user.passwordHash) {
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Contraseña actual incorrecta' });
  } else {
    if (currentPassword.toLowerCase() !== 'safeone') {
      return res.status(401).json({ message: 'Contraseña actual incorrecta' });
    }
  }

  // Hash new password
  users[idx].passwordHash = await bcrypt.hash(newPassword, 12);
  users[idx].mustChangePassword = false;
  users[idx].updatedAt = new Date().toISOString();
  writeData(USERS_FILE, users);

  res.json({ message: 'Contraseña actualizada' });
});

// POST /api/auth/forgot-password — creates a password reset request + IT ticket
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, fullName } = req.body;
    if (!email) return res.status(400).json({ message: 'Correo requerido' });

    const users = readData(USERS_FILE);
    const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      // Don't reveal if user exists
      return res.json({ message: 'Si el correo existe, se ha enviado la solicitud al administrador' });
    }

    // Create password reset request
    const requests = readData(PASSWORD_RESET_FILE);
    const resetReq = {
      id: generateId('RST', requests),
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      department: user.department,
      status: 'pending', // pending | completed
      requestedAt: new Date().toISOString(),
      completedAt: null,
      completedBy: null,
    };
    requests.push(resetReq);
    writeData(PASSWORD_RESET_FILE, requests);

    // Also create an IT ticket
    const tickets = readData(TICKETS_FILE);
    const ticket = {
      id: generateId('TK', tickets),
      title: `Solicitud de restablecimiento de contraseña - ${user.fullName}`,
      description: `El usuario ${user.fullName} (${user.email}) del departamento ${user.department} ha solicitado restablecer su contraseña. Por favor asistir desde Gestión de Usuarios.`,
      category: 'Otros',
      priority: 'Alta',
      status: 'Abierto',
      createdBy: fullName || user.fullName,
      createdById: user.id,
      assignedTo: 'Tecnología y Monitoreo',
      assignedToId: 'USR-001',
      department: user.department,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slaHours: 8,
      slaDeadline: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      attachments: [],
      comments: [],
      resetRequestId: resetReq.id,
    };
    tickets.push(ticket);
    writeData(TICKETS_FILE, tickets);

    res.json({ message: 'Solicitud enviada. El administrador de IT te asistirá para restablecer tu contraseña.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// GET /api/auth/password-reset-requests — admin only
router.get('/password-reset-requests', auth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ message: 'No autorizado' });
  const requests = readData(PASSWORD_RESET_FILE);
  res.json(requests);
});

// POST /api/auth/admin-reset-password/:userId — admin resets user password
router.post('/admin-reset-password/:userId', auth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ message: 'No autorizado' });

  const { tempPassword } = req.body;
  if (!tempPassword || tempPassword.length < 8) {
    return res.status(400).json({ message: 'La contraseña temporal debe tener al menos 8 caracteres' });
  }

  const users = readData(USERS_FILE);
  const idx = users.findIndex(u => u.id === req.params.userId);
  if (idx === -1) return res.status(404).json({ message: 'Usuario no encontrado' });

  users[idx].passwordHash = await bcrypt.hash(tempPassword, 12);
  users[idx].mustChangePassword = true; // Force change on next login
  users[idx].updatedAt = new Date().toISOString();
  writeData(USERS_FILE, users);

  // Mark any pending reset requests as completed
  const requests = readData(PASSWORD_RESET_FILE);
  let changed = false;
  requests.forEach(r => {
    if (r.userId === req.params.userId && r.status === 'pending') {
      r.status = 'completed';
      r.completedAt = new Date().toISOString();
      r.completedBy = req.user.id;
      changed = true;
    }
  });
  if (changed) writeData(PASSWORD_RESET_FILE, requests);

  res.json({ message: `Contraseña restablecida para ${users[idx].fullName}. Deberá cambiarla en su próximo inicio de sesión.` });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => res.status(204).send());

module.exports = router;
