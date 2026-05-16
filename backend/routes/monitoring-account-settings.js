/**
 * Configuración persistente por cuenta de monitoreo (Kronos).
 *
 * Documento por accountCode:
 *   {
 *     accountCode,           // PK natural ("0001", "1234", etc.)
 *     accountName,           // último nombre conocido (para referencia)
 *     kind: "regular" | "panic",  // panic = botón de pánico (no aplica apertura/cierre)
 *     manualStatus: "Activo" | "Inactivo" | "Sin notificaciones" |
 *                   "Dado de baja" | "Cancelado" | "Suspendido por falta de pago" | null
 *     expectedOpen: "HH:MM" | null,
 *     expectedClose: "HH:MM" | null,
 *     notes: string,
 *     updatedAt, updatedBy
 *   }
 *
 * Endpoints:
 *   GET    /api/monitoring-account-settings              -> lista completa
 *   PUT    /api/monitoring-account-settings/:accountCode -> upsert
 *   DELETE /api/monitoring-account-settings/:accountCode -> reset
 */
const express = require('express');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');

const FILE = 'monitoring_account_settings.json';
const router = express.Router();

const ALLOWED_STATUS = new Set([
  'Activo', 'Inactivo', 'Sin notificaciones',
  'Dado de baja', 'Cancelado', 'Suspendido por falta de pago',
]);

router.get('/', auth, (req, res) => {
  res.json(readData(FILE));
});

router.put('/:accountCode', auth, (req, res) => {
  const code = String(req.params.accountCode || '').trim();
  if (!code) return res.status(400).json({ message: 'accountCode requerido' });

  const items = readData(FILE);
  const idx = items.findIndex(i => i.accountCode === code);
  const body = req.body || {};
  const userLabel = req.user?.email || 'desconocido';

  const kind = body.kind === 'panic' ? 'panic' : 'regular';
  const manualStatus = body.manualStatus && ALLOWED_STATUS.has(body.manualStatus)
    ? body.manualStatus : null;

  const doc = {
    accountCode: code,
    accountName: body.accountName || (idx >= 0 ? items[idx].accountName : ''),
    kind,
    manualStatus,
    expectedOpen: body.expectedOpen || null,
    expectedClose: body.expectedClose || null,
    notes: body.notes || '',
    updatedAt: new Date().toISOString(),
    updatedBy: userLabel,
  };
  if (idx >= 0) items[idx] = doc; else items.push(doc);
  writeData(FILE, items);
  res.json(doc);
});

router.delete('/:accountCode', auth, (req, res) => {
  const items = readData(FILE);
  const idx = items.findIndex(i => i.accountCode === req.params.accountCode);
  if (idx === -1) return res.status(204).send();
  items.splice(idx, 1);
  writeData(FILE, items);
  res.status(204).send();
});

module.exports = router;
