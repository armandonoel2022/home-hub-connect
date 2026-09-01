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
  if (isFullAccess(user)) {
    return { user, level: 'full', empleado: null, deptOID: null, deptNombre: null };
  }
  const emp = await findEmpleado(user);
  if (!emp) {
    return { user, level: 'none', empleado: null, deptOID: null, deptNombre: null };
  }
  const deptOID = emp.Departamento == null ? null : Number(emp.Departamento);
  const leader = !!user.isDepartmentLeader;
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

const PAYSLIP_INCOME = [
  'Salario', 'Horas Normales', 'Horas Extras', 'Horas Nocturnas', 'Horas Disponibles',
  'Horas Vacaciones', 'Horas por Novedad', 'Novedades Digitadas', 'Horas Extras Digitado',
  'Horas Nocturnas Digitada', 'Incentivo', 'Almuerzo Digitado', 'Dias Feriados Digitado',
];
const PAYSLIP_DEDUCTIONS = ['AFP', 'SFS', 'ISR', 'Comida', 'Prestamo', 'Avance Efectivo', 'Percapita', 'Uniforme'];

// ─── Comprobantes de pago dentro del alcance ───
router.get('/payslips', auth, async (req, res) => {
  const int = (v) => (v == null || v === '' ? null : Number.parseInt(String(v), 10));
  const ano = int(req.query.ano), mes = int(req.query.mes), periodo = int(req.query.periodo);
  const usarPeriodo = Number.isFinite(ano) && Number.isFinite(mes) && Number.isFinite(periodo);
  const brackets = (arr) => arr.map((c) => `[${c}]`).join(', ');
  const sumOf = (arr) => arr.map((c) => `ISNULL([${c}], 0)`).join(' + ');

  try {
    const s = await resolveScope(req);
    if (s.level === 'none') {
      return res.json({
        level: s.level, count: 0, items: [],
        conceptos: { ingresos: PAYSLIP_INCOME, deducciones: PAYSLIP_DEDUCTIONS },
        totals: { devengado: 0, deducciones: 0, neto: 0 },
        message: 'No se encontró tu registro de empleado en GENERAL (verifica cédula o código).',
      });
    }
    const where = scopeClause(s);

    const fuente = usarPeriodo
      ? `DatosPago AS (
  SELECT e.NombreCompleto AS Empleado, e.Codigo, e.Cedula, e.Puesto,
         c.Descripcion AS Concepto,
         IIF(c.Tipo = 1, pd.Calculado, -pd.Calculado) AS Monto,
         p.Fecha AS FechaPago, p.Periodo, p.Mes, p.Ano, p.Nomina
  FROM Empleado e
  INNER JOIN PagoD pd ON pd.Empleado = e.OID
  INNER JOIN PagoConcepto pc ON pd.PagoConcepto = pc.OID
  INNER JOIN Pago p ON pc.Pago = p.OID
  INNER JOIN Concepto c ON pc.Concepto = c.OID
  WHERE e.Estatus = 0 AND e.GCRecord IS NULL AND p.GCRecord IS NULL AND pd.Calculado > 0
    AND ${where}
    AND p.Ano = ${ano} AND p.Mes = ${mes} AND p.Periodo = ${periodo}
)`
      : `UltimoPagoPorEmpleado AS (
  SELECT pd.Empleado, MAX(p.Fecha) AS UltimaFechaPago, MAX(p.OID) AS UltimoPagoOID
  FROM PagoD pd
  INNER JOIN PagoConcepto pc ON pd.PagoConcepto = pc.OID
  INNER JOIN Pago p ON pc.Pago = p.OID
  WHERE pd.Calculado > 0 AND p.GCRecord IS NULL
  GROUP BY pd.Empleado
),
DatosPago AS (
  SELECT e.NombreCompleto AS Empleado, e.Codigo, e.Cedula, e.Puesto,
         c.Descripcion AS Concepto,
         IIF(c.Tipo = 1, pd.Calculado, -pd.Calculado) AS Monto,
         p.Fecha AS FechaPago, p.Periodo, p.Mes, p.Ano, p.Nomina
  FROM Empleado e
  LEFT JOIN UltimoPagoPorEmpleado uppe ON e.OID = uppe.Empleado
  LEFT JOIN PagoD pd ON pd.Empleado = e.OID AND pd.Pago = uppe.UltimoPagoOID
  LEFT JOIN PagoConcepto pc ON pd.PagoConcepto = pc.OID
  LEFT JOIN Pago p ON pc.Pago = p.OID
  LEFT JOIN Concepto c ON pc.Concepto = c.OID
  WHERE e.Estatus = 0 AND e.GCRecord IS NULL AND pd.Calculado > 0
    AND ${where}
)`;

    const text = `
WITH ${fuente}
SELECT Empleado, Codigo, Cedula, Puesto, FechaPago, Periodo, Mes, Ano, Nomina,
  ${PAYSLIP_INCOME.map((c) => `ISNULL([${c}], 0) AS [${c}]`).join(',\n  ')},
  ${PAYSLIP_DEDUCTIONS.map((c) => `ISNULL([${c}], 0) AS [${c}]`).join(',\n  ')},
  ${sumOf(PAYSLIP_INCOME)} AS TotalDevengado,
  ${sumOf(PAYSLIP_DEDUCTIONS)} AS TotalDeducciones
FROM DatosPago
PIVOT (SUM(Monto) FOR Concepto IN (${brackets([...PAYSLIP_INCOME, ...PAYSLIP_DEDUCTIONS])})) AS PivotTable
ORDER BY Empleado`;

    const rows = await sql.query(text);
    const num = (v) => round2(v);
    const items = rows.map((r) => {
      const ingresos = {}; const deducciones = {};
      PAYSLIP_INCOME.forEach((c) => { ingresos[c] = num(r[c]); });
      PAYSLIP_DEDUCTIONS.forEach((c) => { deducciones[c] = Math.abs(num(r[c])); });
      const totalDevengado = num(r.TotalDevengado);
      const totalDeducciones = Math.abs(num(r.TotalDeducciones));
      return {
        empleado: cleanStr(r.Empleado),
        codigo: cleanStr(r.Codigo),
        cedula: cleanStr(r.Cedula),
        fechaPago: r.FechaPago || null,
        periodo: r.Periodo ?? null,
        mes: r.Mes ?? null,
        ano: r.Ano ?? null,
        nomina: r.Nomina ?? null,
        ingresos, deducciones,
        totalDevengado, totalDeducciones,
        neto: round2(totalDevengado - totalDeducciones),
      };
    });
    const totals = items.reduce((a, i) => ({
      devengado: a.devengado + i.totalDevengado,
      deducciones: a.deducciones + i.totalDeducciones,
      neto: a.neto + i.neto,
    }), { devengado: 0, deducciones: 0, neto: 0 });

    res.json({
      level: s.level,
      deptNombre: s.deptNombre,
      count: items.length,
      conceptos: { ingresos: PAYSLIP_INCOME, deducciones: PAYSLIP_DEDUCTIONS },
      totals: {
        devengado: round2(totals.devengado),
        deducciones: round2(totals.deducciones),
        neto: round2(totals.neto),
      },
      items,
    });
  } catch (e) { res.status(502).json({ message: e.message }); }
});

module.exports = router;
module.exports.isFullAccess = isFullAccess;
