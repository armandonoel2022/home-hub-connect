const express = require('express');
const bcrypt = require('bcryptjs');
const { readData, writeData, generateId } = require('../config/database');
const { saveFile } = require('../config/fileStorage');
const auth = require('../middleware/auth');

const router = express.Router();
const FILE = 'users.json';
const BIRTHDAY_OVERRIDES_FILE = 'birthday-photo-overrides.json';
const BIRTHDAY_PHOTO_ADMIN = 'anoel@safeone.com.do';

function mapUser(u) {
  const { PasswordHash, passwordHash, ...safe } = u;
  return safe;
}

function normalizeName(value = '') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function canManageBirthdayPhoto(req) {
  return String(req.user?.email || '').toLowerCase() === BIRTHDAY_PHOTO_ADMIN;
}

function readBirthdayOverrides() {
  const data = readData(BIRTHDAY_OVERRIDES_FILE);
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

function findBrandonUser(users) {
  return users.find(u => normalizeName(u.fullName).startsWith('brandon diaz'));
}

// GET /api/users
router.get('/', auth, (req, res) => {
  const users = readData(FILE);
  res.json(users.map(mapUser));
});

// GET /api/users/birthdays/today
router.get('/birthdays/today', auth, (req, res) => {
  const today = new Date();
  const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const users = readData(FILE);
  const bdays = users.filter(u => u.birthday === mmdd && u.employeeStatus !== 'Inactivo');
  res.json(bdays.map(mapUser));
});

// GET /api/users/birthday-photo-overrides — read fixed birthday-overlay photos
router.get('/birthday-photo-overrides', auth, (req, res) => {
  res.json(readBirthdayOverrides());
});

// PUT /api/users/birthday-photo-overrides/brandon — Armando-only fixed photo for Brandon's birthday overlay
router.put('/birthday-photo-overrides/brandon', auth, (req, res) => {
  if (!canManageBirthdayPhoto(req)) return res.status(403).json({ message: 'No autorizado' });

  const { photoDataUrl, fileName = 'brandon-cumpleanos.jpg' } = req.body || {};
  if (!photoDataUrl || typeof photoDataUrl !== 'string' || !photoDataUrl.startsWith('data:image/')) {
    return res.status(400).json({ message: 'Foto inválida' });
  }

  const ext = photoDataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
  const safeBase = String(fileName).replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 50) || 'brandon-cumpleanos';
  const storedName = `${safeBase}-${Date.now()}.${ext}`;
  saveFile('birthdays', storedName, photoDataUrl);

  const users = readData(FILE);
  const brandon = findBrandonUser(users);
  const url = `/uploads/birthdays/${storedName}`;
  const overrides = readBirthdayOverrides();
  overrides.brandon = {
    userId: brandon?.id || 'USR-120',
    fullName: brandon?.fullName || 'Brandon Díaz',
    photoUrl: url,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.id,
    updatedByEmail: req.user.email,
  };
  writeData(BIRTHDAY_OVERRIDES_FILE, overrides);

  res.json(overrides.brandon);
});

// GET /api/users/:id
router.get('/:id', auth, (req, res) => {
  const users = readData(FILE);
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json(mapUser(user));
});

// POST /api/users
router.post('/', auth, async (req, res) => {
  const users = readData(FILE);
  const newUser = {
    ...req.body,
    id: req.body.id || generateId('USR', users),
    employeeStatus: 'Activo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (req.body.password) {
    newUser.passwordHash = await bcrypt.hash(req.body.password, 10);
    delete newUser.password;
  }
  users.push(newUser);
  writeData(FILE, users);
  res.status(201).json(mapUser(newUser));
});

// PUT /api/users/:id
router.put('/:id', auth, async (req, res) => {
  const users = readData(FILE);
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Usuario no encontrado' });
  const data = { ...req.body };
  if (data.password) {
    data.passwordHash = await bcrypt.hash(data.password, 10);
    delete data.password;
  }
  users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
  writeData(FILE, users);
  res.json(mapUser(users[idx]));
});

// DELETE /api/users/:id
router.delete('/:id', auth, (req, res) => {
  let users = readData(FILE);
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Usuario no encontrado' });
  users.splice(idx, 1);
  writeData(FILE, users);
  res.status(204).send();
});

// POST /api/users/:id/offboard
router.post('/:id/offboard', auth, (req, res) => {
  const users = readData(FILE);
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Usuario no encontrado' });
  users[idx] = {
    ...users[idx],
    employeeStatus: 'Inactivo',
    offboardingDate: new Date().toISOString(),
    offboardingReason: req.body.reason,
    offboardingNotes: req.body.notes,
    offboardingBy: req.user.id,
    updatedAt: new Date().toISOString(),
  };
  writeData(FILE, users);
  res.json(mapUser(users[idx]));
});

// POST /api/users/:id/reactivate
router.post('/:id/reactivate', auth, (req, res) => {
  const users = readData(FILE);
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Usuario no encontrado' });
  users[idx] = {
    ...users[idx],
    employeeStatus: 'Activo',
    offboardingDate: null,
    offboardingReason: null,
    offboardingNotes: null,
    offboardingBy: null,
    updatedAt: new Date().toISOString(),
  };
  writeData(FILE, users);
  res.json(mapUser(users[idx]));
});

module.exports = router;
