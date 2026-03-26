const express = require('express');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/kpis/objectives
router.get('/objectives', auth, (req, res) => {
  const objectives = readData('basc-objectives.json');
  res.json(objectives);
});

// PUT /api/kpis/objectives/:id
router.put('/objectives/:id', auth, (req, res) => {
  const objectives = readData('basc-objectives.json');
  const idx = objectives.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Objetivo no encontrado' });
  objectives[idx] = { ...objectives[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeData('basc-objectives.json', objectives);
  res.json(objectives[idx]);
});

// PUT /api/kpis/objectives (bulk save)
router.put('/objectives', auth, (req, res) => {
  writeData('basc-objectives.json', req.body);
  res.json(req.body);
});

// GET /api/kpis/department
router.get('/department', auth, (req, res) => {
  const kpis = readData('department-kpis.json');
  res.json(kpis);
});

// POST /api/kpis/department
router.post('/department', auth, (req, res) => {
  const kpis = readData('department-kpis.json');
  const newKPI = { ...req.body, createdAt: new Date().toISOString() };
  kpis.push(newKPI);
  writeData('department-kpis.json', kpis);
  res.status(201).json(newKPI);
});

// PUT /api/kpis/department/:id
router.put('/department/:id', auth, (req, res) => {
  const kpis = readData('department-kpis.json');
  const idx = kpis.findIndex(k => k.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'KPI no encontrado' });
  kpis[idx] = { ...kpis[idx], ...req.body };
  writeData('department-kpis.json', kpis);
  res.json(kpis[idx]);
});

// DELETE /api/kpis/department/:id
router.delete('/department/:id', auth, (req, res) => {
  let kpis = readData('department-kpis.json');
  const idx = kpis.findIndex(k => k.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'KPI no encontrado' });
  kpis.splice(idx, 1);
  writeData('department-kpis.json', kpis);
  res.status(204).send();
});

module.exports = router;
