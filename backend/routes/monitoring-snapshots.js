/**
 * Snapshots diarios del servicio de monitoreo.
 *
 * Cada snapshot guarda las métricas calculadas en el frontend después de procesar
 * un reporte (Kronos o Punch) o al "cerrar el día" manualmente. Permite comparar
 * la evolución del servicio entre periodos (ayer, semana, mes, trimestre, año).
 *
 * Documento:
 *   {
 *     id, date (YYYY-MM-DD), source: "kronos" | "punch" | "manual" | "auto-close",
 *     metrics: {
 *       totalLx, activeLx, billableLx,
 *       compliedCycle,            // # LX que cumplieron apertura y cierre
 *       compliedCyclePct,         // %
 *       noSignalHigh,             // # LX sin señal hace 3+ días
 *       activeTrackTotal,         // # rondas Active Track esperadas
 *       activeTrackComplied,      // # rondas cumplidas
 *       activeTrackPct,           // %
 *       incidentsOpen, incidentsResolved
 *     },
 *     createdAt, createdBy
 *   }
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const FILE = 'monitoring_snapshots.json';
const router = express.Router();

router.get('/', auth, (req, res) => {
  let items = readData(FILE);
  const { from, to, source } = req.query;
  if (from) items = items.filter(i => i.date >= from);
  if (to) items = items.filter(i => i.date <= to);
  if (source) items = items.filter(i => i.source === source);
  items.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  res.json(items);
});

router.post('/', auth, (req, res) => {
  const { date, source, metrics } = req.body || {};
  if (!date || !source || !metrics) {
    return res.status(400).json({ message: 'date, source y metrics son obligatorios' });
  }
  const items = readData(FILE);
  // upsert por (date, source): si ya existe el snapshot del mismo día y fuente, lo reemplaza
  const idx = items.findIndex(i => i.date === date && i.source === source);
  const doc = {
    id: idx >= 0 ? items[idx].id : generateId('SNP', items),
    date,
    source,
    metrics,
    createdAt: new Date().toISOString(),
    createdBy: req.user?.email || 'desconocido',
  };
  if (idx >= 0) items[idx] = doc; else items.push(doc);
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
