/**
 * Análisis de facturación de clientes — SOLO LECTURA sobre SafeOne (Adonis).
 *
 *   GET /api/billing-analysis/status
 *   GET /api/billing-analysis/access     PUT /access (solo super administrador)
 *   GET /api/billing-analysis?desde=YYYY-MM-DD&hasta=YYYY-MM-DD[&refresh=1]
 *
 * Lee dbo.Factura + dbo.Cliente (y, si existe, la tabla de líneas que referencia a Factura).
 * Solo SELECT fijos; los nombres de columnas se validan contra el catálogo de la base.
 * Nunca escribe en SafeOne.
 */
const express = require('express');
const auth = require('../middleware/auth');
const sql = require('../config/sqlServerSafeOne');
const lib = require('../lib/billingAnalysis');
const { bracket } = require('../lib/safeoneExplorer');
const { readData, writeData } = require('../config/database');
const ACCESS_FILE = 'billing-analysis-access.json';
function readAccess() {
  const d = readData(ACCESS_FILE);
  return d && !Array.isArray(d) ? lib.cleanAccess(d) : { restringido: false, emails: [] };
}

const router = express.Router();
const cache = new Map(); // key → { at, data }
const TTL = 10 * 60 * 1000;
const MAX_LINES = 60000;

router.use(auth, (req, res, next) => {
  if (!lib.canViewBilling(req.user, readAccess())) return res.status(403).json({ message: 'No autorizado para ver el análisis de facturación.' });
  next();
});

async function columns(table) {
  const rows = await sql.query(
    `SELECT c.name, ty.name AS tipo FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID(@t)`,
    { t: `dbo.${table}` });
  return rows.map((r) => r.name);
}
async function tableExists(table) {
  const rows = await sql.query(`SELECT name FROM sys.tables WHERE name = @t AND SCHEMA_NAME(schema_id) = 'dbo'`, { t: table });
  return rows[0]?.name || null;
}
/** Tabla y columna a la que apunta una FK (si existe). */
async function fkTarget(table, column) {
  const rows = await sql.query(`
    SELECT OBJECT_NAME(f.referenced_object_id) AS tabla, COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS columna
    FROM sys.foreign_keys f JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = f.object_id
    WHERE f.parent_object_id = OBJECT_ID(@t) AND COL_NAME(fc.parent_object_id, fc.parent_column_id) = @c`,
    { t: `dbo.${table}`, c: column });
  return rows[0] || null;
}
/** Tablas que referencian a dbo.Factura (posibles líneas de detalle). */
async function referencing(table) {
  return sql.query(`
    SELECT OBJECT_NAME(f.parent_object_id) AS tabla, COL_NAME(fc.parent_object_id, fc.parent_column_id) AS columna
    FROM sys.foreign_keys f JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = f.object_id
    WHERE f.referenced_object_id = OBJECT_ID(@t)`, { t: `dbo.${table}` });
}

/** Descubre la estructura real (solo lectura) y arma los SELECT. */
async function discover() {
  const fTable = await tableExists('Factura');
  const cTable = await tableExists('Cliente');
  if (!fTable || !cTable) throw new Error('No se encontraron las tablas dbo.Factura y dbo.Cliente en SafeOne.');
  const fc = await columns(fTable);
  const cc = await columns(cTable);
  const F = {
    oid: lib.pickColumn(fc, ['OID']),
    numero: lib.pickColumn(fc, ['Numero', 'NumeroFactura', 'Referencia']),
    ncf: lib.pickColumn(fc, ['NCF']),
    fecha: lib.pickColumn(fc, ['Fecha', 'FechaFactura']),
    bruto: lib.pickColumn(fc, ['Bruto', 'SubTotal', 'Subtotal', 'Valor']),
    itbis: lib.pickColumn(fc, ['ITBIS', 'Itbis', 'Impuesto']),
    neto: lib.pickColumn(fc, ['Neto', 'Total']),
    cliente: lib.pickColumn(fc, ['Cliente']),
    comentario: lib.pickColumn(fc, ['Comentario', 'Concepto', 'Notas', 'Descripcion']),
    gc: lib.pickColumn(fc, ['GCRecord']),
    anulada: lib.pickColumn(fc, ['Anulada', 'Anulado', 'Nula']),
  };
  for (const k of ['fecha', 'bruto', 'cliente']) if (!F[k]) throw new Error(`dbo.Factura no tiene la columna esperada para «${k}».`);
  const C = {
    oid: lib.pickColumn(cc, ['OID']),
    nombre: lib.pickColumn(cc, ['Nombre', 'RazonSocial']),
    rnc: lib.pickColumn(cc, ['TaxId', 'RNC', 'Cedula']),
    codigo: lib.pickColumn(cc, ['Codigo']),
    clasificacion: lib.pickColumn(cc, ['ClasificacionCliente', 'Clasificacion']),
    inactivo: lib.pickColumn(cc, ['Inactivo']),
    gc: lib.pickColumn(cc, ['GCRecord']),
  };
  if (!C.oid || !C.nombre) throw new Error('dbo.Cliente no tiene OID/Nombre.');

  // Nombre de la clasificación, si es FK a otra tabla con descripción.
  let clasJoin = null;
  if (C.clasificacion) {
    const t = await fkTarget(cTable, C.clasificacion);
    if (t) {
      const tc = await columns(t.tabla);
      const d = lib.pickColumn(tc, ['Descripcion', 'Nombre', 'Codigo']);
      if (d) clasJoin = { tabla: t.tabla, columna: t.columna, desc: d };
    }
  }

  // Líneas de factura: tabla que referencia a Factura con precio y descripción/artículo.
  let L = null;
  if (F.oid) {
    for (const ref of await referencing(fTable)) {
      const lc = await columns(ref.tabla);
      const precio = lib.pickColumn(lc, ['Precio', 'PrecioUnitario', 'PrecioVenta']);
      const monto = lib.pickColumn(lc, ['Monto', 'Importe', 'Valor', 'Total', 'Bruto']);
      const cantidad = lib.pickColumn(lc, ['Cantidad']);
      const desc = lib.pickColumn(lc, ['Descripcion', 'Concepto', 'Detalle', 'Comentario']);
      const articulo = lib.pickColumn(lc, ['Articulo', 'Producto', 'Servicio']);
      if (!(precio || monto) || !(desc || articulo)) continue;
      let art = null;
      if (articulo) {
        const t = await fkTarget(ref.tabla, articulo);
        if (t) {
          const ac = await columns(t.tabla);
          const d = lib.pickColumn(ac, ['Descripcion', 'Nombre']);
          if (d) art = { tabla: t.tabla, columna: t.columna, desc: d };
        }
      }
      L = { tabla: ref.tabla, fk: ref.columna, precio, monto, cantidad, desc, articulo, art, gc: lib.pickColumn(lc, ['GCRecord']) };
      break;
    }
  }
  return { fTable, cTable, F, C, clasJoin, L };
}

function facturaWhere(F, alias = 'f') {
  const w = [`${alias}.${bracket(F.fecha)} >= @desde`, `${alias}.${bracket(F.fecha)} < DATEADD(day, 1, @hasta)`];
  if (F.gc) w.push(`${alias}.${bracket(F.gc)} IS NULL`);
  if (F.anulada) w.push(`ISNULL(${alias}.${bracket(F.anulada)}, 0) = 0`);
  return w.join(' AND ');
}

async function load(desde, hasta) {
  const s = await discover();
  const { F, C, clasJoin, L } = s;
  const col = (expr, as) => (expr ? `${expr} AS ${bracket(as)}` : `NULL AS ${bracket(as)}`);
  const fx = (k) => (F[k] ? `f.${bracket(F[k])}` : null);
  const facturas = await sql.query(`
    SELECT ${[col(fx('oid'), 'oid'), col(fx('numero'), 'numero'), col(fx('ncf'), 'ncf'), col(fx('fecha'), 'fecha'),
      col(fx('bruto'), 'bruto'), col(fx('itbis'), 'itbis'), col(fx('neto'), 'neto'), col(fx('cliente'), 'cliente'),
      col(fx('comentario'), 'comentario')].join(', ')}
    FROM dbo.${bracket(s.fTable)} f
    WHERE ${facturaWhere(F)}`, { desde, hasta });

  const cx = (k) => (C[k] ? `c.${bracket(C[k])}` : null);
  const clas = clasJoin ? `k.${bracket(clasJoin.desc)}` : cx('clasificacion');
  const clientes = await sql.query(`
    SELECT ${[col(cx('oid'), 'oid'), col(cx('nombre'), 'nombre'), col(cx('rnc'), 'rnc'), col(cx('codigo'), 'codigo'),
      col(clas, 'clasificacion'), col(cx('inactivo'), 'inactivo')].join(', ')}
    FROM dbo.${bracket(s.cTable)} c
    ${clasJoin ? `LEFT JOIN dbo.${bracket(clasJoin.tabla)} k ON k.${bracket(clasJoin.columna)} = c.${bracket(C.clasificacion)}` : ''}
    ${C.gc ? `WHERE c.${bracket(C.gc)} IS NULL` : ''}`);

  let lineas = null;
  let lineasInfo = null;
  if (L) {
    const lx = (k) => (L[k] ? `l.${bracket(L[k])}` : null);
    const descExpr = L.art && L.desc ? `COALESCE(NULLIF(LTRIM(RTRIM(CAST(l.${bracket(L.desc)} AS nvarchar(300)))), ''), a.${bracket(L.art.desc)})`
      : L.art ? `a.${bracket(L.art.desc)}` : lx('desc');
    lineas = await sql.query(`
      SELECT TOP (${MAX_LINES}) ${[col(`l.${bracket(L.fk)}`, 'factura'), col(descExpr, 'descripcion'), col(lx('cantidad'), 'cantidad'),
        col(lx('precio'), 'precio'), col(lx('monto'), 'monto')].join(', ')}
      FROM dbo.${bracket(L.tabla)} l
      JOIN dbo.${bracket(s.fTable)} f ON f.${bracket(F.oid)} = l.${bracket(L.fk)}
      ${L.art ? `LEFT JOIN dbo.${bracket(L.art.tabla)} a ON a.${bracket(L.art.columna)} = l.${bracket(L.articulo)}` : ''}
      WHERE ${facturaWhere(F)} ${L.gc ? `AND l.${bracket(L.gc)} IS NULL` : ''}`, { desde, hasta });
    lineasInfo = { tabla: L.tabla, filas: lineas.length, recortado: lineas.length >= MAX_LINES };
  }

  const data = lib.analyze({ facturas, clientes, lineas, desde, hasta });
  data.fuente = {
    base: 'SafeOne (solo lectura)',
    tablas: [s.fTable, s.cTable, ...(clasJoin ? [clasJoin.tabla] : []), ...(L ? [L.tabla] : []), ...(L?.art ? [L.art.tabla] : [])],
    columnasFactura: F, columnasCliente: C, lineas: lineasInfo,
    leidoEn: new Date().toISOString(),
  };
  return data;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

router.get('/access', (req, res) => {
  res.json({ ...readAccess(), puedeEditar: lib.isBillingSuper(req.user) });
});
router.put('/access', (req, res) => {
  if (!lib.isBillingSuper(req.user)) return res.status(403).json({ message: 'Solo el super administrador puede cambiar el acceso.' });
  const next = { ...lib.cleanAccess(req.body), actualizado: new Date().toISOString(), por: req.user.email };
  writeData(ACCESS_FILE, next);
  res.json({ ...lib.cleanAccess(next), puedeEditar: true });
});

router.get('/status', async (req, res) => {
  res.json(await sql.status());
});

router.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const desde = DAY.test(String(req.query.desde || '')) ? String(req.query.desde) : `${today.slice(0, 4)}-01-01`;
    const hasta = DAY.test(String(req.query.hasta || '')) ? String(req.query.hasta) : today;
    if (desde > hasta) return res.status(400).json({ message: 'La fecha inicial es posterior a la final.' });
    const days = (new Date(hasta) - new Date(desde)) / 86400000;
    if (days > 366 * 3 + 1) return res.status(400).json({ message: 'El período máximo es de 3 años.' });
    const key = `${desde}|${hasta}`;
    const hit = cache.get(key);
    if (hit && !req.query.refresh && Date.now() - hit.at < TTL) return res.json({ ...hit.data, cache: true });
    const data = await load(desde, hasta);
    cache.set(key, { at: Date.now(), data });
    res.json(data);
  } catch (e) {
    console.error('[billing-analysis]', e.message);
    res.status(500).json({ message: e.message || 'No se pudo leer la facturación de SafeOne.' });
  }
});

module.exports = router;
