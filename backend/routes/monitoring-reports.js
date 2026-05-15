/**
 * Monitoring Reports — almacena reportes diarios cargados desde Kronos NET
 * (kind='kronos' para resumen de aperturas/cierres y kind='punches' para Active Track).
 *
 * Cada documento: { id, kind, reportDate (YYYY-MM-DD), uploadedAt, uploadedBy, fileName, payload }
 * Al hacer POST con la misma combinación (kind, reportDate) se REEMPLAZA el existente
 * para evitar duplicados cuando se vuelve a subir el mismo reporte.
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const FILE = 'monitoring_reports.json';
const router = express.Router();

router.get('/', auth, (req, res) => {
  let items = readData(FILE);
  if (req.query.kind) items = items.filter(i => i.kind === req.query.kind);
  // Lista sin payload para no enviar mucha data
  const light = items
    .map(({ payload, ...rest }) => ({ ...rest, hasPayload: !!payload }))
    .sort((a, b) => (b.reportDate || '').localeCompare(a.reportDate || ''));
  res.json(light);
});

router.get('/:id', auth, (req, res) => {
  const items = readData(FILE);
  const item = items.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ message: 'No encontrado' });
  res.json(item);
});

router.post('/', auth, (req, res) => {
  const { kind, reportDate, payload, fileName } = req.body || {};
  if (!kind || !reportDate || !payload) {
    return res.status(400).json({ message: 'kind, reportDate y payload son obligatorios' });
  }
  const items = readData(FILE);
  const existingIdx = items.findIndex(i => i.kind === kind && i.reportDate === reportDate);
  const userLabel = req.user?.email || 'desconocido';
  const doc = {
    id: existingIdx >= 0 ? items[existingIdx].id : generateId('MR', items),
    kind,
    reportDate,
    fileName: fileName || '',
    uploadedAt: new Date().toISOString(),
    uploadedBy: userLabel,
    payload,
  };
  if (existingIdx >= 0) items[existingIdx] = doc; else items.push(doc);
  writeData(FILE, items);
  res.status(201).json(doc);
});

router.delete('/:id', auth, (req, res) => {
  const items = readData(FILE);
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
  items.splice(idx, 1);
  writeData(FILE, items);
  res.status(204).send();
});

module.exports = router;
