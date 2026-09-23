/**
 * Tickets de IT + integración con el buzón tecnologia@safeone.com.do.
 *
 * Mantiene el CRUD genérico basado en archivos y añade:
 *   GET  /mail/status  → estado de la conexión IMAP/SMTP
 *   POST /mail/sync    → lee el buzón y crea/actualiza tickets
 *   POST /:id/reply    → responde al solicitante por correo y deja comentario
 *
 * Además notifica por SMTP al crear un ticket y en cada actualización.
 */
const express = require('express');
const auth = require('../middleware/auth');
const { readData, writeData } = require('../config/database');
const { createCrudRoutes } = require('../helpers/crud');
const mail = require('../services/mailTickets');

const router = express.Router();
const TICKETS_FILE = 'tickets.json';

// ─── Correo ───
router.get('/mail/status', auth, async (req, res) => {
  try { res.json(await mail.status()); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/mail/test', auth, async (req, res) => {
  try { res.json(await mail.testConnection()); }
  catch (e) { res.status(502).json({ ok: false, message: e.message }); }
});

router.post('/mail/sync', auth, async (req, res) => {
  try {
    const result = await mail.syncInbox({ limit: Number(req.body?.limit) || 25 });
    res.status(result.ok ? 200 : 400).json(result);
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Técnicos designados (solo anoel@safeone.com.do / TI) ───
const SETTINGS_FILE = 'ticket-settings.json';
const OWNER_EMAILS = ['anoel@safeone.com.do', 'tecnologia@safeone.com.do'];
router.get('/settings', auth, (req, res) => {
  const s = readData(SETTINGS_FILE);
  res.json(s && !Array.isArray(s) ? s : { agents: [] });
});
router.put('/settings', auth, (req, res) => {
  const email = String(req.user?.email || '').toLowerCase();
  if (!OWNER_EMAILS.includes(email)) return res.status(403).json({ message: 'Solo el responsable de Tecnología puede designar técnicos' });
  const agents = (Array.isArray(req.body?.agents) ? req.body.agents : [])
    .filter((a) => a && a.email)
    .map((a) => ({ id: a.id ? String(a.id) : undefined, email: String(a.email).trim(), name: String(a.name || a.email).trim() }));
  const data = { agents, updatedAt: new Date().toISOString(), updatedBy: email };
  writeData(SETTINGS_FILE, data);
  res.json(data);
});

// Responder al solicitante por correo (queda registrado como comentario)
router.post('/:id/reply', auth, async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ message: 'Mensaje requerido' });
  const tickets = readData(TICKETS_FILE) || [];
  const t = tickets.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ message: 'Ticket no encontrado' });
  try {
    const sent = await mail.notifyTicketUpdated(t, { comment: message });
    t.comments = t.comments || [];
    t.comments.push({
      id: `CM-${Date.now()}`,
      userId: req.user.id,
      userName: req.user.email,
      content: message,
      timestamp: new Date().toISOString(),
      source: 'intranet',
    });
    t.updatedAt = new Date().toISOString();
    writeData(TICKETS_FILE, tickets);
    res.json({ ticket: t, mail: sent });
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Notificaciones automáticas sobre el CRUD ───
router.use((req, res, next) => {
  const isCreate = req.method === 'POST' && req.path === '/';
  const isUpdate = req.method === 'PUT';
  if (!isCreate && !isUpdate) return next();

  const prev = isUpdate
    ? (readData(TICKETS_FILE) || []).find((t) => `/${t.id}` === req.path)
    : null;

  const json = res.json.bind(res);
  res.json = (body) => {
    if (body && body.id && body.requesterEmail) {
      const statusChanged = !!prev && prev.status !== body.status;
      // Correos al usuario: solo "Recibido", "En Espera" y cierre.
      const notifiable = /espera|cerrad|resuelt/i.test(String(body.status || ''));
      const p = isCreate
        ? mail.notifyTicketCreated(body)
        : (statusChanged && notifiable ? mail.notifyTicketUpdated(body, { statusChanged: true }) : null);
      if (p) Promise.resolve(p).catch(() => {});
    }
    return json(body);
  };
  next();
});

router.use('/', createCrudRoutes(TICKETS_FILE, 'TK'));

module.exports = router;
