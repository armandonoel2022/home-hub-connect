/**
 * Nómina personal / de equipo (gSafeOne) — SOLO LECTURA.
 *
 * A diferencia de /api/general-sql (que expone la nómina COMPLETA y está
 * restringido a RRHH / super usuarios), este módulo lo puede consultar
 * cualquier usuario autenticado, pero el resultado se filtra por alcance:
 *
 *   - full : RRHH + lista de excepciones (Aurelio, Samuel, Armando, Chrisnel, TI)
 *   - dept : líderes de departamento → ellos mismos + su departamento (Empleado.Departamento)
 *   - self : empleados regulares → únicamente su propio registro
 *
 * El filtro de departamento usa el OID de la tabla Departamento de gSafeOne
 * (ej. Seguridad Electrónica = 10), resuelto a partir del propio registro de
 * Empleado del usuario, nunca de un parámetro enviado por el cliente.
 */
const express = require('express');
const auth = require('../middleware/auth');
const sql = require('../config/sqlServer');
const { readData } = require('../config/database');

const router = express.Router();
const USERS_FILE = 'users.json';

// Excepciones autorizadas a ver TODA la nómina.
const FULL_ACCESS_EMAILS = [
  'tecnologia@safeone.com.do', // Administrador de la Intranet
  'anoel@safeone.com.do',      // Armando Noel
  'aperez@safeone.com.do',     // Aurelio Pérez
  'sperez@safeone.com.do',     // Samuel Pérez
  'samuel@safeone.com.do',
  'aurelio@safeone.com.do',
  'cfabian@safeone.com.do',    // Chrisnel Fabián
];

const norm = (s) => String(s || '').toLowerCase().trim();
const digits = (s) => String(s ?? '').replace(/[^0-9]/g, '');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const cleanStr = (v) => (v == null ? null : String(v).trim() || null);

function isFullAccess(user) {
  if (!user) return false;
  if (FULL_ACCESS_EMAILS.includes(norm(user.email))) return true;
  return /recursos humanos|rrhh/.test(norm(user.department));
}

function loadUser(req) {
  const users = readData(USERS_FILE) || [];
  return (
    users.find((u) => u.id === req.user.id) ||
    users.find((u) => norm(u.email) === norm(req.user.email)) ||
    null
  );
}

/** Localiza el registro Empleado del usuario: cédula → código de empleado. */
async function findEmpleado(user) {
  if (!user) return null;
  const ced = digits(user.cedula);
  if (ced) {
    const rows = await sql.query(
      `SELECT TOP 1 OID, Codigo, NombreCompleto, Nombre1, Apellido1, Cedula, Departamento, Puesto, Estatus
       FROM Empleado
       WHERE GCRecord IS NULL AND REPLACE(REPLACE(ISNULL(Cedula,''),'-',''),' ','') = @ced`,
      { ced }
    );
    if (rows.length) return rows[0];
  }
  const cod = digits(user.employeeCode);
  if (cod) {
    const rows = await sql.query(
      `SELECT TOP 1 OID, Codigo, NombreCompleto, Nombre1, Apellido1, Cedula, Departamento, Puesto, Estatus
       FROM Empleado WHERE GCRecord IS NULL AND Codigo = @cod`,
      { cod: Number(cod) }
    );
    if (rows.length) return rows[0];
  }
  return null;
}

async function deptName(oid) {
  if (oid == null) return null;
  try {
    const rows = await sql.query(
      `SELECT TOP 1 Descripcion FROM Departamento WHERE OID = @oid`,
      { oid: Number(oid) }
    );
    return cleanStr(rows[0]?.Descripcion);
  } catch { return null; }
}

/**
 * Resuelve el alcance del usuario autenticado.
 * Devuelve { level, empleado, deptOID, deptNombre }.
 */
async function resolveScope(req) {
  const user = loadUser(req);
  if (!user) throw new Error('Usuario no encontrado');
  // "Mi Nómina" NUNCA muestra la nómina completa (eso vive en RRHH → Nómina).
  // Los usuarios con acceso total se tratan como líderes de su propio departamento.
  const emp = await findEmpleado(user);
  if (!emp) {
    return { user, level: 'none', empleado: null, deptOID: null, deptNombre: null };
  }
  const deptOID = emp.Departamento == null ? null : Number(emp.Departamento);
  const leader = !!user.isDepartmentLeader || isFullAccess(user);
  return {
    user,
    level: leader && deptOID != null ? 'dept' : 'self',
    empleado: emp,
    deptOID,
    deptNombre: await deptName(deptOID),
  };
}


/** Cláusula SQL (sobre alias `e` de Empleado) según el alcance. */
function scopeClause(scope, alias = 'e') {
  if (scope.level === 'full') return '1 = 1';
  if (scope.level === 'dept') return `${alias}.Departamento = ${Number(scope.deptOID)}`;
  if (scope.level === 'self') return `${alias}.OID = ${Number(scope.empleado.OID)}`;
  return '1 = 0';
}

// ─── Alcance del usuario actual ───
router.get('/scope', auth, async (req, res) => {
  try {
    const s = await resolveScope(req);
    res.json({
      level: s.level,
      deptOID: s.deptOID,
      deptNombre: s.deptNombre,
      empleado: s.empleado
        ? {
            oid: s.empleado.OID,
            codigo: cleanStr(s.empleado.Codigo),
            cedula: cleanStr(s.empleado.Cedula),
            nombre: cleanStr(s.empleado.NombreCompleto) ||
              [s.empleado.Nombre1, s.empleado.Apellido1].filter(Boolean).join(' '),
          }
        : null,
    });
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Compañeros visibles según alcance ───
router.get('/team', auth, async (req, res) => {
  try {
    const s = await resolveScope(req);
    if (s.level === 'none') return res.json({ level: s.level, items: [] });
    const rows = await sql.query(
      `SELECT e.OID, e.Codigo, e.NombreCompleto, e.Nombre1, e.Apellido1, e.Cedula,
              e.Departamento, e.Salario, e.FechaIngreso
       FROM Empleado e
       WHERE e.Estatus = 0 AND e.GCRecord IS NULL AND ${scopeClause(s)}
       ORDER BY e.NombreCompleto`
    );
    res.json({
      level: s.level,
      deptNombre: s.deptNombre,
      items: rows.map((r) => ({
        oid: r.OID,
        codigo: cleanStr(r.Codigo),
        cedula: cleanStr(r.Cedula),
        nombre: cleanStr(r.NombreCompleto) || [r.Nombre1, r.Apellido1].filter(Boolean).join(' '),
        fechaIngreso: r.FechaIngreso || null,
        salario: Number(r.Salario) || 0,
      })),
    });
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Períodos de pago disponibles dentro del alcance ───
router.get('/periods', auth, async (req, res) => {
  try {
    const s = await resolveScope(req);
    if (s.level === 'none') return res.json([]);
    const rows = await sql.query(`
SELECT p.Ano, p.Mes, p.Periodo, MAX(p.Fecha) AS Fecha
FROM Pago p
INNER JOIN PagoConcepto pc ON pc.Pago = p.OID
INNER JOIN PagoD pd ON pd.PagoConcepto = pc.OID
INNER JOIN Empleado e ON pd.Empleado = e.OID
WHERE e.GCRecord IS NULL AND p.GCRecord IS NULL AND pd.Calculado > 0
  AND ${scopeClause(s)}
GROUP BY p.Ano, p.Mes, p.Periodo
ORDER BY p.Ano DESC, p.Mes DESC, p.Periodo DESC`);
    res.json(rows.map((r) => ({
      ano: Number(r.Ano), mes: Number(r.Mes), periodo: Number(r.Periodo),
      fecha: r.Fecha || null,
      descripcion: `Q${r.Periodo} ${String(r.Mes).padStart(2, '0')}/${r.Ano}`,
    })));
  } catch (e) { res.status(502).json({ message: e.message }); }
});

/**
 * Conceptos DINÁMICOS: no se usa una lista fija (antes faltaban seguros y otros
 * conceptos). Se leen todos los conceptos reales del pago desde Concepto.Tipo
 * (1 = ingreso, 0 = deducción), igual que el desglose de RRHH → Nómina.
 */

// ─── Comprobantes de pago dentro del alcance (todos los conceptos reales) ───
router.get('/payslips', auth, async (req, res) => {
  const int = (v) => (v == null || v === '' ? null : Number.parseInt(String(v), 10));
  const ano = int(req.query.ano), mes = int(req.query.mes), periodo = int(req.query.periodo);
  const usarPeriodo = Number.isFinite(ano) && Number.isFinite(mes) && Number.isFinite(periodo);

  try {
    const s = await resolveScope(req);
    if (s.level === 'none') {
      return res.json({
        level: s.level, count: 0, items: [],
        conceptos: { ingresos: [], deducciones: [] },
        totals: { devengado: 0, deducciones: 0, neto: 0 },
        message: 'No se encontró tu registro de empleado en GENERAL (verifica cédula o código).',
      });
    }
    const where = scopeClause(s);

    const text = usarPeriodo
      ? `SELECT e.NombreCompleto AS Empleado, e.Codigo, e.Cedula, e.Puesto,
       p.OID AS PagoOID, p.Fecha AS FechaPago, p.Periodo, p.Mes, p.Ano, p.Nomina,
       c.Descripcion AS Concepto, c.Tipo, pd.Calculado
FROM Empleado e
INNER JOIN PagoD pd ON pd.Empleado = e.OID
INNER JOIN PagoConcepto pc ON pd.PagoConcepto = pc.OID
INNER JOIN Pago p ON pc.Pago = p.OID
INNER JOIN Concepto c ON pc.Concepto = c.OID
WHERE e.Estatus = 0 AND e.GCRecord IS NULL AND p.GCRecord IS NULL AND pd.Calculado > 0
  AND ${where}
  AND p.Ano = ${ano} AND p.Mes = ${mes} AND p.Periodo = ${periodo}
ORDER BY e.NombreCompleto, c.Tipo DESC, c.Descripcion`
      : `WITH UltimoPagoPorEmpleado AS (
  SELECT pd.Empleado, MAX(p.OID) AS UltimoPagoOID
  FROM PagoD pd
  INNER JOIN PagoConcepto pc ON pd.PagoConcepto = pc.OID
  INNER JOIN Pago p ON pc.Pago = p.OID
  WHERE pd.Calculado > 0 AND p.GCRecord IS NULL
  GROUP BY pd.Empleado
)
SELECT e.NombreCompleto AS Empleado, e.Codigo, e.Cedula, e.Puesto,
       p.OID AS PagoOID, p.Fecha AS FechaPago, p.Periodo, p.Mes, p.Ano, p.Nomina,
       c.Descripcion AS Concepto, c.Tipo, pd.Calculado
FROM Empleado e
INNER JOIN UltimoPagoPorEmpleado uppe ON e.OID = uppe.Empleado
INNER JOIN PagoD pd ON pd.Empleado = e.OID AND pd.Pago = uppe.UltimoPagoOID
INNER JOIN PagoConcepto pc ON pd.PagoConcepto = pc.OID
INNER JOIN Pago p ON pc.Pago = p.OID
INNER JOIN Concepto c ON pc.Concepto = c.OID
WHERE e.Estatus = 0 AND e.GCRecord IS NULL AND p.GCRecord IS NULL AND pd.Calculado > 0
  AND ${where}
ORDER BY e.NombreCompleto, c.Tipo DESC, c.Descripcion`;

    const rows = await sql.query(text);

    const byEmp = new Map();
    const setIngresos = new Set();
    const setDeducciones = new Set();

    for (const r of rows) {
      const key = `${r.Codigo ?? ''}-${r.PagoOID}`;
      if (!byEmp.has(key)) {
        byEmp.set(key, {
          empleado: cleanStr(r.Empleado),
          codigo: cleanStr(r.Codigo),
          cedula: cleanStr(r.Cedula),
          puesto: typeof r.Puesto === 'number' ? null : cleanStr(r.Puesto),
          pagoOid: Number(r.PagoOID) || null,
          fechaPago: r.FechaPago || null,
          periodo: r.Periodo ?? null,
          mes: r.Mes ?? null,
          ano: r.Ano ?? null,
          nomina: r.Nomina ?? null,
          ingresos: {},
          deducciones: {},
          totalDevengado: 0,
          totalDeducciones: 0,
          neto: 0,
        });
      }
      const it = byEmp.get(key);
      const concepto = cleanStr(r.Concepto) || 'Otro';
      const monto = Math.abs(round2(r.Calculado));
      if (Number(r.Tipo) === 1) {
        it.ingresos[concepto] = round2((it.ingresos[concepto] || 0) + monto);
        it.totalDevengado = round2(it.totalDevengado + monto);
        setIngresos.add(concepto);
      } else {
        it.deducciones[concepto] = round2((it.deducciones[concepto] || 0) + monto);
        it.totalDeducciones = round2(it.totalDeducciones + monto);
        setDeducciones.add(concepto);
      }
    }

    const items = [...byEmp.values()].map((i) => ({
      ...i,
      neto: round2(i.totalDevengado - i.totalDeducciones),
    })).sort((a, b) => String(a.empleado).localeCompare(String(b.empleado), 'es'));

    const totals = items.reduce((a, i) => ({
      devengado: a.devengado + i.totalDevengado,
      deducciones: a.deducciones + i.totalDeducciones,
      neto: a.neto + i.neto,
    }), { devengado: 0, deducciones: 0, neto: 0 });

    res.json({
      level: s.level,
      deptNombre: s.deptNombre,
      count: items.length,
      conceptos: {
        ingresos: [...setIngresos].sort((a, b) => a.localeCompare(b, 'es')),
        deducciones: [...setDeducciones].sort((a, b) => a.localeCompare(b, 'es')),
      },
      totals: {
        devengado: round2(totals.devengado),
        deducciones: round2(totals.deducciones),
        neto: round2(totals.neto),
      },
      items,
    });
  } catch (e) { res.status(502).json({ message: e.message }); }
});

/** ¿El código de empleado está dentro del alcance del usuario? */
async function codeInScope(scope, codigo) {
  const cod = digits(codigo);
  if (!cod) return false;
  const rows = await sql.query(
    `SELECT TOP 1 e.OID FROM Empleado e
     WHERE e.GCRecord IS NULL AND e.Codigo = ${Number(cod)} AND ${scopeClause(scope)}`
  );
  return rows.length > 0;
}

// ─── Historial de pagos de un empleado dentro del alcance ───
router.get('/payments', auth, async (req, res) => {
  try {
    const s = await resolveScope(req);
    if (s.level === 'none') return res.json([]);
    const cod = digits(req.query.codigo) || digits(s.empleado?.Codigo);
    if (!cod || !(await codeInScope(s, cod))) {
      return res.status(403).json({ message: 'Fuera de tu alcance de nómina.' });
    }
    const rows = await sql.query(`
SELECT p.OID AS PagoOID, p.Fecha, p.Periodo, p.Mes, p.Ano, p.Nomina,
  SUM(IIF(c.Tipo = 1, pd.Calculado, 0)) AS TotalDevengado,
  SUM(IIF(c.Tipo = 0, pd.Calculado, 0)) AS TotalDeducciones,
  SUM(IIF(c.Tipo = 1, pd.Calculado, -pd.Calculado)) AS Neto,
  COUNT(DISTINCT pd.OID) AS Conceptos
FROM PagoD pd
INNER JOIN PagoConcepto pc ON pd.PagoConcepto = pc.OID
INNER JOIN Pago p ON pc.Pago = p.OID
INNER JOIN Concepto c ON pc.Concepto = c.OID
INNER JOIN Empleado e ON pd.Empleado = e.OID
WHERE e.Codigo = ${Number(cod)} AND p.GCRecord IS NULL AND pd.Calculado > 0
GROUP BY p.OID, p.Fecha, p.Periodo, p.Mes, p.Ano, p.Nomina
ORDER BY p.Ano DESC, p.Mes DESC, p.Periodo DESC`);
    res.json(rows.map((r) => ({
      pagoOid: Number(r.PagoOID), fecha: r.Fecha || null,
      periodo: r.Periodo ?? null, mes: r.Mes ?? null, ano: r.Ano ?? null, nomina: r.Nomina ?? null,
      descripcion: r.Periodo === 1 ? 'Quincena 1 (1-15)' : 'Quincena 2 (16-fin)',
      totalDevengado: round2(Number(r.TotalDevengado) || 0),
      totalDeducciones: round2(Number(r.TotalDeducciones) || 0),
      neto: round2(Number(r.Neto) || 0),
      conceptos: Number(r.Conceptos) || 0,
    })));
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Desglose completo de un pago dentro del alcance ───
router.get('/payment-detail', auth, async (req, res) => {
  const pagoOid = Number.parseInt(String(req.query.pagoOid), 10);
  try {
    const s = await resolveScope(req);
    if (s.level === 'none') return res.status(403).json({ message: 'Sin alcance de nómina.' });
    const cod = digits(req.query.codigo) || digits(s.empleado?.Codigo);
    if (!cod || !Number.isFinite(pagoOid)) return res.status(400).json({ message: 'codigo y pagoOid requeridos' });
    if (!(await codeInScope(s, cod))) return res.status(403).json({ message: 'Fuera de tu alcance de nómina.' });

    const rows = await sql.query(`
SELECT e.NombreCompleto AS Empleado, e.Codigo, e.Cedula, e.Puesto,
  c.Descripcion AS Concepto, c.Tipo, pd.Valor, pd.Calculado, pd.Comentario,
  p.Fecha, p.Periodo, p.Mes, p.Ano, p.Nomina
FROM PagoD pd
INNER JOIN PagoConcepto pc ON pd.PagoConcepto = pc.OID
INNER JOIN Pago p ON pc.Pago = p.OID
INNER JOIN Concepto c ON pc.Concepto = c.OID
INNER JOIN Empleado e ON pd.Empleado = e.OID
WHERE e.Codigo = ${Number(cod)} AND p.OID = ${pagoOid} AND p.GCRecord IS NULL AND pd.Calculado > 0
ORDER BY c.Tipo DESC, c.Descripcion`);
    const first = rows[0] || {};
    const lineas = rows.map((r) => ({
      concepto: cleanStr(r.Concepto),
      tipo: Number(r.Tipo),
      valor: Number(r.Valor) || 0,
      calculado: round2(Number(r.Calculado) || 0),
      monto: round2(Number(r.Tipo) === 1 ? Number(r.Calculado) || 0 : -(Number(r.Calculado) || 0)),
      comentario: cleanStr(r.Comentario),
    }));
    const devengado = round2(lineas.filter((l) => l.tipo === 1).reduce((a, l) => a + l.calculado, 0));
    const deducciones = round2(lineas.filter((l) => l.tipo !== 1).reduce((a, l) => a + l.calculado, 0));
    res.json({
      empleado: cleanStr(first.Empleado), codigo: cleanStr(first.Codigo), cedula: cleanStr(first.Cedula),
      puesto: typeof first.Puesto === 'number' ? null : cleanStr(first.Puesto),
      fecha: first.Fecha || null, periodo: first.Periodo ?? null, mes: first.Mes ?? null,
      ano: first.Ano ?? null, nomina: first.Nomina ?? null,
      lineas, totalDevengado: devengado, totalDeducciones: deducciones,
      neto: round2(devengado - deducciones),
    });
  } catch (e) { res.status(502).json({ message: e.message }); }
});

module.exports = router;
module.exports.isFullAccess = isFullAccess;
