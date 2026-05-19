/**
 * Payroll extras — horas extras, horas nocturnas, días feriados, y descuentos por almuerzo.
 * Registrados por líderes/supervisores y consolidados en la nómina del período.
 *
 * Archivos: payroll-extras.json
 * Entrada típica:
 *   {
 *     id, employeeCode, employeeName, type: 'overtime'|'night'|'holiday'|'meal',
 *     date: 'YYYY-MM-DD', hours?: number, days?: number, amount?: number,
 *     description?: string, registeredBy, registeredAt,
 *     status: 'Pendiente RRHH'|'Procesada', payrollRunId?: string
 *   }
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const FILE = 'payroll-extras.json';
const router = express.Router();

function load() {
  const r = readData(FILE);
  return Array.isArray(r) ? r : [];
}

// GET /api/payroll-extras?employeeCode=&period=YYYY-MM&status=
router.get('/', auth, (req, res) => {
  let list = load();
  const { employeeCode, period, status, type } = req.query;
  if (employeeCode) list = list.filter(x => x.employeeCode === employeeCode);
  if (status) list = list.filter(x => x.status === status);
  if (type) list = list.filter(x => x.type === type);
  if (period) list = list.filter(x => (x.date || '').startsWith(period));
  res.json(list);
});

// POST /api/payroll-extras  (líderes y RRHH/admin)
router.post('/', auth, (req, res) => {
  const list = load();
  const entry = {
    id: generateId('EXT', list),
    employeeCode: String(req.body.employeeCode || ''),
    employeeName: req.body.employeeName || '',
    type: req.body.type,
    date: req.body.date,
    hours: Number(req.body.hours) || 0,
    days: Number(req.body.days) || 0,
    amount: Number(req.body.amount) || 0,
    description: req.body.description || '',
    registeredBy: req.user?.fullName || req.user?.email || 'Sistema',
    registeredById: req.user?.id || '',
    registeredAt: new Date().toISOString(),
    status: 'Pendiente RRHH',
  };
  if (!entry.employeeCode || !entry.type || !entry.date) {
    return res.status(400).json({ message: 'employeeCode, type y date son requeridos' });
  }
  list.unshift(entry);
  writeData(FILE, list);
  res.status(201).json(entry);
});

// PUT /api/payroll-extras/:id  (solo RRHH/admin)
router.put('/:id', auth, (req, res) => {
  if (!req.user?.isAdmin && req.user?.department !== 'Recursos Humanos') {
    return res.status(403).json({ message: 'No autorizado' });
  }
  const list = load();
  const idx = list.findIndex(x => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ message: 'No encontrado' });
  list[idx] = { ...list[idx], ...req.body, id: list[idx].id };
  writeData(FILE, list);
  res.json(list[idx]);
});

// DELETE
router.delete('/:id', auth, (req, res) => {
  const list = load();
  const idx = list.findIndex(x => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ message: 'No encontrado' });
  // El registrante o RRHH/admin pueden borrar si está pendiente
  const entry = list[idx];
  const isOwner = entry.registeredById === req.user?.id;
  const isHR = req.user?.isAdmin || req.user?.department === 'Recursos Humanos';
  if (entry.status !== 'Pendiente RRHH' && !isHR) {
    return res.status(403).json({ message: 'Solo RRHH puede eliminar entradas ya procesadas' });
  }
  if (!isOwner && !isHR) return res.status(403).json({ message: 'No autorizado' });
  list.splice(idx, 1);
  writeData(FILE, list);
  res.status(204).end();
});

module.exports = router;
