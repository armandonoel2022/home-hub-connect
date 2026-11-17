/**
 * Flotilla — Mantenimiento → base SafeOne (tabla propia dbo.IntranetGastosFlotilla).
 *
 * Solo Chrisnel Fabián (cfabian@safeone.com.do) y las personas que ella designe
 * pueden comparar y registrar. Solo Chrisnel designa y prepara la tabla.
 * No se borra nada en la base: lo que ya no está en la intranet se anula.
 *
 *   GET  /access            → { canSync, isOwner, delegates }
 *   GET  /status            → conexión + si la tabla existe
 *   POST /setup             → crea la tabla (solo Chrisnel)
 *   GET  /compare           → intranet vs base
 *   POST /register          → { ids: [] } inserta pendientes y actualiza diferencias
 *   POST /void/:oid         → { motivo } anula una fila que ya no existe en la intranet
 *   GET/PUT /delegates      → personas autorizadas (PUT solo Chrisnel)
 *   GET  /users             → usuarios de la intranet para designar (solo Chrisnel)
 *   GET  /audit             → historial permanente
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
  list.unshift({
    id: generateId('FDS', list),
    at: new Date().toISOString(),
    by: userLabel(req),
    email: req.user?.email || null,
    accion,
    ...extra,
  });
  writeData(AUDIT_FILE, list.slice(0, 10000));
}
function syncGuard(req, res, next) {
  if (!rules.canSync(req.user, readAcl())) {
    return res.status(403).json({ message: 'Solo Chrisnel Fabián o la persona que ella designe puede registrar gastos en la base de datos.' });
  }
  next();
}
function ownerGuard(req, res, next) {
  if (!rules.isOwner(req.user)) return res.status(403).json({ message: 'Solo Chrisnel Fabián puede hacer este cambio.' });
  next();
}
function fleetEntries() {
  const data = readData(FLEET_FILE);
  return data && Array.isArray(data.maintenance) ? data.maintenance : [];
}
async function loadDbRows() {
  return sql.query(`SELECT OID, IntranetId, Placa, Fecha, TipoMantenimiento, Taller, SuplidorOID, Kilometraje,
    Costo, Detalle, Anulado, RegistradoPor, RegistradoEn FROM dbo.IntranetGastosFlotilla`);
}
async function loadSuplidorMatcher() {
  try {
    const rows = await sql.query(`SELECT OID, Nombre FROM dbo.Suplidor WHERE GCRecord IS NULL`);
    return { matcher: rules.makeSuplidorMatcher(rows), aviso: null };
  } catch (e) {
    return { matcher: () => null, aviso: `No se pudo leer la lista de suplidores (${e.message}).` };
  }
}
async function requireTable(res) {
  if (!sql.isConfigured()) { res.status(503).json({ message: 'La conexión a SafeOne no está configurada en el servidor.' }); return false; }
  if (!(await sql.fleetTableExists())) {
    res.status(409).json({ message: 'La tabla de gastos de flotilla todavía no existe en SafeOne. Chrisnel debe pulsar "Preparar base de datos".', code: 'TABLE_MISSING' });
    return false;
  }
  return true;
}

router.get('/access', auth, (req, res) => {
  const acl = readAcl();
  const owner = rules.isOwner(req.user);
  res.json({ canSync: rules.canSync(req.user, acl), isOwner: owner, delegates: owner || rules.canSync(req.user, acl) ? acl.delegates : [] });
});

router.get('/status', auth, syncGuard, async (req, res) => {
  const st = await sql.status().catch((e) => ({ connected: false, message: e.message }));
  let tableExists = false;
  if (st.connected) { try { tableExists = await sql.fleetTableExists(); } catch { /* sin permiso */ } }
  res.json({ ...st, table: rules.TABLE, tableExists });
});

router.post('/setup', auth, ownerGuard, async (req, res) => {
  try {
    const ok = await sql.createFleetTable();
    audit(req, 'preparar_tabla', { detalle: `Tabla ${rules.TABLE} lista` });
    res.json({ tableExists: ok });
  } catch (e) {
    res.status(500).json({ message: `No se pudo crear la tabla: ${e.message}` });
  }
});

router.get('/compare', auth, syncGuard, async (req, res) => {
  try {
    if (!(await requireTable(res))) return;
    const [rows, sup] = await Promise.all([loadDbRows(), loadSuplidorMatcher()]);
    const result = rules.compareRecords(fleetEntries(), rows, sup.matcher);
    res.json({ ...result, aviso: sup.aviso, generadoEn: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/register', auth, syncGuard, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.map(String))] : [];
  if (!ids.length) return res.status(400).json({ message: 'Seleccione al menos un gasto.' });
  if (ids.length > 500) return res.status(400).json({ message: 'Máximo 500 gastos por envío.' });
  try {
    if (!(await requireTable(res))) return;
    const [rows, sup] = await Promise.all([loadDbRows(), loadSuplidorMatcher()]);
    const byId = new Map(rows.map((r) => [String(r.IntranetId), r]));
    const data = readData(FLEET_FILE);
    const entries = data && Array.isArray(data.maintenance) ? data.maintenance : [];
    const who = userLabel(req);
    const out = { registrados: 0, actualizados: 0, sinCambios: 0, errores: [] };

    for (const id of ids) {
      const entry = entries.find((e) => String(e.id) === id);
      if (!entry) { out.errores.push(`${id}: ya no existe en la intranet.`); continue; }
      const { error, params } = rules.toDbParams(entry, sup.matcher(entry.taller), who);
      if (error) { out.errores.push(error); continue; }
      const existing = byId.get(id);
      try {
        if (!existing) {
          const r = await sql.fleetWrite(
            `INSERT INTO dbo.IntranetGastosFlotilla (IntranetId, Placa, Unidad, TipoUnidad, Asignacion, Fecha, TipoMantenimiento,
              Taller, SuplidorOID, Kilometraje, Costo, Detalle, RegistradoPor)
             OUTPUT INSERTED.OID
             VALUES (@IntranetId, @Placa, @Unidad, @TipoUnidad, @Asignacion, @Fecha, @TipoMantenimiento,
              @Taller, @SuplidorOID, @Kilometraje, @Costo, @Detalle, @Usuario)`,
            params,
          );
          const oid = r.recordset[0] && r.recordset[0].OID;
          entry.dbOid = oid; entry.dbSyncedAt = new Date().toISOString(); entry.dbSyncedBy = who;
          audit(req, 'registrar', { intranetId: id, oid, placa: params.Placa, costo: params.Costo, fecha: params.Fecha });
          out.registrados++;
        } else {
          if (existing.Anulado) { out.errores.push(`${id}: está anulado en la base de datos; no se reactivó.`); continue; }
          const diffs = rules.diffEntry(entry, existing);
          if (!diffs.length) { out.sinCambios++; continue; }
          await sql.fleetWrite(
            `UPDATE dbo.IntranetGastosFlotilla SET Placa = @Placa, Unidad = @Unidad, TipoUnidad = @TipoUnidad, Asignacion = @Asignacion,
              Fecha = @Fecha, TipoMantenimiento = @TipoMantenimiento, Taller = @Taller, SuplidorOID = @SuplidorOID,
              Kilometraje = @Kilometraje, Costo = @Costo, Detalle = @Detalle, ActualizadoPor = @Usuario, ActualizadoEn = SYSDATETIME()
             WHERE OID = @oid`,
            { ...params, oid: Number(existing.OID) },
          );
          entry.dbOid = Number(existing.OID); entry.dbSyncedAt = new Date().toISOString(); entry.dbSyncedBy = who;
          audit(req, 'actualizar', { intranetId: id, oid: Number(existing.OID), cambios: diffs });
          out.actualizados++;
        }
      } catch (e) {
        out.errores.push(`${id}: ${e.message}`);
      }
    }
    if (out.registrados || out.actualizados) writeData(FLEET_FILE, data);
    res.json(out);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/void/:oid', auth, syncGuard, async (req, res) => {
  const oid = Number(req.params.oid);
  const motivo = String(req.body?.motivo || '').trim();
  if (!Number.isFinite(oid) || oid <= 0) return res.status(400).json({ message: 'Registro inválido.' });
  if (motivo.length < 5) return res.status(400).json({ message: 'Escriba el motivo de la anulación.' });
  try {
    if (!(await requireTable(res))) return;
    const before = await sql.query(`SELECT OID, IntranetId, Placa, Costo, Anulado FROM dbo.IntranetGastosFlotilla WHERE OID = @oid`, { oid });
    if (!before.length) return res.status(404).json({ message: 'No existe en la base de datos.' });
    if (before[0].Anulado) return res.json({ anulado: true });
    if (fleetEntries().some((e) => String(e.id) === String(before[0].IntranetId))) {
      return res.status(409).json({ message: 'Ese gasto todavía existe en la intranet; no se puede anular.' });
    }
    await sql.fleetWrite(
      `UPDATE dbo.IntranetGastosFlotilla SET Anulado = 1, MotivoAnulacion = @motivo, ActualizadoPor = @usuario, ActualizadoEn = SYSDATETIME() WHERE OID = @oid`,
      { oid, motivo: motivo.slice(0, 500), usuario: userLabel(req).slice(0, 150) },
    );
    audit(req, 'anular', { oid, intranetId: before[0].IntranetId, placa: before[0].Placa, costo: Number(before[0].Costo), motivo });
    res.json({ anulado: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get('/delegates', auth, syncGuard, (req, res) => res.json({ delegates: readAcl().delegates }));

router.put('/delegates', auth, ownerGuard, (req, res) => {
  const users = readData('users.json') || [];
  const known = new Set(users.map((u) => rules.normEmail(u.email)));
  const next = rules.cleanDelegates(req.body?.delegates);
  const unknown = next.filter((e) => !known.has(e));
  if (unknown.length) return res.status(400).json({ message: `No son usuarios de la intranet: ${unknown.join(', ')}` });
  const prev = readAcl();
  writeData(ACL_FILE, { delegates: next, updatedAt: new Date().toISOString(), updatedBy: req.user?.email });
  audit(req, 'designar', {
    agregados: next.filter((e) => !prev.delegates.includes(e)),
    quitados: prev.delegates.filter((e) => !next.includes(e)),
  });
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

// Bloqueo explícito: nunca se elimina desde la intranet (compatible con Express 4 y 5).
router.use((req, res, next) => {
  if (req.method === 'DELETE') return res.status(405).json({ message: 'Eliminar registros de la base de datos está deshabilitado.' });
  next();
});

module.exports = router;
