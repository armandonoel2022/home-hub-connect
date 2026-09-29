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

router.post('/mail/sync', auth, async (req, res) => res.json(await mail.syncReplies()));
router.post('/mail/summary', auth, async (req, res) => res.json(await mail.dailySummary(true)));
router.get('/mail/status', auth, (req, res) => res.json({ configured: mail.isConfigured(), user: mail.config().user }));

router.post('/', auth, async (req, res) => {
  const list = readData(FILE);
  const now = new Date();
  const b = req.body || {};
  const slaHoras = SLA[b.prioridad] || SLA.Normal;
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
  let event = null;
  if (patch.estado && patch.estado !== prev.estado) {
    event = 'status';
    next.historialEstados = [...(prev.historialEstados || []), { fecha: now, usuario: _usuario, anterior: prev.estado, nuevo: patch.estado, nota: _nota || '' }];
    if (prev.estado === 'Borrador') {
      next.fechaEnvio = now;
      next.slaHoras = SLA[next.prioridad] || SLA.Normal;
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
  writeData(FILE, readData(FILE).filter((r) => r.id !== req.params.id));
  res.status(204).send();
});

module.exports = router;
