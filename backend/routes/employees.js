/**
 * Employees directory (HR-managed)
 * File: employees.json
 * Seeded from employeesSeed.json, editable by HR and admins.
 */
const express = require('express');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');
const SEED = require('../helpers/employeesSeed.json');

const FILE = 'employees.json';
const router = express.Router();

// Versión del seed: incrementar cuando se actualice employeesSeed.json
// para forzar refresco del archivo persistido sin perder ediciones manuales.
const SEED_VERSION = 'v2-2026-04';
const META_FILE = 'employees.meta.json';

function load() {
  const raw = readData(FILE);
  const meta = readData(META_FILE);
  const currentVersion = (meta && !Array.isArray(meta) && meta.seedVersion) || null;
  const isEmpty = !Array.isArray(raw) || raw.length === 0;
  const versionChanged = currentVersion !== SEED_VERSION;

  if (isEmpty || versionChanged) {
    // Merge: conservar ediciones por employeeCode si existían
    const existing = Array.isArray(raw) ? raw : [];
    const byCode = new Map(existing.map(e => [String(e.employeeCode), e]));
    const merged = SEED.map(s => {
      const prev = byCode.get(String(s.employeeCode));
      // Si el usuario editó manualmente, mantener su versión pero garantizar campos del seed
      return prev ? { ...s, ...prev } : s;
    });
    // Mantener empleados creados manualmente (no presentes en seed)
    const seedCodes = new Set(SEED.map(s => String(s.employeeCode)));
    existing.forEach(e => {
      if (!seedCodes.has(String(e.employeeCode))) merged.push(e);
    });
    writeData(FILE, merged);
    writeData(META_FILE, { seedVersion: SEED_VERSION, seededAt: new Date().toISOString(), count: merged.length });
    return merged;
  }
  return raw;
}

// GET /api/employees
router.get('/', auth, (req, res) => {
  const list = load();
  if (req.query.department) {
    return res.json(list.filter(e => e.department === req.query.department));
  }
  if (req.query.status) {
    return res.json(list.filter(e => e.status === req.query.status));
  }
  res.json(list);
});

// GET /api/employees/stats
router.get('/stats', auth, (req, res) => {
  const list = load().filter(e => e.status === 'Activo');
  const byDept = {};
  const byPayroll = {};
  list.forEach(e => {
    byDept[e.department] = (byDept[e.department] || 0) + 1;
    byPayroll[e.payrollType] = (byPayroll[e.payrollType] || 0) + 1;
  });
  res.json({ total: list.length, byDepartment: byDept, byPayrollType: byPayroll });
});

// GET /api/employees/:code
router.get('/:code', auth, (req, res) => {
  const emp = load().find(e => e.employeeCode === req.params.code);
  if (!emp) return res.status(404).json({ message: 'Empleado no encontrado' });
  res.json(emp);
});

// PUT /api/employees/:code — update (HR/Admin only)
router.put('/:code', auth, (req, res) => {
  if (!req.user?.isAdmin && req.user?.department !== 'Recursos Humanos') {
    return res.status(403).json({ message: 'No autorizado' });
  }
  const list = load();
  const idx = list.findIndex(e => e.employeeCode === req.params.code);
  if (idx === -1) return res.status(404).json({ message: 'Empleado no encontrado' });
  list[idx] = { ...list[idx], ...req.body, employeeCode: req.params.code, updatedAt: new Date().toISOString() };
  writeData(FILE, list);
  res.json(list[idx]);
});

// POST /api/employees — add new employee (HR/Admin only)
router.post('/', auth, (req, res) => {
  if (!req.user?.isAdmin && req.user?.department !== 'Recursos Humanos') {
    return res.status(403).json({ message: 'No autorizado' });
  }
  const list = load();
  const emp = { ...req.body, createdAt: new Date().toISOString() };
  if (!emp.employeeCode) {
    const max = Math.max(0, ...list.map(e => parseInt(e.employeeCode) || 0));
    emp.employeeCode = String(max + 1);
  }
  list.push(emp);
  writeData(FILE, list);
  res.status(201).json(emp);
});

// DELETE /api/employees/:code (HR/Admin only)
router.delete('/:code', auth, (req, res) => {
  if (!req.user?.isAdmin && req.user?.department !== 'Recursos Humanos') {
    return res.status(403).json({ message: 'No autorizado' });
  }
  const list = load();
  const idx = list.findIndex(e => e.employeeCode === req.params.code);
  if (idx === -1) return res.status(404).json({ message: 'Empleado no encontrado' });
  list.splice(idx, 1);
  writeData(FILE, list);
  res.status(204).send();
});

module.exports = router;
