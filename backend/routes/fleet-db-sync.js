/**
 * Flotilla — Mantenimiento ↔ Adonis (SafeOne).
 * SOLO LECTURA sobre SafeOne: se leen las facturas de suplidor (CargosCP, incluye
 * las que nacen de Caja Chica) y se cruzan con los gastos de la intranet.
 * El vínculo gasto ↔ factura se guarda en la intranet (fleet-maintenance.json).
 *
 * Solo Chrisnel Fabián (cfabian@safeone.com.do) y las personas que ella designe
 * pueden usarlo. Solo Chrisnel designa.
 *
 *   GET  /access                 → { canSync, isOwner, delegates }
 *   GET  /status                 → conexión con SafeOne
 *   GET  /compare                → vinculados / solo intranet / solo Adonis
 *   POST /link   { entryId, oid } → confirma que el gasto es esa factura
 *   POST /unlink { entryId }
 *   PUT  /delegates  GET /users  GET /audit
 */
const express = require('express');
const auth = require('../middleware/auth');
const sql = require('../config/sqlServerSafeOne');
const { readData, writeData, generateId } = require('../config/database');
const rules = require('../lib/fleetDbSync');

const router = express.Router();
const ACL_FILE = 'fleet-db-sync-acl.json';
const AUDIT_FILE = 'fleet-db-sync-audit.json';
const FLEET_FILE = 'fleet-maintenance.json';

function readAcl() {
  const raw = readData(ACL_FILE);
  if (raw && !Array.isArray(raw) && typeof raw === 'object') return { ...raw, delegates: rules.cleanDelegates(raw.delegates) };
  return { delegates: [] };
}
function userLabel(req) {
  const users = readData('users.json') || [];
  const u = users.find((x) => rules.normEmail(x.email) === rules.normEmail(req.user?.email));
  return (u && (u.fullName || u.name)) || req.user?.email || 'Intranet';
}
function audit(req, accion, extra) {
  const items = readData(AUDIT_FILE);
  const list = Array.isArray(items) ? items : [];
  list.unshift({ id: generateId('FDS', list), at: new Date().toISOString(), by: userLabel(req), email: req.user?.email || null, accion, ...extra });
  writeData(AUDIT_FILE, list.slice(0, 10000));
}
function syncGuard(req, res, next) {
  if (!rules.canSync(req.user, readAcl())) {
    return res.status(403).json({ message: 'Solo Chrisnel Fabián o la persona que ella designe puede usar esta comparación.' });
  }
  next();
}
function ownerGuard(req, res, next) {
  if (!rules.isOwner(req.user)) return res.status(403).json({ message: 'Solo Chrisnel Fabián puede hacer este cambio.' });
  next();
}
function fleetData() {
  const data = readData(FLEET_FILE);
  return data && !Array.isArray(data) ? data : { fleet: [], maintenance: [] };
}
function knownPlates(data) {
  const vehicles = readData('fleet-vehicles.json');
  return [
    ...(data.fleet || []).map((u) => u.placa),
    ...(Array.isArray(vehicles) ? vehicles.filter((v) => v.activo !== false).map((v) => v.placa) : []),
  ];
}
const INVOICE_COLUMNS = `c.OID, c.Suplidor, s.Nombre AS SuplidorNombre, c.Fecha, c.FechaFactura, c.Referencia, c.NCF,
  c.Valor, c.Itbis, c.Notas, c.ClasificacionCyG, c.CajaChica`;
function sinceDate(entries) {
  const dates = entries.map((e) => rules.toIsoDate(e.fecha)).filter(Boolean).sort();
  const base = dates[0] ? new Date(`${dates[0]}T00:00:00Z`) : new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  base.setUTCDate(base.getUTCDate() - 60);
  return base.toISOString().slice(0, 10);
}

router.get('/access', auth, (req, res) => {
  const acl = readAcl();
  const ok = rules.canSync(req.user, acl);
  res.json({ canSync: ok, isOwner: rules.isOwner(req.user), delegates: ok ? acl.delegates : [] });
});

router.get('/status', auth, syncGuard, async (req, res) => {
  const st = await sql.status().catch((e) => ({ connected: false, message: e.message }));
  res.json(st);
});

router.get('/compare', auth, syncGuard, async (req, res) => {
  if (!sql.isConfigured()) return res.status(503).json({ message: 'La conexión a SafeOne no está configurada en el servidor.' });
  try {
    const data = fleetData();
    const entries = data.maintenance || [];
    const desde = sinceDate(entries);
    const rows = await sql.query(
      `SELECT ${INVOICE_COLUMNS}
       FROM dbo.CargosCP c LEFT JOIN dbo.Suplidor s ON s.OID = c.Suplidor
       WHERE c.GCRecord IS NULL AND COALESCE(c.FechaFactura, c.Fecha) >= @desde`,
      { desde },
    );
    const result = rules.compareWithAdonis(entries, rows, knownPlates(data));
    res.json({ ...result, desde, facturasLeidas: rows.length, generadoEn: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/link', auth, syncGuard, async (req, res) => {
  const entryId = String(req.body?.entryId || '');
  const oid = Number(req.body?.oid);
  if (!entryId || !Number.isFinite(oid) || oid <= 0) return res.status(400).json({ message: 'Faltan el gasto o la factura.' });
  try {
    const rows = await sql.query(
      `SELECT ${INVOICE_COLUMNS} FROM dbo.CargosCP c LEFT JOIN dbo.Suplidor s ON s.OID = c.Suplidor
       WHERE c.OID = @oid AND c.GCRecord IS NULL`, { oid });
    if (!rows.length) return res.status(404).json({ message: `La factura ${oid} no existe en Adonis.` });
    const data = fleetData();
    const entry = (data.maintenance || []).find((e) => String(e.id) === entryId);
    if (!entry) return res.status(404).json({ message: 'El gasto ya no existe en la intranet.' });
    const other = data.maintenance.find((e) => Number(e.adonisOid) === oid && String(e.id) !== entryId);
    if (other) return res.status(409).json({ message: `Esa factura ya está vinculada al gasto ${other.id}.` });
    const inv = rules.summarizeInvoice(rows[0], [entry.placa]);
    entry.adonisOid = oid;
    entry.adonisNcf = inv.ncf;
    entry.adonisLinkedAt = new Date().toISOString();
    entry.adonisLinkedBy = userLabel(req);
    writeData(FLEET_FILE, data);
    audit(req, 'vincular', { intranetId: entryId, oid, ncf: inv.ncf, placa: entry.placa, costo: Number(entry.costo) || 0, totalAdonis: inv.total });
    res.json({ ok: true, adonis: inv });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/unlink', auth, syncGuard, (req, res) => {
  const entryId = String(req.body?.entryId || '');
  const data = fleetData();
  const entry = (data.maintenance || []).find((e) => String(e.id) === entryId);
  if (!entry) return res.status(404).json({ message: 'El gasto no existe en la intranet.' });
  const oid = entry.adonisOid;
  delete entry.adonisOid; delete entry.adonisNcf; delete entry.adonisLinkedAt; delete entry.adonisLinkedBy;
  writeData(FLEET_FILE, data);
  audit(req, 'desvincular', { intranetId: entryId, oid });
  res.json({ ok: true });
});

router.put('/delegates', auth, ownerGuard, (req, res) => {
  const users = readData('users.json') || [];
  const known = new Set(users.map((u) => rules.normEmail(u.email)));
  const next = rules.cleanDelegates(req.body?.delegates);
  const unknown = next.filter((e) => !known.has(e));
  if (unknown.length) return res.status(400).json({ message: `No son usuarios de la intranet: ${unknown.join(', ')}` });
  const prev = readAcl();
  writeData(ACL_FILE, { delegates: next, updatedAt: new Date().toISOString(), updatedBy: req.user?.email });
  audit(req, 'designar', { agregados: next.filter((e) => !prev.delegates.includes(e)), quitados: prev.delegates.filter((e) => !next.includes(e)) });
  res.json({ delegates: next });
});

router.get('/users', auth, ownerGuard, (req, res) => {
  const users = readData('users.json') || [];
  res.json(users
    .filter((u) => u.email && u.employeeStatus !== 'Inactivo' && u.active !== false)
    .map((u) => ({ email: rules.normEmail(u.email), nombre: u.fullName || u.name || u.email, departamento: u.department || '' }))
    .filter((u) => u.email !== rules.OWNER_EMAIL)
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')));
});

router.get('/audit', auth, syncGuard, (req, res) => {
  const items = readData(AUDIT_FILE);
  res.json((Array.isArray(items) ? items : []).slice(0, 200));
});

module.exports = router;
