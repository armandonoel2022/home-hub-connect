/**
 * Explorador SafeOne — SOLO LECTURA.
 * Permite ver tablas, columnas, relaciones y últimos registros de la base SafeOne
 * (la misma que usa Adonis) sin abrir SQL Server Management Studio.
 * Nunca escribe en SafeOne: todas las consultas son SELECT fijos con nombres validados.
 *
 *   GET  /status
 *   GET  /tables
 *   GET  /tables/:name            → columnas, relaciones, últimos registros
 *   GET  /diagnostico/flotilla    → paquete para preparar el registro de gastos
 *   GET  /snapshots               POST /snapshots      → fotos de numeración
 *   GET  /snapshots/:id/compare   → qué tablas cambiaron y sus registros nuevos
 */
const express = require('express');
const auth = require('../middleware/auth');
const sql = require('../config/sqlServerSafeOne');
const { readData, writeData, generateId } = require('../config/database');
const lib = require('../lib/safeoneExplorer');

const router = express.Router();
const SNAP_FILE = 'safeone-snapshots.json';

router.use(auth, (req, res, next) => {
  if (!lib.canExplore(req.user)) return res.status(403).json({ message: 'No autorizado para explorar SafeOne.' });
  next();
});

async function tableNames() {
  const rows = await sql.query(`SELECT t.name FROM sys.tables t WHERE SCHEMA_NAME(t.schema_id) = 'dbo'`);
  return rows.map((r) => r.name);
}
async function columnsOf(table) {
  return sql.query(`
    SELECT c.column_id AS orden, c.name AS columna, ty.name AS tipo, c.max_length AS largo,
           c.is_nullable AS permiteVacio, c.is_identity AS autonumerico, dc.definition AS porDefecto
    FROM sys.columns c
    JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    LEFT JOIN sys.default_constraints dc ON dc.object_id = c.default_object_id
    WHERE c.object_id = OBJECT_ID(@t)
    ORDER BY c.column_id`, { t: `dbo.${table}` });
}
async function relationsOf(table) {
  return sql.query(`
    SELECT OBJECT_NAME(f.parent_object_id) AS tablaOrigen,
           COL_NAME(fc.parent_object_id, fc.parent_column_id) AS columnaOrigen,
           OBJECT_NAME(f.referenced_object_id) AS tablaDestino,
           COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS columnaDestino
    FROM sys.foreign_keys f
    JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = f.object_id
    WHERE f.parent_object_id = OBJECT_ID(@t) OR f.referenced_object_id = OBJECT_ID(@t)
    ORDER BY 1, 2`, { t: `dbo.${table}` });
}
function selectList(cols) {
  return cols.filter((c) => !lib.BINARY_TYPES.has(String(c.tipo).toLowerCase())).map((c) => lib.bracket(c.columna)).join(', ');
}
function orderColumn(cols) {
  const id = cols.find((c) => c.autonumerico) || cols.find((c) => String(c.columna).toLowerCase() === 'oid');
  return id ? id.columna : null;
}
async function lastRows(table, cols, limit, afterValue, filter) {
  const list = selectList(cols);
  if (!list) return [];
  const ord = orderColumn(cols);
  const n = Math.max(1, Math.min(Number(limit) || 25, 200));
  if (filter) {
    const where = filter.like
      ? `CAST(${lib.bracket(filter.col)} AS nvarchar(max)) LIKE @val`
      : `${lib.bracket(filter.col)} = @val`;
    return lib.serializeRows(await sql.query(
      `SELECT TOP (${n}) ${list} FROM dbo.${lib.bracket(table)} WHERE ${where}${ord ? ` ORDER BY ${lib.bracket(ord)} DESC` : ''}`,
      { val: filter.like ? `%${filter.val}%` : filter.val },
    ));
  }
  if (afterValue != null && ord) {
    return lib.serializeRows(await sql.query(
      `SELECT TOP (${n}) ${list} FROM dbo.${lib.bracket(table)} WHERE ${lib.bracket(ord)} > @after ORDER BY ${lib.bracket(ord)}`,
      { after: Number(afterValue) },
    ));
  }
  return lib.serializeRows(await sql.query(
    `SELECT TOP (${n}) ${list} FROM dbo.${lib.bracket(table)}${ord ? ` ORDER BY ${lib.bracket(ord)} DESC` : ''}`,
  ));
}
async function identities() {
  const rows = await sql.query(`SELECT OBJECT_NAME(object_id) AS tabla, CAST(last_value AS bigint) AS ultimo
    FROM sys.identity_columns WHERE last_value IS NOT NULL AND OBJECTPROPERTY(object_id, 'IsUserTable') = 1`);
  const out = {};
  for (const r of rows) out[r.tabla] = r.ultimo == null ? null : Number(r.ultimo);
  return out;
}
const fail = (res, e) => res.status(500).json({ message: e.message });

router.get('/status', async (req, res) => {
  try { res.json(await sql.status()); } catch (e) { res.json({ connected: false, message: e.message }); }
});

router.get('/tables', async (req, res) => {
  try {
    const rows = await sql.query(`
      SELECT t.name AS tabla, SUM(p.rows) AS registros,
             MAX(CAST(ic.last_value AS bigint)) AS ultimoNumero, MAX(t.modify_date) AS modificada
      FROM sys.tables t
      JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
      LEFT JOIN sys.identity_columns ic ON ic.object_id = t.object_id
      WHERE SCHEMA_NAME(t.schema_id) = 'dbo'
      GROUP BY t.name ORDER BY t.name`);
    res.json(lib.serializeRows(rows).map((r) => ({ ...r, registros: Number(r.registros) || 0, ultimoNumero: r.ultimoNumero == null ? null : Number(r.ultimoNumero) })));
  } catch (e) { fail(res, e); }
});

router.get('/tables/:name', async (req, res) => {
  try {
    const table = lib.resolveName(req.params.name, await tableNames());
    if (!table) return res.status(404).json({ message: 'La tabla no existe en SafeOne.' });
    const columnas = await columnsOf(table);
    let filtro = null;
    if (req.query.col && req.query.val != null && String(req.query.val).trim() !== '') {
      const usable = columnas.filter((c) => !lib.BINARY_TYPES.has(String(c.tipo).toLowerCase())).map((c) => c.columna);
      const col = lib.resolveName(req.query.col, usable);
      if (!col) return res.status(400).json({ message: 'La columna no existe en esa tabla.' });
      filtro = { col, val: String(req.query.val).trim().slice(0, 200), like: String(req.query.op) === 'like' };
    }
    const [relaciones, registros] = await Promise.all([relationsOf(table), lastRows(table, columnas, req.query.limit, null, filtro)]);
    res.json({ tabla: table, columnas, relaciones, registros, ordenadoPor: orderColumn(columnas), filtro });
  } catch (e) { fail(res, e); }
});

// Todo lo necesario para preparar el registro de facturas de suplidor y caja chica.
const DIAG_TABLES = {
  CargosCP: 5, CargosCP606: 5, PagoCargosCP: 5, CajaChica: 5, CajaChicaD: 10, CajaChicaD606: 5,
  Trans: 20, Asientos: 5, Documento: 200, TipoNCF: 200, XPObjectType: 300, LibroSup: 5, Suplidor: 5, ClasificacionCyG: 300,
};
router.get('/diagnostico/flotilla', async (req, res) => {
  const out = { generadoEn: new Date().toISOString(), base: null, tablas: {}, errores: [] };
  try {
    const st = await sql.status();
    out.base = { host: st.host, database: st.database, connected: st.connected };
    const known = await tableNames();
    out.numeracion = await identities();
    for (const [name, limit] of Object.entries(DIAG_TABLES)) {
      const table = lib.resolveName(name, known);
      if (!table) { out.errores.push(`${name}: no existe`); continue; }
      try {
        const columnas = await columnsOf(table);
        out.tablas[table] = {
          columnas,
          relaciones: await relationsOf(table),
          registros: await lastRows(table, columnas, limit),
        };
      } catch (e) { out.errores.push(`${table}: ${e.message}`); }
    }
    res.setHeader('Content-Disposition', `attachment; filename="diagnostico-safeone-flotilla-${out.generadoEn.slice(0, 10)}.json"`);
    res.json(out);
  } catch (e) { fail(res, e); }
});

router.get('/snapshots', (req, res) => {
  const list = readData(SNAP_FILE);
  res.json((Array.isArray(list) ? list : []).map(({ valores, ...s }) => ({ ...s, tablas: Object.keys(valores || {}).length })));
});

router.post('/snapshots', async (req, res) => {
  try {
    const valores = await identities();
    const list = Array.isArray(readData(SNAP_FILE)) ? readData(SNAP_FILE) : [];
    const snap = {
      id: generateId('FOTO', list),
      at: new Date().toISOString(),
      by: req.user?.email || null,
      nota: String(req.body?.nota || '').slice(0, 200) || null,
      valores,
    };
    list.unshift(snap);
    writeData(SNAP_FILE, list.slice(0, 30));
    res.status(201).json({ id: snap.id, at: snap.at, nota: snap.nota, tablas: Object.keys(valores).length });
  } catch (e) { fail(res, e); }
});

router.get('/snapshots/:id/compare', async (req, res) => {
  try {
    const list = Array.isArray(readData(SNAP_FILE)) ? readData(SNAP_FILE) : [];
    const snap = list.find((s) => s.id === req.params.id);
    if (!snap) return res.status(404).json({ message: 'Foto no encontrada.' });
    const cambios = lib.diffIdentities(snap.valores, await identities());
    const known = await tableNames();
    for (const c of cambios.slice(0, 25)) {
      const table = lib.resolveName(c.tabla, known);
      if (!table || c.antes == null) continue;
      try { c.registros = await lastRows(table, await columnsOf(table), 20, c.antes); }
      catch (e) { c.error = e.message; }
    }
    res.json({ foto: { id: snap.id, at: snap.at, nota: snap.nota }, comparadoEn: new Date().toISOString(), cambios });
  } catch (e) { fail(res, e); }
});

module.exports = router;
