/**
 * Solicitudes de personal Operaciones → RRHH (OPS-RRHH-000123)
 */
const express = require('express');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');
const mail = require('../services/mailOpsRequests');

const router = express.Router();
const FILE = mail.FILE;
const TPL_FILE = 'ops-hr-templates.json';
const SLA = { Crítica: 24, Alta: 72, Normal: 168 };
// Compromiso de RRHH por tipo de movimiento y prioridad (horas). Editable por Admin/RRHH.
const DEFAULT_SLA_MATRIX = {
  Sustitución: { Crítica: 24, Alta: 48, Normal: 72 },
  Ingreso: { Crítica: 72, Alta: 120, Normal: 168 },
  Salida: { Crítica: 48, Alta: 72, Normal: 120 },
  Uniformes: { Crítica: 24, Alta: 72, Normal: 168 },
};
function slaMatrix() {
  const m = mail.getSettings().slaMatrix || {};
  const out = {};
  for (const t of Object.keys(DEFAULT_SLA_MATRIX)) out[t] = { ...DEFAULT_SLA_MATRIX[t], ...(m[t] || {}) };
  return out;
}
function slaFor(tipo, prioridad) {
  const row = slaMatrix()[tipo] || SLA;
  return Number(row[prioridad] || row.Normal || SLA.Normal);
}
function isRrhhOrAdmin(req) {
  if (req.user?.isAdmin) return true;
  const u = (readData('users.json') || []).find((x) => x.id === req.user?.id);
  const dep = String(u?.department || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return !!u && (u.isAdmin || dep.includes('recursos humanos'));
}
const TYPES = ['Ingreso', 'Salida', 'Sustitución', 'Uniformes'];
const UNIFORM_CATEGORIES = [
  'Camisas mangas largas', 'Camisas mangas cortas', 'T-shirts', 'Holster (funda o pistolera)',
  'Pantalones tipo Cargo con bolsillos laterales', 'Pantalones', 'Zapatos', 'Botas tipo militar',
  'Gorras', 'Correas', 'Jackets', 'Linternas', 'Otros',
];

function validateRequest(body) {
  if (!TYPES.includes(body.tipo)) return 'Tipo de solicitud no válido';
  for (const key of ['clienteId', 'localidadId', 'puestoId', 'turnoId']) {
    if (!String(body[key] || '').trim()) return 'La ubicación Cliente → Localidad → Puesto → Turno es obligatoria';
  }
  if (body.tipo !== 'Uniformes') return null;
  if (!String(body.uniformRecipientName || '').trim() || String(body.uniformRecipientName).length > 120) return 'Indique el agente que recibirá el uniforme';
  if (!Array.isArray(body.uniformItems) || !body.uniformItems.length || body.uniformItems.length > UNIFORM_CATEGORIES.length) return 'Seleccione al menos una prenda válida';
  for (const item of body.uniformItems) {
    if (!UNIFORM_CATEGORIES.includes(item?.category)) return 'La solicitud contiene una categoría de uniforme no válida';
    if (!Number.isInteger(item?.quantity) || item.quantity < 1 || item.quantity > 50) return 'Cada prenda debe tener una cantidad entre 1 y 50';
    if (String(item?.size || '').length > 10) return 'La talla indicada no es válida';
    if (item.category === 'Otros' && (!String(item.customDescription || '').trim() || String(item.customDescription).length > 120)) return 'Describa la indumentaria seleccionada como Otros';
  }
  return null;
}

function nextId(list) {
  const max = list.reduce((m, r) => Math.max(m, Number(String(r.id).replace(/\D/g, '')) || 0), 0);
  return `OPS-RRHH-${String(max + 1).padStart(6, '0')}`;
}

router.get('/', auth, (req, res) => res.json(readData(FILE)));

router.get('/templates/all', auth, (req, res) => res.json(readData(TPL_FILE)));
router.put('/templates/all', auth, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ message: 'Se esperaba un array' });
  writeData(TPL_FILE, req.body); res.json({ ok: true });
});

router.get('/settings/all', auth, (req, res) => res.json(mail.getSettings()));
router.put('/settings/all', auth, (req, res) => {
  const list = Array.isArray(req.body?.rrhhRecipients) ? req.body.rrhhRecipients : null;
  if (!list) return res.status(400).json({ message: 'Se esperaba rrhhRecipients[]' });
  const clean = [...new Set(list.map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))];
  mail.saveSettings({ rrhhRecipients: clean, updatedAt: new Date().toISOString(), updatedBy: req.body.updatedBy || '' });
  res.json(mail.getSettings());
});

router.get('/sla/all', auth, (req, res) => res.json({ matrix: slaMatrix(), defaults: DEFAULT_SLA_MATRIX, updatedAt: mail.getSettings().slaUpdatedAt || null, updatedBy: mail.getSettings().slaUpdatedBy || '' }));
router.put('/sla/all', auth, (req, res) => {
  if (!isRrhhOrAdmin(req)) return res.status(403).json({ message: 'Solo Administración o RRHH pueden modificar los plazos' });
  const input = req.body?.matrix || {};
  const clean = {};
  for (const t of Object.keys(DEFAULT_SLA_MATRIX)) {
    clean[t] = {};
    for (const p of ['Crítica', 'Alta', 'Normal']) {
      const v = Number(input?.[t]?.[p]);
      if (!Number.isFinite(v) || v < 1 || v > 2160) return res.status(400).json({ message: `Plazo inválido para ${t} · ${p} (1 a 2160 horas)` });
      clean[t][p] = Math.round(v);
    }
  }
  mail.saveSettings({ slaMatrix: clean, slaUpdatedAt: new Date().toISOString(), slaUpdatedBy: String(req.body?.updatedBy || req.user?.email || '').slice(0, 120) });
  res.json({ matrix: slaMatrix(), defaults: DEFAULT_SLA_MATRIX, updatedAt: mail.getSettings().slaUpdatedAt, updatedBy: mail.getSettings().slaUpdatedBy });
});

const isMailAdmin = (req) => String(req.user?.email || '').toLowerCase() === 'anoel@safeone.com.do';
router.post('/mail/sync', auth, async (req, res) => res.json(await mail.syncReplies()));
router.post('/mail/summary', auth, async (req, res) => res.json(await mail.dailySummary(true)));
router.get('/mail/status', auth, (req, res) => res.json({ configured: mail.isConfigured(), user: mail.config().user }));
router.get('/mail/admin-status', auth, async (req, res) => {
  if (!isMailAdmin(req)) return res.status(403).json({ message: 'Solo el administrador de correo' });
  res.json(await mail.status());
});
router.post('/mail/test', auth, async (req, res) => {
  if (!isMailAdmin(req)) return res.status(403).json({ message: 'Solo el administrador de correo' });
  res.json(await mail.testConnection());
});

router.post('/', auth, async (req, res) => {
  const list = readData(FILE);
  const now = new Date();
  const b = req.body || {};
  const validationError = validateRequest(b);
  if (validationError) return res.status(400).json({ message: validationError });
  const slaHoras = slaFor(b.tipo, b.prioridad);
  const r = {
    ...b,
    id: nextId(list),
    slaHoras,
    fechaLimiteSLA: b.estado === 'Borrador' ? null : new Date(now.getTime() + slaHoras * 3600e3).toISOString(),
    fechaCreacion: now.toISOString(),
    fechaEnvio: b.estado === 'Borrador' ? null : now.toISOString(),
    comentarios: b.comentarios || [],
    historialEstados: [{ fecha: now.toISOString(), usuario: b.creadoPor, anterior: null, nuevo: b.estado }],
    createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
  list.unshift(r);
  writeData(FILE, list);
  if (r.estado !== 'Borrador') r._mail = await mail.notify(r, 'created');
  res.status(201).json(r);
});

router.put('/:id', auth, async (req, res) => {
  const list = readData(FILE);
  const idx = list.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
  const prev = list[idx];
  const { _event, _usuario, _nota, ...patch } = req.body || {};
  const now = new Date().toISOString();
  const next = { ...prev, ...patch, updatedAt: now };
  const validationError = validateRequest(next);
  if (validationError) return res.status(400).json({ message: validationError });
  let event = null;
  if (patch.estado && patch.estado !== prev.estado) {
    event = 'status';
    next.historialEstados = [...(prev.historialEstados || []), { fecha: now, usuario: _usuario, anterior: prev.estado, nuevo: patch.estado, nota: _nota || '' }];
    if (prev.estado === 'Borrador') {
      next.fechaEnvio = now;
      next.slaHoras = slaFor(next.tipo, next.prioridad);
      next.fechaLimiteSLA = new Date(Date.now() + next.slaHoras * 3600e3).toISOString();
      event = 'created';
    }
    if (!next.primerMovimientoRRHH && prev.estado === 'Enviada a RRHH') next.primerMovimientoRRHH = now;
    if (['Cubierta satisfactoriamente', 'Cerrada sin cobertura', 'Cancelada por Operaciones'].includes(patch.estado)) next.fechaCierre = now;
  }
  if (_event === 'comment') event = 'comment';
  list[idx] = next;
  writeData(FILE, list);
  if (event) {
    const last = (next.comentarios || []).slice(-1)[0];
    next._mail = await mail.notify(next, event, { nota: _nota, comentario: event === 'comment' ? last?.texto : undefined, autor: last?.autor });
  }
  if (event === 'status' && next.estado === 'Cubierta satisfactoriamente' && next.notificarCliente && !next.clienteNotificadoEn) {
    const cm = await mail.notifyClient(next).catch((e) => ({ sent: false, reason: e.message }));
    if (cm && cm.sent !== false) {
      next.clienteNotificadoEn = new Date().toISOString();
      const l2 = readData(FILE); const i2 = l2.findIndex((x) => x.id === next.id);
      if (i2 >= 0) { l2[i2].clienteNotificadoEn = next.clienteNotificadoEn; writeData(FILE, l2); }
    }
    next._mailCliente = cm;
  }
  res.json(next);
});

router.delete('/:id', auth, (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).json({ message: 'Solo el administrador puede eliminar solicitudes' });
  const motivo = String(req.body?.motivo || '').trim();
  if (motivo.length < 5 || motivo.length > 500) return res.status(400).json({ message: 'Indique la justificación de la eliminación (mínimo 5 caracteres)' });
  const list = readData(FILE);
  const target = list.find((r) => r.id === req.params.id);
  if (!target) return res.status(404).json({ message: 'No encontrado' });
  const now = new Date().toISOString();
  const deleted = readData('ops-hr-requests-deleted.json');
  deleted.unshift({ ...target, _eliminadoEn: now, _eliminadoPor: req.user.email, _motivoEliminacion: motivo });
  writeData('ops-hr-requests-deleted.json', deleted);
  const logs = readData('audit-log.json');
  logs.push({ id: `AUD-${Date.now()}`, userId: req.user.id, userName: req.user.email, action: 'delete', module: 'ops-hr-requests', targetId: target.id, targetName: `${target.tipo} · ${target.clienteNombre || ''}`, details: motivo, ip: req.ip, timestamp: now });
  writeData('audit-log.json', logs);
  writeData(FILE, list.filter((r) => r.id !== req.params.id));
  res.status(204).send();
});

module.exports = router;
