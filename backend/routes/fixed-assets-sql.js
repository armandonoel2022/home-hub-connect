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

const router = express.Router();

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

module.exports = router;
