/**
 * Integración de correo (IMAP + SMTP) para los Tickets de IT.
 *
 * Buzón: tecnologia@safeone.com.do
 *   IMAP  mail.safeone.com.do:993 (SSL)
 *   SMTP  mail.safeone.com.do:465 (SSL)
 *
 * Credenciales SIEMPRE por variables de entorno (backend/.env):
 *   IT_MAIL_USER, IT_MAIL_PASS, IT_IMAP_HOST, IT_IMAP_PORT,
 *   IT_SMTP_HOST, IT_SMTP_PORT, IT_MAIL_POLL_MINUTES, IT_MAIL_ENABLED
 *
 * Flujo bidireccional:
 *   Entrada  → cada correo no leído crea un ticket (o agrega un comentario al
 *              hilo si el asunto trae la referencia [TK-XXXX]).
 *   Salida   → acuse de recibo al crear, y notificación en cada actualización
 *              (comentario nuevo, cambio de estado o cierre).
 *
 * Dependencias opcionales: imapflow, mailparser, nodemailer.
 * Si no están instaladas, el módulo queda inactivo sin romper el servidor.
 */
const { readData, writeData, generateId } = require('../config/database');

const TICKETS_FILE = 'tickets.json';

const env = (k, d) => {
  const v = process.env[k];
  return v !== undefined && v !== '' ? v : d;
};

function config() {
  return {
    enabled: String(env('IT_MAIL_ENABLED', 'true')).toLowerCase() !== 'false',
    user: env('IT_MAIL_USER', 'tecnologia@safeone.com.do'),
    pass: env('IT_MAIL_PASS', ''),
    imapHost: env('IT_IMAP_HOST', 'mail.safeone.com.do'),
    imapPort: Number(env('IT_IMAP_PORT', 993)),
    smtpHost: env('IT_SMTP_HOST', 'mail.safeone.com.do'),
    smtpPort: Number(env('IT_SMTP_PORT', 465)),
    pollMinutes: Number(env('IT_MAIL_POLL_MINUTES', 5)),
    department: env('IT_MAIL_DEPARTMENT', 'Tecnología y Monitoreo'),
    assignee: env('IT_MAIL_ASSIGNEE', 'Armando Noel'),
  };
}

function isConfigured() {
  const c = config();
  return !!(c.enabled && c.user && c.pass && c.imapHost && c.smtpHost);
}

function deps() {
  try {
    return {
      ImapFlow: require('imapflow').ImapFlow,
      simpleParser: require('mailparser').simpleParser,
      nodemailer: require('nodemailer'),
      ok: true,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── SLA por prioridad (política interna SafeOne) ───
const SLA_HOURS = { Crítica: 2, Alta: 8, Media: 24, Baja: 72 };

function detectPriority(text) {
  const t = String(text || '').toLowerCase();
  if (/(urgente|crítico|critico|caído|caido|no funciona nada|emergencia)/.test(t)) return 'Crítica';
  if (/(alta prioridad|bloquea|no puedo trabajar|urge)/.test(t)) return 'Alta';
  if (/(cuando pueda|sin prisa|baja prioridad)/.test(t)) return 'Baja';
  return 'Media';
}

function detectCategory(text) {
  const t = String(text || '').toLowerCase();
  if (/(impres|toner|scanner|escáner)/.test(t)) return 'Impresoras';
  if (/(correo|outlook|email|buzón|buzon)/.test(t)) return 'Correo';
  if (/(red|internet|wifi|vpn|cableado)/.test(t)) return 'Redes';
  if (/(laptop|computadora|pc|monitor|teclado|mouse|equipo)/.test(t)) return 'Hardware';
  if (/(sistema|intranet|aplicación|aplicacion|software|licencia)/.test(t)) return 'Software';
  return 'Soporte General';
}

const stripRe = (s) => String(s || '').replace(/^\s*((re|rv|fwd|fw)\s*:\s*)+/i, '').trim();
const ticketRefFrom = (subject) => {
  const m = String(subject || '').match(/\[(TK-[A-Za-z0-9-]+)\]/i);
  return m ? m[1].toUpperCase() : null;
};

function slaDeadline(priority, from = new Date()) {
  const h = SLA_HOURS[priority] ?? 24;
  return new Date(from.getTime() + h * 3600 * 1000).toISOString();
}

// ─── SMTP ───
let _transport = null;
function transport() {
  const d = deps();
  if (!d.ok) throw new Error(`Faltan dependencias de correo: ${d.error}`);
  if (_transport) return _transport;
  const c = config();
  _transport = d.nodemailer.createTransport({
    host: c.smtpHost,
    port: c.smtpPort,
    secure: c.smtpPort === 465,
    auth: { user: c.user, pass: c.pass },
    tls: { rejectUnauthorized: false },
  });
  return _transport;
}

function wrapHtml(title, bodyHtml) {
  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2430">
  <div style="background:#1f2430;color:#d4af37;padding:14px 18px;font-size:16px;font-weight:600">SafeOne · Soporte Tecnología</div>
  <div style="padding:18px">
    <h2 style="margin:0 0 12px;font-size:17px;color:#1f2430">${title}</h2>
    ${bodyHtml}
  </div>
  <div style="padding:12px 18px;background:#f4f4f5;font-size:12px;color:#6b7280">
    Responde a este correo para agregar información al ticket. Mantén la referencia del asunto.
  </div>
</div>`;
}

async function sendMail({ to, subject, html, text }) {
  if (!isConfigured()) return { sent: false, reason: 'Correo IT no configurado' };
  if (!to) return { sent: false, reason: 'Sin destinatario' };
  const c = config();
  const info = await transport().sendMail({
    from: `"SafeOne Soporte IT" <${c.user}>`,
    to, subject, html, text: text || String(html).replace(/<[^>]+>/g, ' '),
  });
  return { sent: true, messageId: info.messageId };
}

const subjectFor = (ticket, prefix) => `${prefix} [${ticket.id}] ${ticket.title}`;

async function notifyTicketCreated(ticket) {
  if (!ticket?.requesterEmail) return { sent: false, reason: 'Ticket sin correo del solicitante' };
  return sendMail({
    to: ticket.requesterEmail,
    subject: subjectFor(ticket, 'Ticket recibido'),
    html: wrapHtml('Hemos recibido tu solicitud', `
      <p>Hola ${ticket.createdBy || ''}, tu solicitud fue registrada como <b>${ticket.id}</b>.</p>
      <table style="font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 10px 4px 0;color:#6b7280">Asunto</td><td>${ticket.title}</td></tr>
        <tr><td style="padding:4px 10px 4px 0;color:#6b7280">Categoría</td><td>${ticket.category}</td></tr>
        <tr><td style="padding:4px 10px 4px 0;color:#6b7280">Prioridad</td><td>${ticket.priority}</td></tr>
        <tr><td style="padding:4px 10px 4px 0;color:#6b7280">Atención estimada</td><td>${ticket.slaHours} horas</td></tr>
      </table>`),
  });
}

async function notifyTicketUpdated(ticket, { comment, statusChanged } = {}) {
  if (!ticket?.requesterEmail) return { sent: false, reason: 'Ticket sin correo del solicitante' };
  const closed = /cerrad|resuelt/i.test(String(ticket.status || ''));
  const title = closed ? 'Tu ticket fue cerrado' : 'Actualización de tu ticket';
  return sendMail({
    to: ticket.requesterEmail,
    subject: subjectFor(ticket, closed ? 'Ticket cerrado' : 'Actualización'),
    html: wrapHtml(title, `
      <p>Ticket <b>${ticket.id}</b> — ${ticket.title}</p>
      ${statusChanged ? `<p>Nuevo estado: <b>${ticket.status}</b></p>` : ''}
      ${comment ? `<p style="background:#f9fafb;border-left:3px solid #d4af37;padding:8px 12px">${comment}</p>` : ''}`),
  });
}

// ─── IMAP: lectura y creación de tickets ───
async function syncInbox({ limit = 25 } = {}) {
  if (!isConfigured()) return { ok: false, message: 'Correo IT no configurado (revisa IT_MAIL_* en backend/.env)' };
  const d = deps();
  if (!d.ok) return { ok: false, message: `Faltan dependencias: ${d.error}. Ejecuta: npm i imapflow mailparser nodemailer` };

  const c = config();
  const client = new d.ImapFlow({
    host: c.imapHost, port: c.imapPort, secure: true,
    auth: { user: c.user, pass: c.pass },
    tls: { rejectUnauthorized: false },
    logger: false,
  });

  const created = [];
  const replies = [];
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    let uids = [];
    try { uids = await client.search({ seen: false }) || []; } catch { uids = []; }
    uids = uids.slice(-limit);

    for (const uid of uids) {
      const msg = await client.fetchOne(uid, { source: true }, { uid: true });
      if (!msg) continue;
      const mail = await d.simpleParser(msg.source);
      const fromAddr = mail.from?.value?.[0]?.address || '';
      const fromName = mail.from?.value?.[0]?.name || fromAddr;
      const subject = stripRe(mail.subject) || '(Sin asunto)';
      const body = (mail.text || '').trim() ||
        String(mail.html || '').replace(/<[^>]+>/g, ' ').trim();

      // Ignora correos enviados por el propio buzón (evita bucles con los acuses).
      if (fromAddr.toLowerCase() === c.user.toLowerCase()) {
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        continue;
      }

      const tickets = readData(TICKETS_FILE) || [];
      const ref = ticketRefFrom(mail.subject);
      const existing = ref ? tickets.find((t) => String(t.id).toUpperCase() === ref) : null;

      if (existing) {
        existing.comments = existing.comments || [];
        existing.comments.push({
          id: `CM-${Date.now()}`,
          userId: 'email',
          userName: fromName,
          content: body.slice(0, 4000),
          timestamp: new Date().toISOString(),
          source: 'email',
        });
        existing.updatedAt = new Date().toISOString();
        writeData(TICKETS_FILE, tickets);
        replies.push(existing.id);
      } else {
        const priority = detectPriority(`${subject} ${body}`);
        const now = new Date();
        const ticket = {
          id: generateId('TK', tickets),
          title: subject,
          description: body.slice(0, 8000),
          category: detectCategory(`${subject} ${body}`),
          priority,
          status: 'Abierto',
          createdBy: fromName,
          requesterEmail: fromAddr,
          assignedTo: c.assignee,
          department: c.department,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          slaHours: SLA_HOURS[priority] ?? 24,
          slaDeadline: slaDeadline(priority, now),
          attachments: (mail.attachments || []).map((a) => a.filename).filter(Boolean),
          comments: [],
          source: 'email',
          emailMessageId: mail.messageId || null,
        };
        tickets.push(ticket);
        writeData(TICKETS_FILE, tickets);
        created.push(ticket.id);
        try { await notifyTicketCreated(ticket); } catch { /* el acuse no debe bloquear */ }
      }

      await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }

  return { ok: true, created, replies, count: created.length + replies.length, at: new Date().toISOString() };
}

// ─── Estado y polling automático ───
let _timer = null;
let _last = null;

async function status() {
  const c = config();
  const d = deps();
  return {
    configured: isConfigured(),
    dependencies: d.ok,
    dependenciesError: d.ok ? null : d.error,
    user: c.user,
    imap: `${c.imapHost}:${c.imapPort}`,
    smtp: `${c.smtpHost}:${c.smtpPort}`,
    pollMinutes: c.pollMinutes,
    polling: !!_timer,
    lastSync: _last,
  };
}

function startPolling() {
  const c = config();
  if (_timer || !isConfigured() || !deps().ok || !(c.pollMinutes > 0)) return false;
  const run = async () => {
    try { _last = await syncInbox(); }
    catch (e) { _last = { ok: false, message: e.message, at: new Date().toISOString() }; }
  };
  _timer = setInterval(run, c.pollMinutes * 60 * 1000);
  run();
  return true;
}

module.exports = {
  config, isConfigured, status, syncInbox, sendMail,
  notifyTicketCreated, notifyTicketUpdated, startPolling,
  SLA_HOURS,
  get lastSync() { return _last; },
};
