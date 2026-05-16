/**
 * Reglas de rondas (punches) por cliente.
 *
 * Documento:
 *   {
 *     id,
 *     clientPattern,          // string buscado dentro de accountName (case-insensitive)
 *     label,                  // nombre humano (ej. "Spirit Apparel B6/A18/A3")
 *     rounds: [{ time: "HH:MM", toleranceMin, precisionMin }],
 *     active: boolean,
 *     createdAt, updatedAt, updatedBy
 *   }
 *
 * Cualquier accountName que contenga `clientPattern` (regex-safe) recibe estas reglas.
 * Si varias reglas hacen match, gana la primera (por orden).
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const FILE = 'monitoring_punch_rules.json';
const router = express.Router();

function ensureSeed() {
  const items = readData(FILE);
  if (items.length > 0) return items;
  const seed = [{
    id: 'PR-0001',
    clientPattern: 'SPIRIT',
    label: 'Spirit Apparel — naves B6/A18/A3',
    rounds: [
      { time: '03:30', toleranceMin: 60, precisionMin: 10 },
      { time: '05:00', toleranceMin: 60, precisionMin: 10 },
    ],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system-seed',
  }];
  writeData(FILE, seed);
  return seed;
}

router.get('/', auth, (req, res) => {
  res.json(ensureSeed());
});

router.post('/', auth, (req, res) => {
  const items = ensureSeed();
  const { clientPattern, label, rounds, active } = req.body || {};
  if (!clientPattern || !Array.isArray(rounds) || rounds.length === 0) {
    return res.status(400).json({ message: 'clientPattern y rounds son obligatorios' });
  }
  const doc = {
    id: generateId('PR', items),
    clientPattern: String(clientPattern).trim(),
    label: label || clientPattern,
    rounds: rounds.map(r => ({
      time: String(r.time),
      toleranceMin: Number(r.toleranceMin) || 60,
      precisionMin: Number(r.precisionMin) || 10,
    })),
    active: active !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.email || 'desconocido',
  };
  items.push(doc);
  writeData(FILE, items);
  res.status(201).json(doc);
});

router.put('/:id', auth, (req, res) => {
  const items = ensureSeed();
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
  const cur = items[idx];
  const { clientPattern, label, rounds, active } = req.body || {};
  if (clientPattern !== undefined) cur.clientPattern = String(clientPattern).trim();
  if (label !== undefined) cur.label = label;
  if (Array.isArray(rounds)) {
    cur.rounds = rounds.map(r => ({
      time: String(r.time),
      toleranceMin: Number(r.toleranceMin) || 60,
      precisionMin: Number(r.precisionMin) || 10,
    }));
  }
  if (active !== undefined) cur.active = !!active;
  cur.updatedAt = new Date().toISOString();
  cur.updatedBy = req.user?.email || 'desconocido';
  items[idx] = cur;
  writeData(FILE, items);
  res.json(cur);
});

router.delete('/:id', auth, (req, res) => {
  const items = ensureSeed();
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(204).send();
  items.splice(idx, 1);
  writeData(FILE, items);
  res.status(204).send();
});

module.exports = router;
