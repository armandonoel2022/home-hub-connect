/**
 * Correo del módulo Operaciones → RRHH (solicitudes de personal).
 * Buzón propio: requerimientos.operaciones@safeone.com.do
 *
 * Variables (.env):
 *   OPS_MAIL_ENABLED=true
 *   OPS_MAIL_USER=requerimientos.operaciones@safeone.com.do
 *   OPS_MAIL_PASS=...
 *   OPS_IMAP_HOST / OPS_IMAP_PORT / OPS_SMTP_HOST / OPS_SMTP_PORT (por defecto los mismos de IT)
 *   INTRANET_URL=https://intranet.safeone.com.do
 */
const { readData, writeData } = require('../config/database');
const { loadDeps } = require('./mailTickets');

const FILE = 'ops-hr-requests.json';
const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);

function config() {
  return {
    enabled: String(env('OPS_MAIL_ENABLED', 'true')).toLowerCase() !== 'false',
    user: env('OPS_MAIL_USER', 'requerimientos.operaciones@safeone.com.do'),
    pass: env('OPS_MAIL_PASS', ''),
    imapHost: env('OPS_IMAP_HOST', env('IT_IMAP_HOST', 'mail.safeone.com.do')),
    imapPort: Number(env('OPS_IMAP_PORT', env('IT_IMAP_PORT', 993))),
    smtpHost: env('OPS_SMTP_HOST', env('IT_SMTP_HOST', 'mail.safeone.com.do')),
    smtpPort: Number(env('OPS_SMTP_PORT', env('IT_SMTP_PORT', 465))),
    intranetUrl: env('INTRANET_URL', 'https://intranet.safeone.com.do'),
    summaryHour: Number(env('OPS_SUMMARY_HOUR', 8)),
  };
}
const isConfigured = () => { const c = config(); return !!(c.enabled && c.user && c.pass); };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

let _transport = null;
async function transport() {
  const d = await loadDeps();
  if (!d.ok) throw new Error(`Faltan dependencias de correo: ${d.error}`);
  if (_transport) return _transport;
  const c = config();
  _transport = d.nodemailer.createTransport({
    host: c.smtpHost, port: c.smtpPort, secure: c.smtpPort === 465,
    auth: { user: c.user, pass: c.pass }, tls: { rejectUnauthorized: false },
  });
  return _transport;
}

async function sendMail({ to, subject, html, urgent }) {
  if (!isConfigured()) return { sent: false, reason: 'Correo de Operaciones no configurado (OPS_MAIL_PASS)' };
  const c = config();
  const list = [...new Set([c.user, ...(to || [])].filter(Boolean).map((e) => e.toLowerCase()))];
  try {
    const info = await (await transport()).sendMail({
      from: `"SafeOne Operaciones → RRHH" <${c.user}>`,
      to: list.join(', '), subject, html,
      text: String(html).replace(/<[^>]+>/g, ' '),
      ...(urgent ? { priority: 'high', headers: { 'X-Priority': '1', Importance: 'high' } } : {}),
    });
    console.log(`[ops-mail] Enviado "${subject}" → ${list.join(', ')}`);
    return { sent: true, messageId: info.messageId };
  } catch (e) {
    console.warn(`[ops-mail] Falló "${subject}": ${e.message}`);
    return { sent: false, reason: e.message };
  }
}

const place = (r) => [r.clienteNombre, r.localidadNombre, r.puestoNombre, r.turnoNombre].filter(Boolean).join(' – ');
const subjectFor = (r, estado) => `[${r.id}] ${estado || r.estado} – ${place(r)}`;

function wrap(r, title, body) {
  const c = config();
  const link = `${c.intranetUrl.replace(/\/$/, '')}/rrhh/operaciones?id=${encodeURIComponent(r.id)}`;
  const row = (k, v) => (v ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">${k}</td><td>${esc(v)}</td></tr>` : '');
  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2430">
  <div style="background:#1f2430;color:#d4af37;padding:14px 18px;font-size:16px;font-weight:600">SafeOne · Operaciones → RRHH</div>
  <div style="padding:18px">
    <h2 style="margin:0 0 12px;font-size:17px">${esc(title)}</h2>
    ${r.requiereCoberturaUrgente ? '<p style="background:#fee2e2;color:#991b1b;padding:8px 12px;font-weight:600">⚠ Requiere cobertura urgente</p>' : ''}
    <table style="font-size:14px;border-collapse:collapse">
      ${row('Solicitud', r.id)}${row('Estado', r.estado)}${row('Tipo', `${r.tipo} · ${r.tipoVacante}`)}
      ${row('Cliente', r.clienteNombre)}${row('Localidad', r.localidadNombre)}${row('Puesto', r.puestoNombre)}${row('Turno', r.turnoNombre)}
      ${row('Supervisor', r.supervisorResponsable)}${row('Agente saliente', r.agenteSalienteNombre)}${row('Motivo', r.motivoBaja)}
      ${row('Fecha efectiva', r.fechaEfectiva)}${row('Prioridad', r.prioridad)}${row('Límite SLA', r.fechaLimiteSLA ? new Date(r.fechaLimiteSLA).toLocaleString('es-DO') : '')}
      ${row('Creado por', r.creadoPor)}
    </table>
    ${body || ''}
    <p style="margin-top:18px"><a href="${link}" style="background:#d4af37;color:#1f2430;padding:10px 16px;text-decoration:none;font-weight:600">Ver solicitud en la Intranet</a></p>
  </div>
  <div style="padding:12px 18px;background:#f4f4f5;font-size:12px;color:#6b7280">Puede responder a este correo: su respuesta se agregará como comentario a la solicitud ${esc(r.id)}.</div>
</div>`;
}

function recipients(r) {
  return [r.creadoPorEmail, r.supervisorEmail, r.rrhhAsignadoEmail].filter(Boolean);
}

async function notify(r, event, extra = {}) {
  let title = '', body = '';
  if (event === 'created') title = `Nueva solicitud de ${r.tipo} enviada a RRHH`;
  else if (event === 'status') title = `Estado actualizado: ${r.estado}`;
  else if (event === 'comment') title = `Nuevo comentario de ${extra.autor || ''}`;
  const note = extra.comentario || extra.nota;
  if (note) body = `<p style="background:#f9fafb;border-left:3px solid #d4af37;padding:8px 12px;margin-top:12px">${esc(note)}</p>`;
  return sendMail({ to: recipients(r), subject: subjectFor(r), html: wrap(r, title, body), urgent: r.requiereCoberturaUrgente });
}

// ─── Respuestas por correo → comentarios ───
async function syncReplies() {
  if (!isConfigured()) return { ok: false, message: 'No configurado' };
  const d = await loadDeps();
  if (!d.ok) return { ok: false, message: d.error };
  const c = config();
  const client = new d.ImapFlow({ host: c.imapHost, port: c.imapPort, secure: true, auth: { user: c.user, pass: c.pass }, tls: { rejectUnauthorized: false }, logger: false });
  client.on('error', (e) => console.warn(`[ops-mail] IMAP: ${e?.message || e}`));
  let added = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = ((await client.search({ seen: false }, { uid: true })) || []).slice(-30);
      for (const uid of uids) {
        try {
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
          await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true }).catch(() => {});
          if (!msg?.source) continue;
          const mail = await d.simpleParser(msg.source);
          const from = mail.from?.value?.[0] || {};
          if ((from.address || '').toLowerCase() === c.user.toLowerCase()) continue;
          const m = String(mail.subject || '').match(/\[(OPS-RRHH-\d+)\]/i);
          if (!m) continue;
          const list = readData(FILE);
          const r = list.find((x) => x.id.toUpperCase() === m[1].toUpperCase());
          if (!r) continue;
          const text = String(mail.text || '').split(/\n\s*(?:El .+escribió:|On .+wrote:|-----Original|De:\s)/i)[0].trim().slice(0, 4000);
          if (!text) continue;
          r.comentarios = r.comentarios || [];
          r.comentarios.push({ id: `CMT-${Date.now()}-${added}`, autor: from.name || from.address, autorEmail: from.address, texto: text, fecha: new Date().toISOString(), origen: 'correo' });
          r.updatedAt = new Date().toISOString();
          writeData(FILE, list);
          added++;
        } catch (e) { console.warn(`[ops-mail] mensaje ${uid}: ${e.message}`); }
      }
    } finally { lock.release(); }
    await client.logout().catch(() => {});
  } catch (e) {
    return { ok: false, message: e.message };
  }
  return { ok: true, added };
}

// ─── Resumen diario a RRHH ───
const CLOSED = ['Cubierta satisfactoriamente', 'Cerrada sin cobertura', 'Cancelada por Operaciones', 'Borrador'];
let _lastSummary = '';
async function dailySummary(force = false) {
  const c = config();
  const now = new Date();
  const key = now.toISOString().slice(0, 10);
  if (!force && (now.getHours() !== c.summaryHour || _lastSummary === key)) return null;
  _lastSummary = key;
  const open = readData(FILE).filter((r) => !CLOSED.includes(r.estado));
  const rows = open.map((r) => `<tr><td>${esc(r.id)}</td><td>${esc(r.estado)}</td><td>${esc(r.tipo)}</td><td>${esc(place(r))}</td><td>${esc(r.prioridad)}</td><td>${r.fechaLimiteSLA ? new Date(r.fechaLimiteSLA).toLocaleString('es-DO') : ''}</td></tr>`).join('');
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif"><h2>Pendientes del día — ${key}</h2><p>${open.length} solicitud(es) abiertas.</p>
    <table border="1" cellpadding="6" style="border-collapse:collapse;font-size:13px"><tr><th>ID</th><th>Estado</th><th>Tipo</th><th>Ubicación</th><th>Prioridad</th><th>Límite SLA</th></tr>${rows}</table></div>`;
  return sendMail({ to: [], subject: `Resumen diario Operaciones → RRHH (${open.length} pendientes)`, html });
}

function start() {
  if (!isConfigured()) { console.log('[ops-mail] Deshabilitado (falta OPS_MAIL_PASS en .env)'); return; }
  let running = false;
  setInterval(async () => {
    if (running) return; running = true;
    try { await syncReplies(); await dailySummary(); } catch (e) { console.warn(`[ops-mail] ${e.message}`); }
    running = false;
  }, 2 * 60 * 1000);
  console.log('[ops-mail] Activo (respuestas cada 2 min, resumen diario 8:00)');
}

module.exports = { config, isConfigured, notify, syncReplies, dailySummary, start, FILE };
