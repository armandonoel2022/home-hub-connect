/**
 * Configuración persistente por LX (cuenta Kronos).
 *
 * Una LX (account code de 4+ dígitos en Kronos) puede pertenecer a un cliente
 * facturable (billing-clients) o estar suelta. El estado operativo se rastrea
 * con `lxStatus` (reemplaza al antiguo `manualStatus`).
 *
 * Documento por accountCode:
 *   {
 *     accountCode,
 *     accountName,                 // último nombre visto en reportes Kronos
 *     clientId,                    // BC-XXXX (FK a billing-clients) o null
 *     kind: "regular" | "panic",   // panic = botón de pánico
 *     lxStatus: "Activa" | "Prueba" | "Cancelada" | "Suspendida" |
 *               "Dada de baja" | "Sin notificaciones" | "Inactiva" | null,
 *     locationAddress, locationMapsUrl,
 *     locationLat, locationLng,
 *     expectedOpen, expectedClose, notes,
 *     // compatibilidad histórica:
 *     manualStatus (deprecated — el front lo lee solo si lxStatus no existe)
 *     updatedAt, updatedBy
 *   }
 */
const express = require('express');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');

const FILE = 'monitoring_account_settings.json';
const router = express.Router();

const ALLOWED_LX_STATUS = new Set([
  'Activa', 'Prueba', 'Cancelada', 'Suspendida',
  'Dada de baja', 'Sin notificaciones', 'Inactiva',
]);
const ALLOWED_SERVICE_TYPE = new Set([
  'Monitoreado sin respuesta', 'Monitoreado con Respuesta',
  'Botón de pánico', 'Interrupción Energética', 'Bastón',
]);
const ALLOWED_COMM_TYPE = new Set(['EBS LX-EPX', 'Intelbras']);
const ALLOWED_BRAND = new Set(['Hikvision', 'Daiwa']);
// Legacy values that we still accept on write for back-compat
const LEGACY_STATUS = new Set([
  'Activo', 'Inactivo', 'Sin notificaciones',
  'Dado de baja', 'Cancelado', 'Suspendido por falta de pago',
]);
const LEGACY_TO_NEW = {
  'Activo': 'Activa', 'Inactivo': 'Inactiva',
  'Sin notificaciones': 'Sin notificaciones',
  'Dado de baja': 'Dada de baja', 'Cancelado': 'Cancelada',
  'Suspendido por falta de pago': 'Suspendida',
};

function pickEnum(value, set, prev) {
  if (value === null) return null;
  if (value === undefined) return prev ?? null;
  return set.has(value) ? value : (prev ?? null);
}

router.get('/', auth, (req, res) => {
  const list = readData(FILE);
  // Migración suave: si no tiene lxStatus pero tiene manualStatus legacy, exponer ambos
  const migrated = list.map(item => {
    if (!item.lxStatus && item.manualStatus && LEGACY_TO_NEW[item.manualStatus]) {
      return { ...item, lxStatus: LEGACY_TO_NEW[item.manualStatus] };
    }
    return item;
  });
  res.json(migrated);
});

router.put('/:accountCode', auth, (req, res) => {
  const code = String(req.params.accountCode || '').trim();
  if (!code) return res.status(400).json({ message: 'accountCode requerido' });

  const items = readData(FILE);
  const idx = items.findIndex(i => i.accountCode === code);
  const body = req.body || {};
  const userLabel = req.user?.email || 'desconocido';

  const kind = body.kind === 'panic' ? 'panic' : 'regular';

  // Acepta lxStatus (nuevo) o manualStatus (legacy). Normaliza a lxStatus.
  let lxStatus = null;
  if (body.lxStatus && ALLOWED_LX_STATUS.has(body.lxStatus)) {
    lxStatus = body.lxStatus;
  } else if (body.manualStatus && LEGACY_STATUS.has(body.manualStatus)) {
    lxStatus = LEGACY_TO_NEW[body.manualStatus];
  } else if (body.lxStatus === null || body.manualStatus === null) {
    lxStatus = null;
  } else if (idx >= 0) {
    lxStatus = items[idx].lxStatus || (items[idx].manualStatus ? LEGACY_TO_NEW[items[idx].manualStatus] : null);
  }

  const prev = idx >= 0 ? items[idx] : null;
  const doc = {
    accountCode: code,
    accountName: body.accountName ?? prev?.accountName ?? '',
    clientId: body.clientId !== undefined ? (body.clientId || null) : (prev?.clientId ?? null),
    kind,
    lxStatus,
    locationAddress: body.locationAddress ?? prev?.locationAddress ?? '',
    locationMapsUrl: body.locationMapsUrl ?? prev?.locationMapsUrl ?? '',
    locationLat: body.locationLat ?? prev?.locationLat ?? null,
    locationLng: body.locationLng ?? prev?.locationLng ?? null,
    expectedOpen: body.expectedOpen ?? prev?.expectedOpen ?? null,
    expectedClose: body.expectedClose ?? prev?.expectedClose ?? null,
    notes: body.notes ?? prev?.notes ?? '',
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
