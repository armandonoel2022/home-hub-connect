const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../config/database');
const auth = require('../middleware/auth');
const { mapUser } = require('../helpers/mappers');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = getPool();

    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT * FROM IntranetUsuarios WHERE LOWER(Email) = LOWER(@email)');

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    const user = result.recordset[0];

    // Si tiene PasswordHash, verificar con bcrypt
    if (user.PasswordHash) {
      const valid = await bcrypt.compare(password, user.PasswordHash);
      if (!valid) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    } else {
      // Fallback temporal para migración (contraseña = "safeone")
      if (password.toLowerCase() !== 'safeone') {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
      }
    }

    const token = jwt.sign(
      { id: user.Id, email: user.Email, isAdmin: !!user.IsAdmin },
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
router.get('/me', auth, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, req.user.id)
      .query('SELECT * FROM IntranetUsuarios WHERE Id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(mapUser(result.recordset[0]));
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', auth, async (req, res) => {
  const token = jwt.sign(
    { id: req.user.id, email: req.user.email, isAdmin: req.user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  res.json({ token });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => res.status(204).send());

module.exports = router;
