/**
 * Formularios de TI (F-IT-01 Alta, F-IT-02 Baja, F-IT-03 Cambio de permisos, F-IT-04 Equipo en dominio).
 * - Se guardan en it-forms.json y como documento HTML imprimible en DATA_DIR/formularios-ti/<código>/<id>.html
 * - Se notifican por correo desde el buzón de Tickets IT (ticketsit@safeone.com.do, misma configuración IT_MAIL_*).
 * - La sección "Uso exclusivo de TI" la completa Tecnología.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { readData, writeData, DATA_DIR } = require('../config/database');
const auth = require('../middleware/auth');
const mail = require('../services/mailTickets');

const router = express.Router();
const FILE = 'it-forms.json';
const DOC_DIR = path.join(DATA_DIR, 'formularios-ti');
const TYPES = {
  'F-IT-01': 'Solicitud de Alta de Usuario',
  'F-IT-02': 'Solicitud de Baja de Usuario',
  'F-IT-03': 'Solicitud de Cambios de Permisos',
  'F-IT-04': 'Registro de Equipos en Dominio',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function loadUser(req) {
  return (readData('users.json') || []).find((u) => u.id === req.user?.id) || null;
}
function isIT(req) {
  const u = loadUser(req);
  const email = norm(req.user?.email);
  return !!req.user?.isAdmin || ['tecnologia@safeone.com.do', 'anoel@safeone.com.do'].includes(email) || norm(u?.department).includes('tecnolog');
}

/** sections: [{ title, fields: [{ label, value }] }] — se limpian y limitan. */
function cleanSections(input) {
  if (!Array.isArray(input) || !input.length || input.length > 12) return null;
  return input.map((s) => ({
    title: String(s?.title || '').slice(0, 120),
    fields: (Array.isArray(s?.fields) ? s.fields : []).slice(0, 40).map((f) => ({
      label: String(f?.label || '').slice(0, 160),
      value: String(f?.value ?? '').slice(0, 2000),
    })),
  }));
}

function renderHtml(r) {
  const block = (s) => `<h3>${esc(s.title)}</h3><table>${s.fields.map((f) =>
    `<tr><td class="l">${esc(f.label)}</td><td>${esc(f.value) || '—'}</td></tr>`).join('')}</table>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(r.codigo)} ${esc(r.id)}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:24px auto;color:#1f2937}
header{border-bottom:3px solid #d4af37;padding-bottom:8px;margin-bottom:16px}
h1{font-size:18px;margin:0}h2{font-size:15px;margin:4px 0;color:#14213d}h3{font-size:13px;background:#14213d;color:#fff;padding:6px 8px;margin:18px 0 0}
table{width:100%;border-collapse:collapse;font-size:13px}td{border:1px solid #d1d5db;padding:6px 8px;vertical-align:top}td.l{width:38%;background:#f9fafb;font-weight:bold}
.meta{font-size:12px;color:#6b7280}.firma{margin-top:40px;display:flex;justify-content:space-between}.firma div{width:45%;border-top:1px solid #6b7280;text-align:center;font-size:12px;padding-top:4px}
@media print{body{margin:0}}</style></head><body>
<header><h1>SAFEONE SECURITY COMPANY</h1><h2>FORMULARIO: ${esc(r.codigo)} — ${esc(TYPES[r.codigo]).toUpperCase()}</h2>
<div class="meta">No. ${esc(r.id)} · Registrado el ${new Date(r.createdAt).toLocaleString('es-DO')} por ${esc(r.creadoPor)} · Estado: ${esc(r.estado)}</div></header>
${r.sections.map(block).join('')}
${r.ti ? block({ title: 'Uso exclusivo de TI', fields: r.ti.fields }) + `<p class="meta">Completado por ${esc(r.ti.by)} el ${new Date(r.ti.at).toLocaleString('es-DO')}</p>` : '<h3>Uso exclusivo de TI</h3><p class="meta">Pendiente de completar por Tecnología.</p>'}
<div class="firma"><div>Firma del Solicitante<br>${esc(r.creadoPor)}</div><div>Responsable de TI<br>${esc(r.ti?.by || '')}</div></div>
</body></html>`;
}

function saveDocument(r) {
  const dir = path.join(DOC_DIR, r.codigo);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${r.id}.html`);
  fs.writeFileSync(file, renderHtml(r), 'utf8');
  return path.relative(DATA_DIR, file);
}

function mailBody(r, intro) {
  const rows = r.sections.flatMap((s) => s.fields).filter((f) => f.value)
    .map((f) => `<tr><td style="padding:3px 10px 3px 0;color:#6b7280">${esc(f.label)}</td><td>${esc(f.value)}</td></tr>`).join('');
  return `<div style="font-family:Arial,sans-serif;font-size:14px"><h3 style="color:#14213d">${esc(r.codigo)} · ${esc(TYPES[r.codigo])} (${esc(r.id)})</h3>
<p>${intro}</p><table style="font-size:13px;border-collapse:collapse">${rows}</table>
<p style="color:#6b7280;font-size:12px">Documento archivado en el servidor: ${esc(r.archivo)}. No responda a este correo.</p></div>`;
}

async function notify(r, subjectPrefix, intro, extraTo = []) {
  try {
    const itBox = mail.config().user;
    const to = [...new Set([itBox, r.creadoPorEmail, ...extraTo].filter(Boolean))].join(',');
    return await mail.sendMail({ to, subject: `${subjectPrefix} [${r.id}] ${r.codigo} ${TYPES[r.codigo]}`, html: mailBody(r, intro) });
  } catch (e) { return { sent: false, reason: e.message }; }
}

router.get('/', auth, (req, res) => {
  const all = readData(FILE) || [];
  res.json(isIT(req) ? all : all.filter((r) => r.creadoPorId === req.user.id));
});

router.get('/:id/document', auth, (req, res) => {
  const r = (readData(FILE) || []).find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ message: 'No encontrado' });
  if (!isIT(req) && r.creadoPorId !== req.user.id) return res.status(403).json({ message: 'Sin acceso' });
  res.type('html').send(renderHtml(r));
});

router.post('/', auth, async (req, res) => {
  const { codigo, sections, resumen } = req.body || {};
  if (!TYPES[codigo]) return res.status(400).json({ message: 'Formulario no válido' });
  const clean = cleanSections(sections);
  if (!clean) return res.status(400).json({ message: 'Formulario vacío' });
  const list = readData(FILE) || [];
  const max = list.reduce((m, r) => Math.max(m, Number(String(r.id).replace(/\D/g, '')) || 0), 0);
  const u = loadUser(req);
  const now = new Date().toISOString();
  const r = {
    id: `FIT-${String(max + 1).padStart(6, '0')}`, codigo, titulo: TYPES[codigo],
    resumen: String(resumen || '').slice(0, 200), sections: clean, estado: 'Pendiente TI', ti: null,
    creadoPor: u?.fullName || req.user.email, creadoPorId: req.user.id, creadoPorEmail: u?.email || req.user.email,
    createdAt: now, updatedAt: now,
  };
  r.archivo = saveDocument(r);
  list.unshift(r);
  writeData(FILE, list);
  r._mail = await notify(r, 'Nuevo formulario', `Se registró un nuevo formulario de TI por <b>${esc(r.creadoPor)}</b>. Tecnología debe completar la sección de uso exclusivo de TI.`);
  res.status(201).json(r);
});

router.put('/:id/ti', auth, async (req, res) => {
  if (!isIT(req)) return res.status(403).json({ message: 'Solo Tecnología puede completar esta sección' });
  const list = readData(FILE) || [];
  const idx = list.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
  const sec = cleanSections([{ title: 'TI', fields: req.body?.fields }]);
  if (!sec) return res.status(400).json({ message: 'Datos de TI inválidos' });
  const u = loadUser(req);
  const r = { ...list[idx], ti: { fields: sec[0].fields, by: u?.fullName || req.user.email, at: new Date().toISOString() }, estado: 'Completado por TI', updatedAt: new Date().toISOString() };
  r.archivo = saveDocument(r);
  list[idx] = r;
  writeData(FILE, list);
  r._mail = await notify(r, 'Formulario completado', `Tecnología completó el formulario. Responsable: <b>${esc(r.ti.by)}</b>.`);
  res.json(r);
});

module.exports = router;
