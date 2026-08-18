/**
 * Flotilla Vehicular SafeOne — registro completo de vehículos.
 * Persistencia: data/fleet-vehicles.json
 * Soft delete (campo `activo`), historial de movimientos embebido.
 */
const express = require('express');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();
const FILENAME = 'fleet-vehicles.json';

function load() {
  const data = readData(FILENAME);
  return Array.isArray(data) ? data : [];
}

function nextId(items) {
  const nums = items.map(v => parseInt(String(v.id).replace(/\D/g, ''), 10) || 0);
  return `VEH-${String((Math.max(0, ...nums) || 0) + 1).padStart(4, '0')}`;
}

function historyEntry(tipo, descripcion, usuario) {
  return {
    id: `H-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fecha: new Date().toISOString(),
    tipo,
    descripcion,
    usuario: usuario || 'Sistema',
  };
}

// GET all (?includeInactive=1 para ver descargados)
router.get('/', auth, (req, res) => {
  const items = load();
  res.json(req.query.includeInactive ? items : items.filter(v => v.activo !== false));
});

// GET historial global de asignaciones
router.get('/asignaciones', auth, (req, res) => {
  const items = load();
  const history = [];
  items.forEach(v => {
    (v.historial || [])
      .filter(h => h.tipo === 'asignacion' || h.tipo === 'devolucion')
      .forEach(h => history.push({ ...h, vehiculoId: v.id, placa: v.placa }));
  });
  history.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  res.json(history);
});

// GET one
router.get('/:id', auth, (req, res) => {
  const item = load().find(v => v.id === req.params.id);
  if (!item) return res.status(404).json({ message: 'Vehículo no encontrado' });
  res.json(item);
});

function duplicate(items, body, ignoreId) {
  const norm = s => String(s || '').trim().toUpperCase();
  return items.find(v =>
    v.id !== ignoreId && v.activo !== false && (
      (norm(v.vin) && norm(v.vin) === norm(body.vin)) ||
      (norm(v.placa) && norm(v.placa) === norm(body.placa)) ||
      (norm(v.matricula) && norm(v.matricula) === norm(body.matricula))
    )
  );
}

// POST create
router.post('/', auth, (req, res) => {
  const items = load();
  const dup = duplicate(items, req.body, null);
  if (dup) return res.status(409).json({ message: `Ya existe un vehículo con ese VIN/placa/matrícula (${dup.id} — ${dup.placa})` });

  const now = new Date().toISOString();
  const vehicle = {
    ...req.body,
    id: req.body.id || nextId(items),
    activo: true,
    historial: [historyEntry('creacion', 'Vehículo registrado', req.body.creadoPor)],
    creadoEn: now,
    actualizadoEn: now,
  };
  items.push(vehicle);
  writeData(FILENAME, items);
  res.status(201).json(vehicle);
});

// PUT update
router.put('/:id', auth, (req, res) => {
  const items = load();
  const idx = items.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Vehículo no encontrado' });
  const dup = duplicate(items, req.body, req.params.id);
  if (dup) return res.status(409).json({ message: `VIN/placa/matrícula duplicados con ${dup.id} — ${dup.placa}` });

  const prev = items[idx];
  const extra = Array.isArray(req.body.__history) ? req.body.__history : [];
  delete req.body.__history;
  items[idx] = {
    ...prev,
    ...req.body,
    id: prev.id,
    creadoEn: prev.creadoEn,
    historial: [...(prev.historial || []), ...extra],
    actualizadoEn: new Date().toISOString(),
  };
  writeData(FILENAME, items);
  res.json(items[idx]);
});

// DELETE (soft)
router.delete('/:id', auth, (req, res) => {
  const items = load();
  const idx = items.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Vehículo no encontrado' });
  items[idx].activo = false;
  items[idx].estado = 'Descargado';
  items[idx].actualizadoEn = new Date().toISOString();
  items[idx].historial = [
    ...(items[idx].historial || []),
    historyEntry('baja', req.query.motivo || 'Vehículo descargado', req.query.usuario),
  ];
  writeData(FILENAME, items);
  res.json(items[idx]);
});

module.exports = router;
