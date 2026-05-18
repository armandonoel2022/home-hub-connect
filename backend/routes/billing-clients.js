/**
 * Catálogo maestro de clientes de Cuentas por Cobrar (CxC).
 *
 * Documento:
 *   {
 *     id,                  // BC-0001 (interno)
 *     code,                // código que usa CxC para facturar (PK natural)
 *     name,                // razón social / nombre comercial
 *     contact, phone, email,
 *     locationAddress,     // texto libre (ej "Av. Romulo Betancourt 123")
 *     locationMapsUrl,     // enlace maps.app.goo.gl o googlemaps largo
 *     locationLat, locationLng, // resueltos por /api/geo/resolve (opcional)
 *     notes,
 *     active: boolean,
 *     createdAt, updatedAt, updatedBy
 *   }
 *
 * Cada cliente puede tener N cuentas Kronos (LX) asociadas vía
 * monitoring-account-settings.clientId.
 *
 * Endpoints:
 *   GET    /api/billing-clients              → lista
 *   POST   /api/billing-clients              → crear
 *   PUT    /api/billing-clients/:id          → actualizar
 *   DELETE /api/billing-clients/:id          → eliminar
 *   POST   /api/billing-clients/bulk-import  → reemplaza/upserts en bloque
 *                                              { items: [{code, name, ...}], mode: "replace"|"upsert" }
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const FILE = 'billing_clients.json';
const router = express.Router();

function normalize(body, prev) {
  return {
    code: String(body.code || prev?.code || '').trim(),
    name: String(body.name || prev?.name || '').trim(),
    contact: body.contact ?? prev?.contact ?? '',
    phone: body.phone ?? prev?.phone ?? '',
    email: body.email ?? prev?.email ?? '',
    locationAddress: body.locationAddress ?? prev?.locationAddress ?? '',
    locationMapsUrl: body.locationMapsUrl ?? prev?.locationMapsUrl ?? '',
    locationLat: body.locationLat ?? prev?.locationLat ?? null,
    locationLng: body.locationLng ?? prev?.locationLng ?? null,
    notes: body.notes ?? prev?.notes ?? '',
    active: body.active === undefined ? (prev?.active ?? true) : !!body.active,
  };
}

router.get('/', auth, (req, res) => {
  res.json(readData(FILE));
});

router.post('/', auth, (req, res) => {
  const items = readData(FILE);
  const data = normalize(req.body || {});
  if (!data.code || !data.name) {
    return res.status(400).json({ message: 'code y name son obligatorios' });
  }
  if (items.some(i => i.code === data.code)) {
    return res.status(409).json({ message: `Ya existe cliente con código ${data.code}` });
  }
  const doc = {
    id: generateId('BC', items),
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.email || 'desconocido',
  };
  items.push(doc);
  writeData(FILE, items);
  res.status(201).json(doc);
});

router.put('/:id', auth, (req, res) => {
  const items = readData(FILE);
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
  const data = normalize(req.body || {}, items[idx]);
  if (!data.code || !data.name) {
    return res.status(400).json({ message: 'code y name son obligatorios' });
  }
  items[idx] = {
    ...items[idx], ...data,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.email || 'desconocido',
  };
  writeData(FILE, items);
  res.json(items[idx]);
});

router.delete('/:id', auth, (req, res) => {
  const items = readData(FILE);
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(204).send();
  items.splice(idx, 1);
  writeData(FILE, items);
  res.status(204).send();
});

router.post('/bulk-import', auth, (req, res) => {
  const { items: payload, mode } = req.body || {};
  if (!Array.isArray(payload) || payload.length === 0) {
    return res.status(400).json({ message: 'items[] requerido' });
  }
  const userLabel = req.user?.email || 'desconocido';
  const now = new Date().toISOString();
  const current = mode === 'replace' ? [] : readData(FILE);
  const byCode = new Map(current.map(c => [c.code, c]));

  let created = 0, updated = 0, skipped = 0;
  payload.forEach(raw => {
    const data = normalize(raw);
    if (!data.code || !data.name) { skipped++; return; }
    const prev = byCode.get(data.code);
    if (prev) {
      const merged = { ...prev, ...data, updatedAt: now, updatedBy: userLabel };
      byCode.set(data.code, merged);
      updated++;
    } else {
      const doc = {
        id: generateId('BC', Array.from(byCode.values())),
        ...data, createdAt: now, updatedAt: now, updatedBy: userLabel,
      };
      byCode.set(data.code, doc);
      created++;
    }
  });
  const finalList = Array.from(byCode.values());
  writeData(FILE, finalList);
  res.json({ ok: true, mode: mode === 'replace' ? 'replace' : 'upsert', created, updated, skipped, total: finalList.length });
});

module.exports = router;
