/**
 * Solicitudes de RRHH (vacaciones, comida, ausencias, permisos, préstamos, días libres)
 * Almacenamiento:
 *  - hr-requests.json        (array completo de HRRequest)
 *  - hr-notifications.json   (array completo de HRNotification)
 *
 * Toda la lógica de flujo vive en el cliente (hrRequestService.ts).
 * Este router solo persiste el estado para que sea compartido entre usuarios.
 */
const express = require('express');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();
const FILE = 'hr-requests.json';
const NOTIF_FILE = 'hr-notifications.json';

// ─── Requests ───
router.get('/', auth, (req, res) => {
  res.json(readData(FILE));
});

// Reemplazo completo (write-through del cliente).
router.put('/', auth, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ message: 'Se esperaba un array' });
  writeData(FILE, req.body);
  res.json({ ok: true, count: req.body.length });
});

// Upsert/replace de un solo registro.
router.put('/:id', auth, (req, res) => {
  const list = readData(FILE);
  const idx = list.findIndex(r => r.id === req.params.id);
  if (idx === -1) list.unshift(req.body);
  else list[idx] = { ...list[idx], ...req.body };
  writeData(FILE, list);
  res.json(req.body);
});

router.post('/', auth, (req, res) => {
  const list = readData(FILE);
  list.unshift(req.body);
  writeData(FILE, list);
  res.status(201).json(req.body);
});

router.delete('/:id', auth, (req, res) => {
  const list = readData(FILE).filter(r => r.id !== req.params.id);
  writeData(FILE, list);
  res.status(204).send();
});

// ─── Notificaciones ───
router.get('/notifications/all', auth, (req, res) => {
  res.json(readData(NOTIF_FILE));
});

router.put('/notifications/all', auth, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ message: 'Se esperaba un array' });
  writeData(NOTIF_FILE, req.body);
  res.json({ ok: true, count: req.body.length });
});

module.exports = router;
