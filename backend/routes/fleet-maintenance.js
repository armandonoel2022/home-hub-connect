/**
 * Flotilla SafeOne - Reparación y Mantenimiento
 * Almacena: fleet (unidades), maintenance (registros de gasto), annualCost (matriz)
 * en data/fleet-maintenance.json (sembrado desde public/data/fleet_maintenance_seed.json)
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();
const FILENAME = 'fleet-maintenance.json';

function ensureSeed() {
  const existing = readData(FILENAME);
  if (existing && (existing.fleet?.length || existing.maintenance?.length)) return existing;

  // Try seeding from public/data/fleet_maintenance_seed.json (frontend bundle)
  const candidates = [
    path.join(__dirname, '..', '..', 'public', 'data', 'fleet_maintenance_seed.json'),
    path.join(__dirname, '..', 'data', 'seeds', 'fleet_maintenance_seed.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const seed = JSON.parse(fs.readFileSync(p, 'utf8'));
        // Add ids to maintenance entries
        const maintenance = (seed.maintenance || []).map((e, i) => ({
          id: `FM-${String(i + 1).padStart(4, '0')}`,
          ...e,
        }));
        const data = {
          generatedFrom: seed.generatedFrom,
          generatedAt: seed.generatedAt,
          fleet: seed.fleet || [],
          maintenance,
          annualCost: seed.annualCost || [],
        };
        writeData(FILENAME, data);
        return data;
      }
    } catch (err) {
      console.error('Error sembrando flotilla:', err.message);
    }
  }
  // Empty default
  const empty = { fleet: [], maintenance: [], annualCost: [] };
  writeData(FILENAME, empty);
  return empty;
}

// Normalize taller names (unify common aliases)
const TALLER_ALIASES = {
  'motoservic campe': 'Moto Servic Campe',
};
function normalizeTaller(name) {
  if (!name) return name;
  const key = name.trim().toLowerCase();
  return TALLER_ALIASES[key] || name.trim();
}

// GET full dataset
router.get('/', auth, (req, res) => {
  const data = ensureSeed();
  res.json(data);
});

// POST new maintenance entry
router.post('/maintenance', auth, (req, res) => {
  const data = ensureSeed();
  const entry = {
    ...req.body,
    taller: normalizeTaller(req.body.taller),
    id: req.body.id || generateId('FM', data.maintenance),
    createdAt: new Date().toISOString(),
  };
  data.maintenance.unshift(entry);
  writeData(FILENAME, data);
  res.status(201).json(entry);
});

// PUT update maintenance entry
router.put('/maintenance/:id', auth, (req, res) => {
  const data = ensureSeed();
  const idx = data.maintenance.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Registro no encontrado' });
  data.maintenance[idx] = {
    ...data.maintenance[idx],
    ...req.body,
    taller: normalizeTaller(req.body.taller ?? data.maintenance[idx].taller),
    id: data.maintenance[idx].id,
    updatedAt: new Date().toISOString(),
  };
  writeData(FILENAME, data);
  res.json(data.maintenance[idx]);
});

// DELETE maintenance entry
router.delete('/maintenance/:id', auth, (req, res) => {
  const data = ensureSeed();
  const idx = data.maintenance.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Registro no encontrado' });
  data.maintenance.splice(idx, 1);
  writeData(FILENAME, data);
  res.status(204).send();
});

// POST new fleet unit
router.post('/fleet', auth, (req, res) => {
  const data = ensureSeed();
  const nextNo = (data.fleet.reduce((m, u) => Math.max(m, Number(u.no) || 0), 0) || 0) + 1;
  const unit = { no: nextNo, ...req.body };
  data.fleet.push(unit);
  writeData(FILENAME, data);
  res.status(201).json(unit);
});

// PUT update fleet unit (by placa, since no is internal)
router.put('/fleet/:placa', auth, (req, res) => {
  const data = ensureSeed();
  const idx = data.fleet.findIndex(u => String(u.placa) === req.params.placa);
  if (idx === -1) return res.status(404).json({ message: 'Unidad no encontrada' });
  data.fleet[idx] = { ...data.fleet[idx], ...req.body };
  writeData(FILENAME, data);
  res.json(data.fleet[idx]);
});

// DELETE fleet unit
router.delete('/fleet/:placa', auth, (req, res) => {
  const data = ensureSeed();
  const idx = data.fleet.findIndex(u => String(u.placa) === req.params.placa);
  if (idx === -1) return res.status(404).json({ message: 'Unidad no encontrada' });
  data.fleet.splice(idx, 1);
  writeData(FILENAME, data);
  res.status(204).send();
});

// POST normalize talleres (one-shot maintenance utility)
router.post('/normalize-talleres', auth, (req, res) => {
  const data = ensureSeed();
  let changed = 0;
  data.maintenance.forEach(e => {
    const before = e.taller;
    e.taller = normalizeTaller(e.taller);
    if (before !== e.taller) changed++;
  });
  writeData(FILENAME, data);
  res.json({ changed });
});

module.exports = router;
