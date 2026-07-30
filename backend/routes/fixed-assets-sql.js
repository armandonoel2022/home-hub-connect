/**
 * Comparador Activo Fijo: intranet (JSON local) vs SQL Server [SafeOne].[dbo].[ActivoFijo]
 * SOLO LECTURA. No modifica ni intranet ni la base GENERAL.
 *
 * Endpoints:
 *   GET /status                 → estado de conexión a SafeOne
 *   GET /activo-fijo            → filas crudas de ActivoFijo (sin Imagen/IUbicacion)
 *   POST /compare               → { onlyInSql, onlyInIntranet, matched, stats }
 *     body: { intranet: FixedAsset[] }  (el frontend envía sus activos actuales)
 */
const express = require('express');
const auth = require('../middleware/auth');
const sql = require('../config/sqlServerSafeOne');
const { readData, writeData, generateId } = require('../config/database');

const router = express.Router();
const BACKUP_FILE = 'fixed-assets-backups.json';


function canAccess(user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const dept = String(user.department || '').toLowerCase();
  return /tecnolog|administraci|gerencia|contabil/.test(dept);
}
function guard(req, res, next) {
  if (!canAccess(req.user)) return res.status(403).json({ message: 'No autorizado' });
  next();
}

router.get('/status', auth, async (req, res) => {
  try { res.json(await sql.status()); }
  catch (e) { res.status(500).json({ connected: false, message: e.message }); }
});

// Lectura completa (excluye binarios pesados). Filtra retirados si Retirado=1.
router.get('/activo-fijo', auth, guard, async (req, res) => {
  const includeRetired = String(req.query.includeRetired || '').toLowerCase() === 'true';
  try {
    const rows = await sql.query(`
      SELECT
        af.OID, af.Descripcion, af.Serial, af.Modelo, af.CodigoBarra,
        af.Ubicacion, af.Departamento, af.Encargado, af.Comentario,
        af.Documento, af.FechaAdq, af.FechaInicio, af.FechaRet,
        af.CostoAdq, af.Depreciacion, af.DepreciacionInicial,
        af.DeprAnoAnt, af.DeprAnoAct,
        af.Categoria, af.Tipo, af.Suplidor,
        af.Transito, af.Retirado, af.GCRecord
      FROM dbo.ActivoFijo af
      WHERE (af.GCRecord IS NULL)
        ${includeRetired ? '' : 'AND (af.Retirado IS NULL OR af.Retirado = 0)'}
      ORDER BY af.OID DESC
    `);
    res.json({ count: rows.length, rows });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

const norm = (s) => String(s == null ? '' : s).toUpperCase().replace(/\s+/g, '').replace(/[-_/]/g, '').trim();

router.post('/compare', auth, guard, async (req, res) => {
  const intranet = Array.isArray(req.body?.intranet) ? req.body.intranet : [];
  try {
    const rows = await sql.query(`
      SELECT af.OID, af.Descripcion, af.Serial, af.Modelo, af.CodigoBarra,
             af.Ubicacion, af.Departamento, af.Encargado, af.CostoAdq,
             af.FechaAdq, af.Categoria, af.Tipo, af.Retirado
      FROM dbo.ActivoFijo af
      WHERE (af.GCRecord IS NULL) AND (af.Retirado IS NULL OR af.Retirado = 0)
    `);

    // Index intranet por serial, codigoOriginal e id
    const intBySerial = new Map();
    const intByCode = new Map();
    for (const a of intranet) {
      if (a.serial) intBySerial.set(norm(a.serial), a);
      if (a.codigoOriginal) intByCode.set(norm(a.codigoOriginal), a);
      if (a.id) intByCode.set(norm(a.id), a);
    }

    const matched = [];
    const onlyInSql = [];
    const usedIntranet = new Set();

    for (const r of rows) {
      const keys = [norm(r.Serial), norm(r.CodigoBarra)].filter(Boolean);
      let hit = null;
      for (const k of keys) {
        hit = intBySerial.get(k) || intByCode.get(k);
        if (hit) break;
      }
      if (hit) {
        matched.push({ sql: r, intranet: hit });
        usedIntranet.add(hit.id || hit.codigoOriginal || hit.serial);
      } else {
        onlyInSql.push(r);
      }
    }

    const onlyInIntranet = intranet.filter(
      (a) => !usedIntranet.has(a.id || a.codigoOriginal || a.serial)
    );

    res.json({
      stats: {
        sqlTotal: rows.length,
        intranetTotal: intranet.length,
        matched: matched.length,
        onlyInSql: onlyInSql.length,
        onlyInIntranet: onlyInIntranet.length,
      },
      matched,
      onlyInSql,
      onlyInIntranet,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* ───────────────────────── BACKUPS (intranet JSON) ───────────────────────── */

// Lista de respaldos (sin payload)
router.get('/backups', auth, guard, (req, res) => {
  const all = readData(BACKUP_FILE);
  res.json(all.map(({ assets, ...meta }) => meta));
});

// Crea un respaldo permanente del inventario de la intranet
router.post('/backups', auth, guard, (req, res) => {
  const assets = Array.isArray(req.body?.assets) ? req.body.assets : [];
  if (!assets.length) return res.status(400).json({ message: 'No hay activos para respaldar' });
  const all = readData(BACKUP_FILE);
  const entry = {
    id: generateId('BKP', all),
    createdAt: new Date().toISOString(),
    createdBy: req.user?.name || req.user?.email || 'desconocido',
    note: String(req.body?.note || ''),
    count: assets.length,
    totalCosto: assets.reduce((s, a) => s + (Number(a.costoAdquisicion) || 0), 0),
    assets,
  };
  all.unshift(entry);
  writeData(BACKUP_FILE, all.slice(0, 50));
  const { assets: _omit, ...meta } = entry;
  res.status(201).json(meta);
});

// Descarga/restaura un respaldo puntual (incluye payload)
router.get('/backups/:id', auth, guard, (req, res) => {
  const all = readData(BACKUP_FILE);
  const found = all.find((b) => b.id === req.params.id);
  if (!found) return res.status(404).json({ message: 'Respaldo no encontrado' });
  res.json(found);
});

router.delete('/backups/:id', auth, guard, (req, res) => {
  const all = readData(BACKUP_FILE);
  const idx = all.findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Respaldo no encontrado' });
  all.splice(idx, 1);
  writeData(BACKUP_FILE, all);
  res.status(204).send();
});

/* ─────────────────── ANALÍTICA SOBRE [SafeOne].[dbo].[ActivoFijo] ─────────────────── */

// Ejecuta una consulta tolerando tablas/columnas ausentes en el esquema.
async function safeQuery(text) {
  try {
    return { ok: true, rows: await sql.query(text) };
  } catch (e) {
    return { ok: false, error: e.message, rows: [] };
  }
}

const Q = {
  resumen: `
    SELECT
      COUNT(*) AS TotalActivos,
      SUM(CASE WHEN ISNULL(Retirado,0) = 0 THEN 1 ELSE 0 END) AS ActivosActivos,
      SUM(CASE WHEN Retirado = 1 THEN 1 ELSE 0 END) AS ActivosRetirados,
      SUM(CASE WHEN Serial IS NULL OR Serial = '' OR Serial = 'NULL' THEN 1 ELSE 0 END) AS SinSerial,
      SUM(CASE WHEN Encargado IS NULL OR Encargado = '' OR Encargado = 'NULL' THEN 1 ELSE 0 END) AS SinEncargado,
      SUM(CASE WHEN FechaAdq IS NULL THEN 1 ELSE 0 END) AS SinFechaAdq,
      SUM(CASE WHEN CostoAdq IS NULL OR CostoAdq = 0 THEN 1 ELSE 0 END) AS SinCosto,
      SUM(CASE WHEN CostoAdq = 1 THEN 1 ELSE 0 END) AS CostoSimbolico,
      SUM(CostoAdq) AS ValorTotalInventario,
      AVG(CostoAdq) AS ValorPromedioActivo,
      MIN(CostoAdq) AS MinValor,
      MAX(CostoAdq) AS MaxValor,
      MIN(FechaAdq) AS PrimeraCompra,
      MAX(FechaAdq) AS UltimaCompra
    FROM dbo.ActivoFijo
    WHERE GCRecord IS NULL`,

  suplidores: `
    SELECT TOP 10
      s.Nombre AS Suplidor,
      COUNT(a.OID) AS CantidadActivos,
      SUM(a.CostoAdq) AS TotalInvertido,
      AVG(a.CostoAdq) AS PromedioPorActivo,
      MIN(a.FechaAdq) AS PrimeraCompra,
      MAX(a.FechaAdq) AS UltimaCompra
    FROM dbo.ActivoFijo a
    INNER JOIN dbo.Suplidor s ON a.Suplidor = s.OID
    WHERE a.Suplidor IS NOT NULL AND ISNULL(a.Retirado,0) = 0
      AND a.CostoAdq > 0 AND a.GCRecord IS NULL
    GROUP BY s.Nombre, s.OID
    ORDER BY SUM(a.CostoAdq) DESC`,

  categorias: `
    SELECT
      ISNULL(c.Descripcion, 'SIN CATEGORÍA') AS Categoria,
      ISNULL(t.Descripcion, 'SIN TIPO') AS Tipo,
      COUNT(*) AS Cantidad,
      SUM(a.CostoAdq) AS ValorTotal,
      AVG(a.CostoAdq) AS ValorPromedio
    FROM dbo.ActivoFijo a
    LEFT JOIN dbo.AFCategoria c ON a.Categoria = c.OID
    LEFT JOIN dbo.AFTipo t ON a.Tipo = t.OID
    WHERE ISNULL(a.Retirado,0) = 0 AND a.CostoAdq > 0 AND a.GCRecord IS NULL
    GROUP BY c.Descripcion, t.Descripcion
    ORDER BY SUM(a.CostoAdq) DESC`,

  departamentos: `
    SELECT
      ISNULL(NULLIF(LTRIM(RTRIM(a.Departamento)),''), 'SIN ASIGNAR') AS Departamento,
      ISNULL(NULLIF(LTRIM(RTRIM(a.Ubicacion)),''), 'SIN UBICACIÓN') AS Ubicacion,
      COUNT(*) AS Cantidad,
      SUM(a.CostoAdq) AS ValorTotal,
      AVG(a.CostoAdq) AS ValorPromedio
    FROM dbo.ActivoFijo a
    WHERE ISNULL(a.Retirado,0) = 0 AND a.CostoAdq > 0 AND a.GCRecord IS NULL
    GROUP BY a.Departamento, a.Ubicacion
    ORDER BY SUM(a.CostoAdq) DESC`,

  antiguedad: `
    SELECT
      YEAR(a.FechaAdq) AS AnioAdquisicion,
      COUNT(*) AS Cantidad,
      SUM(a.CostoAdq) AS ValorTotal,
      AVG(a.CostoAdq) AS ValorPromedio,
      DATEDIFF(YEAR, MAX(a.FechaAdq), GETDATE()) AS AntiguedadAnios
    FROM dbo.ActivoFijo a
    WHERE ISNULL(a.Retirado,0) = 0 AND a.CostoAdq > 0
      AND a.FechaAdq IS NOT NULL AND a.GCRecord IS NULL
    GROUP BY YEAR(a.FechaAdq)
    ORDER BY YEAR(a.FechaAdq) DESC`,

  sinSerial: `
    SELECT OID, Descripcion, Modelo, Departamento, Ubicacion, Encargado, CostoAdq, FechaAdq
    FROM dbo.ActivoFijo
    WHERE (Serial IS NULL OR Serial = '' OR Serial = 'NULL')
      AND ISNULL(Retirado,0) = 0 AND GCRecord IS NULL
    ORDER BY CostoAdq DESC`,

  serialesDuplicados: `
    SELECT Serial, COUNT(*) AS Cantidad, SUM(CostoAdq) AS ValorAfectado
    FROM dbo.ActivoFijo
    WHERE Serial IS NOT NULL AND Serial <> '' AND Serial <> 'NULL'
      AND ISNULL(Retirado,0) = 0 AND GCRecord IS NULL
    GROUP BY Serial
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC`,

  sinEncargado: `
    SELECT OID, Descripcion, Serial, Departamento, Ubicacion, CostoAdq, FechaAdq
    FROM dbo.ActivoFijo
    WHERE (Encargado IS NULL OR Encargado = '' OR Encargado = 'NULL')
      AND ISNULL(Retirado,0) = 0 AND CostoAdq > 0 AND GCRecord IS NULL
    ORDER BY CostoAdq DESC`,

  calidad: `
    SELECT
      ROUND(100.0 * COUNT(CASE WHEN Serial IS NOT NULL AND Serial <> '' AND Serial <> 'NULL' THEN 1 END) / NULLIF(COUNT(*),0), 2) AS PorcentajeSerial,
      ROUND(100.0 * COUNT(CASE WHEN FechaAdq IS NOT NULL AND FechaAdq > '2000-01-01' THEN 1 END) / NULLIF(COUNT(*),0), 2) AS PorcentajeFecha,
      ROUND(100.0 * COUNT(CASE WHEN CostoAdq IS NOT NULL AND CostoAdq > 1 THEN 1 END) / NULLIF(COUNT(*),0), 2) AS PorcentajeCosto,
      ROUND(100.0 * COUNT(CASE WHEN Suplidor IS NOT NULL THEN 1 END) / NULLIF(COUNT(*),0), 2) AS PorcentajeSuplidor,
      ROUND(100.0 * COUNT(CASE WHEN Encargado IS NOT NULL AND Encargado <> '' AND Encargado <> 'NULL' THEN 1 END) / NULLIF(COUNT(*),0), 2) AS PorcentajeEncargado,
      ROUND(100.0 * COUNT(CASE WHEN Ubicacion IS NOT NULL AND Ubicacion <> '' THEN 1 END) / NULLIF(COUNT(*),0), 2) AS PorcentajeUbicacion
    FROM dbo.ActivoFijo
    WHERE GCRecord IS NULL`,

  movimientos: `
    SELECT TOP 300
      m.FechaMovimiento, m.TipoMovimiento, a.Descripcion AS Activo,
      m.UbicacionOrigen, m.UbicacionDestino, m.EncargadoOrigen, m.EncargadoDestino, m.Comentario
    FROM dbo.MovimientoActivo m
    INNER JOIN dbo.ActivoFijo a ON m.ActivoFijo = a.OID
    ORDER BY m.FechaMovimiento DESC`,

  depreciacion: `
    SELECT
      YEAR(d.FechaDepreciacion) AS Anio,
      SUM(d.MontoDepreciacion) AS TotalDepreciado,
      COUNT(*) AS CantidadRegistros,
      AVG(d.MontoDepreciacion) AS PromedioPorActivo
    FROM dbo.DepreciacionD d
    INNER JOIN dbo.ActivoFijo a ON d.ActivoFijo = a.OID
    WHERE ISNULL(a.Retirado,0) = 0
    GROUP BY YEAR(d.FechaDepreciacion)
    ORDER BY YEAR(d.FechaDepreciacion) DESC`,
};

router.get('/analytics', auth, guard, async (req, res) => {
  try {
    const keys = Object.keys(Q);
    const results = await Promise.all(keys.map((k) => safeQuery(Q[k])));
    const out = {};
    const errors = {};
    keys.forEach((k, i) => {
      out[k] = results[i].rows;
      if (!results[i].ok) errors[k] = results[i].error;
    });
    res.json({
      generatedAt: new Date().toISOString(),
      resumen: out.resumen[0] || null,
      calidad: out.calidad[0] || null,
      suplidores: out.suplidores,
      categorias: out.categorias,
      departamentos: out.departamentos,
      antiguedad: out.antiguedad,
      sinSerial: out.sinSerial,
      serialesDuplicados: out.serialesDuplicados,
      sinEncargado: out.sinEncargado,
      movimientos: out.movimientos,
      depreciacion: out.depreciacion,
      errors,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Esquema disponible (para saber qué tablas relacionadas existen realmente)
router.get('/schema', auth, guard, async (req, res) => {
  const r = await safeQuery(`
    SELECT t.name AS Tabla, COUNT(c.column_id) AS Columnas
    FROM sys.tables t
    LEFT JOIN sys.columns c ON c.object_id = t.object_id
    WHERE t.name LIKE '%Activo%' OR t.name LIKE 'AF%' OR t.name IN
      ('Suplidor','Ubicacion','Empleado','Departamento','DepreciacionD','MovimientoActivo')
    GROUP BY t.name ORDER BY t.name`);
  if (!r.ok) return res.status(500).json({ message: r.error });
  res.json({ tables: r.rows });
});

module.exports = router;

