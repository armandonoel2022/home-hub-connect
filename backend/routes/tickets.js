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

router.post('/mail/sync', auth, async (req, res) => {
  try {
    const result = await mail.syncInbox({ limit: Number(req.body?.limit) || 25 });
    res.status(result.ok ? 200 : 400).json(result);
  } catch (e) { res.status(502).json({ message: e.message }); }
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
      const p = isCreate
        ? mail.notifyTicketCreated(body)
        : (statusChanged ? mail.notifyTicketUpdated(body, { statusChanged: true }) : null);
      if (p) Promise.resolve(p).catch(() => {});
    }
    return json(body);
  };
  next();
});

router.use('/', createCrudRoutes(TICKETS_FILE, 'TK'));

module.exports = router;
