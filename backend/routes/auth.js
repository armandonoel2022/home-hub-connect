const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();
const USERS_FILE = 'users.json';

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

    const token = jwt.sign(
      { id: user.id, email: user.email, isAdmin: !!user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({ token, user: mapUser(user) });
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
  users[idx].passwordHash = await bcrypt.hash(newPassword, 10);
  users[idx].updatedAt = new Date().toISOString();
  writeData(USERS_FILE, users);

  res.json({ message: 'Contraseña actualizada' });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => res.status(204).send());

module.exports = router;
