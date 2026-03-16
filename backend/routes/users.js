const express = require('express');
const bcrypt = require('bcryptjs');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();
const FILE = 'users.json';

function mapUser(u) {
  const { PasswordHash, passwordHash, ...safe } = u;
  return safe;
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
