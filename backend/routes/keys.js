/**
 * Control de Llaves SafeOne
 * Persistencia en data/keys.json
 * Estructura: { keys: KeyRecord[], deletedSeedIds: string[] }
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();
const FILENAME = 'keys.json';

function load() {
  const data = readData(FILENAME);
  if (!data || !Array.isArray(data.keys)) return { keys: [] };
  return data;
}

function save(data) {
  writeData(FILENAME, data);
}

// GET all keys
router.get('/', auth, (req, res) => {
  const data = load();
  res.json(data.keys);
});

// POST create
router.post('/', auth, (req, res) => {
  const data = load();
  const id = req.body.id || generateId('LLV', data.keys);
  const now = new Date().toISOString();
  const newKey = {
    id,
    code: req.body.code || id,
    descripcion: req.body.descripcion || '',
    tipoCerradura: req.body.tipoCerradura || '',
    ubicacion: req.body.ubicacion || '',
    departamento: req.body.departamento || '',
    perteneceA: req.body.perteneceA || '', // mueble/dispositivo/área al que pertenece
    linkedAssetId: req.body.linkedAssetId || '', // SSC-XXX o placa
    linkedAssetType: req.body.linkedAssetType || '', // 'asset' | 'vehicle' | ''
    responsable: req.body.responsable || '',
    responsableId: req.body.responsableId || '',
    fechaEntrega: req.body.fechaEntrega || '',
    tieneCopia: !!req.body.tieneCopia,
    cantidadCopias: req.body.cantidadCopias || 0,
    ubicacionCopia: req.body.ubicacionCopia || '',
    estado: req.body.estado || 'asignada', // asignada | disponible | extraviada | retirada
    ultimaRevision: req.body.ultimaRevision || '',
    proximaRevision: req.body.proximaRevision || '',
    frecuenciaDias: req.body.frecuenciaDias || 90,
    notas: req.body.notas || '',
    cantidadEnCaja: req.body.cantidadEnCaja ?? 0,
    cantidadAsignadas: req.body.cantidadAsignadas ?? 0,
    colorIdentificador: req.body.colorIdentificador || '',
    historial: req.body.historial || [],
    createdAt: now,
    updatedAt: now,
  };
  data.keys.unshift(newKey);
  save(data);
  res.status(201).json(newKey);
});

// PUT update
router.put('/:id', auth, (req, res) => {
  const data = load();
  const idx = data.keys.findIndex(k => k.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Llave no encontrada' });
  data.keys[idx] = { ...data.keys[idx], ...req.body, id: data.keys[idx].id, updatedAt: new Date().toISOString() };
  save(data);
  res.json(data.keys[idx]);
});

// DELETE
router.delete('/:id', auth, (req, res) => {
  const data = load();
  const idx = data.keys.findIndex(k => k.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'No encontrada' });
  data.keys.splice(idx, 1);
  save(data);
  res.status(204).send();
});

// POST add history entry
router.post('/:id/history', auth, (req, res) => {
  const data = load();
  const idx = data.keys.findIndex(k => k.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'No encontrada' });
  const entry = {
    id: `H-${Date.now()}`,
    fecha: req.body.fecha || new Date().toISOString(),
    accion: req.body.accion || 'entrega', // entrega | devolucion | revision | copia
    persona: req.body.persona || '',
    motivo: req.body.motivo || '',
    registradoPor: req.body.registradoPor || '',
  };
  data.keys[idx].historial = [entry, ...(data.keys[idx].historial || [])];
  data.keys[idx].updatedAt = new Date().toISOString();
  if (entry.accion === 'revision') data.keys[idx].ultimaRevision = entry.fecha.slice(0, 10);
  save(data);
  res.status(201).json(data.keys[idx]);
});

module.exports = router;
