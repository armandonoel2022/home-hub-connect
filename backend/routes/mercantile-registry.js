/**
 * Registro Mercantil de clientes — capa local editable sobre gSafeOne.
 *
 * La base de datos NO se modifica: los clientes se leen de [Cliente] (SQL, solo
 * lectura) y aquí se guarda únicamente el Registro Mercantil en JSON local.
 *
 * Archivo: mercantile-registry.json
 *   {
 *     "1001": {
 *       registroMercantil, camaraComercio, emision, vence,
 *       activo: true, nota, updatedAt, updatedBy
 *     }
 *   }
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();
const FILE = 'mercantile-registry.json';

function load() {
  const d = readData(FILE);
  if (!d || Array.isArray(d)) return {};
  return d;
}

function canEdit(user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const dep = String(user.department || '').toLowerCase();
  return /servicio al cliente|comercial|administrac|gerencia|tecnolog|cuentas por cobrar/.test(dep);
}

function audit(user, action, targetId, details) {
  try {
    const logs = readData('audit-log.json');
    logs.push({
      id: generateId('AUD', logs),
      userId: user?.id || 'system',
      userName: user?.fullName || user?.name || 'Sistema',
      action,
      module: 'registro-mercantil',
      targetId: String(targetId),
      targetName: `Cliente ${targetId}`,
      details,
      timestamp: new Date().toISOString(),
    });
    writeData('audit-log.json', logs);
  } catch (e) { console.error('audit registro-mercantil:', e.message); }
}

function sanitize(body) {
  const out = {
    registroMercantil: String(body.registroMercantil || '').trim(),
    camaraComercio: String(body.camaraComercio || '').trim(),
    emision: String(body.emision || '').trim(),
    vence: String(body.vence || '').trim(),
    nota: String(body.nota || '').trim(),
    activo: body.activo === false ? false : true,
  };
  return out;
}

function validate(rec) {
  if (!rec.registroMercantil) return 'El número de Registro Mercantil es obligatorio.';
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (rec.emision && !dateRe.test(rec.emision)) return 'Fecha de emisión inválida (YYYY-MM-DD).';
  if (rec.vence && !dateRe.test(rec.vence)) return 'Fecha de vencimiento inválida (YYYY-MM-DD).';
  if (rec.emision && rec.vence && rec.emision > rec.vence) {
    return 'La fecha de emisión no puede ser mayor a la de vencimiento.';
  }
  return null;
}

router.use(auth);

// Todos los registros (mapa clienteID → registro)
router.get('/', (req, res) => res.json(load()));

// Un registro
router.get('/:clienteId', (req, res) => {
  const store = load();
  res.json(store[String(req.params.clienteId)] || null);
});

// Crear / actualizar
router.put('/:clienteId', (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ message: 'Sin permisos para editar el Registro Mercantil.' });
  const rec = sanitize(req.body || {});
  const err = validate(rec);
  if (err) return res.status(400).json({ message: err });

  const id = String(req.params.clienteId);
  const store = load();
  store[id] = {
    ...(store[id] || {}),
    ...rec,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.fullName || req.user?.name || null,
  };
  writeData(FILE, store);
  audit(req.user, 'update', id, `Registro Mercantil ${rec.registroMercantil} · vence ${rec.vence || '—'}`);
  res.json(store[id]);
});

// Desactivar (borrado lógico)
router.delete('/:clienteId', (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ message: 'Sin permisos.' });
  const id = String(req.params.clienteId);
  const store = load();
  if (!store[id]) return res.status(404).json({ message: 'Registro no encontrado.' });
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ message: 'Debe indicar la justificación de la desactivación.' });
  store[id] = {
    ...store[id],
    activo: false,
    nota: [store[id].nota, `Desactivado: ${reason}`].filter(Boolean).join(' · '),
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.fullName || req.user?.name || null,
  };
  writeData(FILE, store);
  audit(req.user, 'deactivate', id, `Desactivado. Justificación: ${reason}`);
  res.json(store[id]);
});

// Carga masiva: { items: [{ clienteId, registroMercantil, camaraComercio, emision, vence }] }
router.post('/bulk', (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ message: 'Sin permisos.' });
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const validIds = Array.isArray(req.body?.validClientIds)
    ? new Set(req.body.validClientIds.map((x) => String(x)))
    : null;

  const store = load();
  const detalle = [];
  let exitos = 0;

  items.forEach((raw, i) => {
    const fila = i + 1;
    const id = String(raw.clienteId ?? raw.ClienteID ?? '').trim();
    if (!id) { detalle.push({ fila, clienteId: id, ok: false, error: 'ClienteID vacío' }); return; }
    if (validIds && !validIds.has(id)) {
      detalle.push({ fila, clienteId: id, ok: false, error: 'ClienteID no existe en la tabla Cliente' });
      return;
    }
    const rec = sanitize({
      registroMercantil: raw.registroMercantil ?? raw.RegistroMercantil,
      camaraComercio: raw.camaraComercio ?? raw.CamaraComercio,
      emision: raw.emision ?? raw.Emision,
      vence: raw.vence ?? raw.Vence,
    });
    const err = validate(rec);
    if (err) { detalle.push({ fila, clienteId: id, ok: false, error: err }); return; }
    store[id] = {
      ...(store[id] || {}),
      ...rec,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.fullName || req.user?.name || null,
    };
    exitos += 1;
    detalle.push({ fila, clienteId: id, ok: true });
  });

  writeData(FILE, store);
  audit(req.user, 'bulk-import', 'varios', `Carga masiva: ${exitos}/${items.length} registros`);
  res.json({ total: items.length, exitos, errores: items.length - exitos, detalle, store });
});

module.exports = router;
