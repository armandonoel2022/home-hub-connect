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
  // Si no hay buzón propio de Operaciones (OPS_MAIL_PASS), se reutiliza el buzón
  // de Tickets IT (IT_MAIL_USER/IT_MAIL_PASS), que ya funciona en el servidor.
  const own = !!env('OPS_MAIL_PASS', '');
  const shared = !own && !!env('IT_MAIL_PASS', '');
  return {
    enabled: String(env('OPS_MAIL_ENABLED', 'true')).toLowerCase() !== 'false',
    shared,
    user: own ? env('OPS_MAIL_USER', 'requerimientos.operaciones@safeone.com.do') : shared ? env('IT_MAIL_USER', 'ticketsit@safeone.com.do') : '',
    pass: own ? env('OPS_MAIL_PASS', '') : shared ? env('IT_MAIL_PASS', '') : '',
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
  if (!isConfigured()) return { sent: false, reason: 'Correo no configurado: falta OPS_MAIL_PASS (o IT_MAIL_PASS) en el .env del servidor' };
  const c = config();
  const list = [...new Set([c.shared ? null : c.user, ...(to || [])].filter(Boolean).map((e) => e.toLowerCase()))];
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

const SETTINGS_FILE = 'ops-hr-settings.json';
const DEFAULT_RRHH = ['daguasvivas@safeone.com.do', 'alira@safeone.com.do', 'nperez@safeone.com.do', 'abrito@safeone.com.do'];
function getSettings() {
  const s = readData(SETTINGS_FILE);
  const obj = Array.isArray(s) ? s[0] : s;
  return { rrhhRecipients: obj && Array.isArray(obj.rrhhRecipients) ? obj.rrhhRecipients : DEFAULT_RRHH };
}
function saveSettings(obj) { writeData(SETTINGS_FILE, [obj]); }
function recipients(r) {
  return [r.creadoPorEmail, r.supervisorEmail, r.rrhhAsignadoEmail, ...getSettings().rrhhRecipients].filter(Boolean);
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

// ─── Aviso al CLIENTE al concluir el cambio/sustitución (opcional) ───
async function notifyClient(r) {
  if (!r.notificarCliente || !r.clienteEmail) return null;
  const accion = r.tipo === 'Ingreso' ? 'la incorporación de personal' : r.tipo === 'Salida' ? 'el retiro de personal' : 'la sustitución de personal';
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;max-width:640px">
    <h2 style="color:#1f2937;border-bottom:3px solid #d4af37;padding-bottom:6px">SafeOne — Notificación de servicio</h2>
    <p>Estimado cliente <b>${esc(r.clienteNombre)}</b>:</p>
    <p>Le informamos que hemos completado ${accion} en su servicio:</p>
    <table cellpadding="6" style="font-size:14px"><tr><td><b>Localidad</b></td><td>${esc(r.localidadNombre)}</td></tr>
    <tr><td><b>Puesto</b></td><td>${esc(r.puestoNombre)}</td></tr><tr><td><b>Turno</b></td><td>${esc(r.turnoNombre)}</td></tr>
    <tr><td><b>Fecha efectiva</b></td><td>${esc(r.fechaEfectiva || '')}</td></tr>
    ${r.agentePropuestoNombre ? `<tr><td><b>Agente asignado</b></td><td>${esc(r.agentePropuestoNombre)}</td></tr>` : ''}</table>
    <p>Para cualquier inquietud, puede responder a este correo o contactar a su supervisor asignado.</p>
    <p>Atentamente,<br/><b>Departamento de Operaciones — SafeOne</b></p></div>`;
  return sendMail({ to: [r.clienteEmail], subject: `SafeOne — Actualización de personal en ${r.localidadNombre || r.clienteNombre}`, html });
}

// ─── Respuestas por correo → comentarios ───
// Agrega un correo ya parseado como comentario si su asunto trae [OPS-RRHH-xxxxxx].
// Lo usa también el buzón de Tickets IT cuando ambos módulos comparten buzón.
function addReplyFromMail(mail) {
  const from = mail.from?.value?.[0] || {};
  const m = String(mail.subject || '').match(/\[(OPS-RRHH-\d+)\]/i);
  if (!m) return false;
  const list = readData(FILE);
  const r = list.find((x) => String(x.id).toUpperCase() === m[1].toUpperCase());
  if (!r) return true;
  const text = String(mail.text || '').split(/\n\s*(?:El .+escribió:|On .+wrote:|-----Original|De:\s)/i)[0].trim().slice(0, 4000);
  if (!text) return true;
  r.comentarios = r.comentarios || [];
  r.comentarios.push({ id: `CMT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, autor: from.name || from.address, autorEmail: from.address, texto: text, fecha: new Date().toISOString(), origen: 'correo' });
  r.updatedAt = new Date().toISOString();
  writeData(FILE, list);
  return true;
}

async function syncReplies() {
  if (!isConfigured()) return { ok: false, message: 'No configurado' };
  if (config().shared) return { ok: true, added: 0, message: 'Buzón compartido con Tickets IT: las respuestas se procesan allí' };
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
          if (!addReplyFromMail(mail)) continue;
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
  return sendMail({ to: getSettings().rrhhRecipients, subject: `Resumen diario Operaciones → RRHH (${open.length} pendientes)`, html });
}

// ─── Alertas de SLA: aviso al 80% del tiempo y al vencer ───
async function slaAlerts() {
  const list = readData(FILE);
  const now = Date.now();
  let sent = 0, changed = false;
  for (const r of list) {
    if (CLOSED.includes(r.estado) || !r.fechaLimiteSLA) continue;
    const due = new Date(r.fechaLimiteSLA).getTime();
    const total = (r.slaHoras || 0) * 3600e3;
    if (!due || !total) continue;
    // Si la fecha límite cambió (p. ej. cambio de prioridad), reiniciar avisos
    if (r._slaAlertFor !== r.fechaLimiteSLA) { r._slaAlertFor = r.fechaLimiteSLA; r._slaWarned = false; r._slaExpired = false; changed = true; }
    const remainingH = Math.max(0, Math.round((due - now) / 36e5 * 10) / 10);
    let title = '', body = '';
    if (now >= due && !r._slaExpired) {
      title = `⛔ SLA VENCIDO — solicitud ${r.prioridad}`;
      body = `<p style="background:#fef2f2;border-left:3px solid #dc2626;padding:8px 12px;margin-top:12px">El límite de atención venció el <b>${new Date(due).toLocaleString('es-DO')}</b> y la solicitud sigue en estado <b>${esc(r.estado)}</b>. Favor priorizar su cobertura.</p>`;
      r._slaExpired = true; r._slaWarned = true;
    } else if (now < due && now >= due - total * 0.2 && !r._slaWarned) {
      title = `⚠️ SLA por vencer — quedan ${remainingH} h`;
      body = `<p style="background:#fffbeb;border-left:3px solid #d97706;padding:8px 12px;margin-top:12px">Esta solicitud ha consumido el 80% de su tiempo de atención. Límite: <b>${new Date(due).toLocaleString('es-DO')}</b>. Estado actual: <b>${esc(r.estado)}</b>.</p>`;
      r._slaWarned = true;
    } else continue;
    changed = true;
    r.historialEstados = r.historialEstados || [];
    r.historialEstados.push({ fecha: new Date().toISOString(), usuario: 'Sistema', anterior: r.estado, nuevo: r.estado, nota: r._slaExpired ? 'Alerta: SLA vencido' : 'Alerta: SLA por vencer (80%)' });
    try { await sendMail({ to: recipients(r), subject: `${subjectFor(r)} — ${r._slaExpired ? 'SLA VENCIDO' : 'SLA por vencer'}`, html: wrap(r, title, body), urgent: true }); sent++; }
    catch (e) { console.warn(`[ops-mail] SLA ${r.id}: ${e.message}`); }
  }
  if (changed) writeData(FILE, list);
  return { ok: true, sent };
}

function start() {
  if (!isConfigured()) { console.log('[ops-mail] Deshabilitado (falta OPS_MAIL_PASS o IT_MAIL_PASS en .env)'); return; }
  const c = config();
  console.log(`[ops-mail] Enviando desde ${c.user}${c.shared ? ' (buzón compartido con Tickets IT)' : ''}`);
  let running = false;
  setInterval(async () => {
    if (running) return; running = true;
    try { await syncReplies(); await slaAlerts(); await dailySummary(); } catch (e) { console.warn(`[ops-mail] ${e.message}`); }
    running = false;
  }, 2 * 60 * 1000);
  console.log('[ops-mail] Activo (respuestas cada 2 min, alertas SLA, resumen diario 8:00)');
}

module.exports = { getSettings, saveSettings, DEFAULT_RRHH, config, isConfigured, notify, notifyClient, syncReplies, addReplyFromMail, dailySummary, slaAlerts, start, FILE };
