/**
 * Recepción — registro de visitantes.
 * Archivo: visitors.json
 *
 * Cada visita:
 *  { id, cedula, fullName, category, host, purpose, notes,
 *    checkInAt, checkOutAt, createdBy, updatedAt }
 *
 * Categorías: cliente_corporativo | cliente_residencial | solicitante_empleo
 *             familiar_amigo | ex_empleado | proveedor | otro
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();
const FILE = 'visitors.json';

const CATEGORIES = [
  'cliente_corporativo',
  'cliente_residencial',
  'solicitante_empleo',
  'familiar_amigo',
  'ex_empleado',
  'proveedor',
  'otro',
];

function normalizeCedula(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D+/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
  return String(raw).trim();
}

router.use(auth);

// Lista con filtros ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=in|out|all
router.get('/', (req, res) => {
  try {
    const all = readData(FILE) || [];
    const { from, to, status = 'all', category } = req.query;
    let list = [...all];
    if (from) list = list.filter((v) => (v.checkInAt || '') >= from);
    if (to) list = list.filter((v) => (v.checkInAt || '') <= `${to}T23:59:59`);
    if (category) list = list.filter((v) => v.category === category);
    if (status === 'in') list = list.filter((v) => !v.checkOutAt);
    if (status === 'out') list = list.filter((v) => !!v.checkOutAt);
    list.sort((a, b) => (b.checkInAt || '').localeCompare(a.checkInAt || ''));
    res.json(list);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Crear (check-in)
router.post('/', (req, res) => {
  try {
    const { cedula, fullName, category, host, purpose, notes, photoUrl } = req.body || {};
    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ message: 'Nombre completo requerido' });
    }
    if (!category || !CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'Categoría inválida' });
    }
    const all = readData(FILE) || [];
    const visit = {
      id: generateId('VIS'),
      cedula: normalizeCedula(cedula),
      fullName: String(fullName).trim(),
      category,
      host: host || '',
      purpose: purpose || '',
      notes: notes || '',
      photoUrl: photoUrl || '',
      checkInAt: new Date().toISOString(),
      checkOutAt: null,
      createdBy: req.user?.fullName || req.user?.email || 'Recepción',
      updatedAt: new Date().toISOString(),
    };
    all.push(visit);
    writeData(FILE, all);
    res.status(201).json(visit);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Check-out
router.post('/:id/checkout', (req, res) => {
  try {
    const all = readData(FILE) || [];
    const idx = all.findIndex((v) => v.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Visita no encontrada' });
    all[idx].checkOutAt = new Date().toISOString();
    all[idx].updatedAt = all[idx].checkOutAt;
    writeData(FILE, all);
    res.json(all[idx]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Editar
router.put('/:id', (req, res) => {
  try {
    const all = readData(FILE) || [];
    const idx = all.findIndex((v) => v.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Visita no encontrada' });
    const patch = req.body || {};
    if (patch.category && !CATEGORIES.includes(patch.category)) {
      return res.status(400).json({ message: 'Categoría inválida' });
    }
    if (patch.cedula) patch.cedula = normalizeCedula(patch.cedula);
    all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
    writeData(FILE, all);
    res.json(all[idx]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Eliminar
router.delete('/:id', (req, res) => {
  try {
    const all = readData(FILE) || [];
    const next = all.filter((v) => v.id !== req.params.id);
    writeData(FILE, next);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Estadísticas simples ?from=&to=
router.get('/stats/summary', (req, res) => {
  try {
    const all = readData(FILE) || [];
    const { from, to } = req.query;
    let list = [...all];
    if (from) list = list.filter((v) => (v.checkInAt || '') >= from);
    if (to) list = list.filter((v) => (v.checkInAt || '') <= `${to}T23:59:59`);
    const byCategory = {};
    CATEGORIES.forEach((c) => { byCategory[c] = 0; });
    const byDay = {};
    let currentlyIn = 0;
    list.forEach((v) => {
      byCategory[v.category] = (byCategory[v.category] || 0) + 1;
      const day = (v.checkInAt || '').slice(0, 10);
      if (day) byDay[day] = (byDay[day] || 0) + 1;
      if (!v.checkOutAt) currentlyIn += 1;
    });
    res.json({ total: list.length, currentlyIn, byCategory, byDay, categories: CATEGORIES });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
module.exports.CATEGORIES = CATEGORIES;
