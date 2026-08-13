/**
 * Módulo GENERAL (gSafeOne) — Nómina Analítica.
 * SOLO LECTURA sobre SQL Server + motor analítico/predictivo.
 *
 * Endpoints:
 *   GET  /status                 → estado de conexión
 *   GET  /tables                 → tablas disponibles (descubrimiento)
 *   GET  /columns/:table         → columnas de una tabla
 *   GET  /periods                → períodos de pago (tabla Pago)
 *   GET  /payroll/:pagoOID       → detalle de nómina (PagoD + Empleado)
 *   GET  /overtime               → horas extras (ReporteServExt) por rango
 *   GET  /holidays               → días feriados (DiaFeriadoD) por año
 *   POST /analyze                → anomalías + conciliación Excel + predicción
 */
const express = require('express');
const auth = require('../middleware/auth');
const sql = require('../config/sqlServer');
const { readData } = require('../config/database');
const { detectAnomalies, reconcileExcel, forecast, round2 } = require('../helpers/payrollAnalytics');

const router = express.Router();

function canAccess(user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const dept = String(user.department || '').toLowerCase();
  // Operaciones también consulta el Expediente de Clientes (armas/puestos).
  return /recursos humanos|rrhh|tecnolog|gerencia|operac/.test(dept);
}

function guard(req, res, next) {
  if (!canAccess(req.user)) return res.status(403).json({ message: 'No autorizado' });
  next();
}

const fullName = (r) => [r.Nombre1, r.Apellido1].filter(Boolean).join(' ').trim();

// Algunas instalaciones de GENERAL/gSafeOne no exponen la columna "Codigo" en
// todos los maestros (Cliente, HoraContratada, etc.). Para no romper la lectura
// del reporte diario, las columnas no críticas se seleccionan solo si existen.
const _tableColumnsCache = new Map();
async function tableColumnsMap(tableName) {
  const key = String(tableName || '').toLowerCase();
  if (_tableColumnsCache.has(key)) return _tableColumnsCache.get(key);
  const cols = await sql.listColumns(tableName);
  const map = new Map(cols.map((c) => [String(c.name).toLowerCase(), c.name]));
  _tableColumnsCache.set(key, map);
  return map;
}

async function optionalColumnExpr(tableName, alias, columnName, outAlias, fallback = 'NULL') {
  const cols = await tableColumnsMap(tableName);
  const real = cols.get(String(columnName).toLowerCase());
  return real ? `${alias}.[${real}] AS [${outAlias}]` : `${fallback} AS [${outAlias}]`;
}

// ─── Descubrimiento dinámico de columnas de PagoD ───
// La estructura de XAF varía: PagoD suele tener varias filas por empleado
// (una por concepto/TipoPago) y la columna de importe puede llamarse
// Monto / Valor / Importe / Neto / Total… Descubrimos la columna real una vez
// y la cacheamos para agregar correctamente por empleado.
const NUMERIC_RE = /int|decimal|numeric|money|float|real/;
let _pagoDMeta = null;
let _pagoHasTipoPago = null;

async function pagoDMeta() {
  if (_pagoDMeta) return _pagoDMeta;
  const cols = await sql.listColumns('PagoD');
  const numeric = cols
    .filter((c) => NUMERIC_RE.test(String(c.type).toLowerCase()))
    .map((c) => c.name);
  const skip = /^oid$|optimisticlock|gcrecord|objecttype|^pago$|^empleado$|^tipopago$|cantidad|horas|dias|orden|secuencia|^id$|version/i;
  const candidates = numeric.filter((n) => !skip.test(n));
  const priority = [/^neto$/i, /^monto$/i, /^valor$/i, /^importe$/i, /^totalpagar$/i, /^total$/i, /salario|sueldo/i, /pago/i];
  let amount = null;
  for (const re of priority) {
    const hit = candidates.find((n) => re.test(n));
    if (hit) { amount = hit; break; }
  }
  if (!amount) amount = candidates[0] || null;
  _pagoDMeta = { amount, candidates, numeric };
  return _pagoDMeta;
}

async function pagoHasTipoPago() {
  if (_pagoHasTipoPago !== null) return _pagoHasTipoPago;
  const cols = await sql.listColumns('Pago');
  _pagoHasTipoPago = cols.some((c) => String(c.name).toLowerCase() === 'tipopago');
  return _pagoHasTipoPago;
}

// Lee la nómina AGREGADA por empleado (una fila por persona) para un Pago.
async function readPayroll(pagoOID) {
  const meta = await pagoDMeta();
  const sumExpr = meta.amount ? `ISNULL(d.[${meta.amount}],0)` : '0';
  const rows = await sql.query(
    `SELECT e.OID AS EmpleadoOID, MAX(e.Codigo) AS Codigo,
            MAX(e.Nombre1) AS Nombre1, MAX(e.Apellido1) AS Apellido1,
            MAX(e.Departamento) AS DeptOID, MAX(ISNULL(e.Salario,0)) AS Salario,
            SUM(${sumExpr}) AS Monto, COUNT(*) AS Lineas
     FROM PagoD d
     JOIN Empleado e ON e.OID = d.Empleado
     WHERE d.Pago = @pago AND d.GCRecord IS NULL
     GROUP BY e.OID`,
    { pago: pagoOID }
  );
  return rows.map((r) => {
    const monto = Number(r.Monto) || 0;
    const salario = Number(r.Salario) || 0;
    return {
      empleadoOID: r.EmpleadoOID,
      codigo: r.Codigo,
      nombre: fullName(r),
      departamento: r.DeptOID ?? null,
      salario,
      bruto: round2(monto),
      deducciones: 0,
      neto: round2(monto),
      lineas: Number(r.Lineas) || 0,
    };
  });
}

// ─── Estado / descubrimiento ───
router.get('/status', auth, guard, async (req, res) => {
  try { res.json(await sql.status()); }
  catch (e) { res.json({ configured: sql.isConfigured(), connected: false, message: e.message }); }
});

router.get('/tables', auth, guard, async (req, res) => {
  try { res.json(await sql.listTables()); }
  catch (e) { res.status(502).json({ message: e.message }); }
});

router.get('/columns/:table', auth, guard, async (req, res) => {
  try { res.json(await sql.listColumns(req.params.table)); }
  catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Períodos de pago ───
router.get('/periods', auth, guard, async (req, res) => {
  try {
    const rows = await sql.query(
      `SELECT TOP 60 p.OID, p.Fecha, p.Mes, p.Ano, p.Cerrado,
              p.FechaDesde, p.FechaHasta, n.Descripcion AS Nomina
       FROM Pago p
       LEFT JOIN Nomina n ON n.OID = p.Nomina
       WHERE p.GCRecord IS NULL
       ORDER BY p.Ano DESC, p.Mes DESC, p.Fecha DESC`
    );
    res.json(rows);
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Detalle de nómina ───
router.get('/payroll/:pagoOID', auth, guard, async (req, res) => {
  try {
    const items = await readPayroll(req.params.pagoOID);
    const totals = items.reduce((a, i) => ({
      bruto: a.bruto + i.bruto, deducciones: a.deducciones + i.deducciones, neto: a.neto + i.neto,
    }), { bruto: 0, deducciones: 0, neto: 0 });
    res.json({
      count: items.length,
      totals: { bruto: round2(totals.bruto), deducciones: round2(totals.deducciones), neto: round2(totals.neto) },
      items,
    });
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Horas extras (ReporteServExt) ───
router.get('/overtime', auth, guard, async (req, res) => {
  const { desde, hasta } = req.query;
  if (!desde || !hasta) return res.status(400).json({ message: 'desde y hasta requeridos (YYYY-MM-DD)' });
  try {
    const rows = await sql.query(
      `SELECT rse.OID, rse.Horas, e.Codigo, e.Nombre1, e.Apellido1,
              rd.Fecha, rd.Feriado
       FROM ReporteServExt rse
       JOIN ReporteDiarioD rdd ON rdd.OID = rse.ReporteDiarioD
       JOIN ReporteDiario rd ON rd.OID = rdd.ReporteDiario
       LEFT JOIN Empleado e ON e.OID = rse.Vigilante
       WHERE rse.GCRecord IS NULL AND rd.Fecha >= @desde AND rd.Fecha <= @hasta
       ORDER BY rd.Fecha`,
      { desde, hasta }
    );
    res.json(rows.map(r => ({
      oid: r.OID, codigo: r.Codigo, empleado: fullName(r),
      horas: Number(r.Horas) || 0, fecha: r.Fecha, feriado: !!r.Feriado,
    })));
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Días feriados ───
router.get('/holidays', auth, guard, async (req, res) => {
  const ano = Number(req.query.ano) || new Date().getFullYear();
  try {
    const rows = await sql.query(
      `SELECT d.OID, d.Descripcion, d.Fecha
       FROM DiaFeriadoD d
       JOIN DiaFeriado f ON f.OID = d.DiaFeriado
       WHERE d.GCRecord IS NULL AND f.Ano = @ano
       ORDER BY d.Fecha`,
      { ano }
    );
    res.json(rows.map(r => ({ oid: r.OID, descripcion: r.Descripcion, fecha: r.Fecha })));
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Tendencia / proyección de costo ───
// Solo Pago Normal (TipoPago=1) para mantener períodos homogéneos; al mezclar
// regalía, vacaciones, feriados, etc. la regresión no encuentra una serie
// comparable y la proyección queda vacía.
async function buildHistory() {
  const meta = await pagoDMeta();
  const amt = meta.amount ? `ISNULL(d.[${meta.amount}],0)` : '0';
  const hasTP = await pagoHasTipoPago();
  const where = `p.GCRecord IS NULL` + (hasTP ? ` AND p.TipoPago = 1` : '');
  const rows = await sql.query(
    `SELECT TOP 12 p.Ano, p.Mes, SUM(${amt}) AS Total
     FROM Pago p
     JOIN PagoD d ON d.Pago = p.OID AND d.GCRecord IS NULL
     WHERE ${where}
     GROUP BY p.Ano, p.Mes
     ORDER BY p.Ano DESC, p.Mes DESC`
  );
  // Orden cronológico ascendente para la regresión
  return rows.reverse().map(r => ({ label: `${r.Ano}-${String(r.Mes).padStart(2, '0')}`, total: round2(r.Total) }));
}

// reportadas en la intranet (líderes → Dilia) para conciliar contra Excel
function reportedExtrasForReconcile() {
  const all = readData('payroll-extras.json');
  const arr = Array.isArray(all) ? all : [];
  return arr
    .filter(x => x.type === 'overtime' || x.type === 'holiday')
    .map(x => ({
      codigo: x.employeeCode,
      empleado: x.employeeName || x.fullName || '',
      tipo: x.type,
      monto: Number(x.amount) || 0,
    }));
}

// ─── Análisis integral ───
// body: { current: pagoOID, previous?: pagoOID, excelRows?: [{empleado,codigo,concepto,monto}] }
router.post('/analyze', auth, guard, async (req, res) => {
  const { current, previous, excelRows = [] } = req.body || {};
  if (!current) return res.status(400).json({ message: 'current (OID de Pago) requerido' });
  try {
    const currentRows = await readPayroll(current);
    const previousRows = previous ? await readPayroll(previous) : [];
    const anomalies = detectAnomalies(currentRows, previousRows);

    const reported = reportedExtrasForReconcile();
    const reconciliation = reconcileExcel(reported, Array.isArray(excelRows) ? excelRows : []);

    const history = await buildHistory();
    const prediction = forecast(history, 3);

    res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        empleados: currentRows.length,
        brutoTotal: round2(currentRows.reduce((a, r) => a + r.bruto, 0)),
        netoTotal: round2(currentRows.reduce((a, r) => a + r.neto, 0)),
        deduccionesTotal: round2(currentRows.reduce((a, r) => a + r.deducciones, 0)),
        anomalias: anomalies.length,
        anomaliasAltas: anomalies.filter(a => a.severity === 'high').length,
      },
      anomalies,
      reconciliation,
      history,
      prediction,
      // Desglose por empleado (una fila por persona, ordenado por neto desc)
      items: currentRows.slice().sort((a, b) => b.neto - a.neto),
      meta: { amountColumn: (await pagoDMeta()).amount, filteredTipoPago: await pagoHasTipoPago() },
    });
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Histórico de pagos de un empleado ───
router.get('/employee-history/:empleadoOID', auth, guard, async (req, res) => {
  try {
    const meta = await pagoDMeta();
    const amt = meta.amount ? `ISNULL(d.[${meta.amount}],0)` : '0';
    const hasTP = await pagoHasTipoPago();
    const rows = await sql.query(
      `SELECT TOP 36 p.OID, p.Ano, p.Mes, p.Fecha${hasTP ? ', p.TipoPago AS TipoPago' : ''},
              SUM(${amt}) AS Monto, COUNT(*) AS Lineas
       FROM Pago p
       JOIN PagoD d ON d.Pago = p.OID AND d.GCRecord IS NULL
       WHERE d.Empleado = @emp AND p.GCRecord IS NULL
       GROUP BY p.OID, p.Ano, p.Mes, p.Fecha${hasTP ? ', p.TipoPago' : ''}
       ORDER BY p.Ano DESC, p.Mes DESC`,
      { emp: req.params.empleadoOID }
    );
    res.json(rows.map(r => ({
      pagoOID: r.OID, ano: r.Ano, mes: r.Mes, fecha: r.Fecha,
      tipoPago: r.TipoPago ?? null, monto: round2(r.Monto), lineas: Number(r.Lineas) || 0,
    })));
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Diagnóstico: muestra primeras filas de cualquier tabla (solo lectura) ───
router.get('/peek/:table', auth, guard, async (req, res) => {
  const t = String(req.params.table || '').replace(/[^A-Za-z0-9_]/g, '');
  if (!t) return res.status(400).json({ message: 'tabla inválida' });
  try { res.json(await sql.query(`SELECT TOP 5 * FROM [${t}]`)); }
  catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Empleados (incluye inactivos) ───
// GENERAL marca el estatus en EmpleadoActivo / campo Activo. Devolvemos todos
// para que TSS y otros listados muestren también el personal inactivo.
router.get('/employees', auth, guard, async (req, res) => {
  const incluirInactivos = String(req.query.inactivos || 'true').toLowerCase() !== 'false';
  try {
    const rows = await sql.query(
      `SELECT e.OID, e.Codigo, e.Nombre1, e.Apellido1, e.Cedula, e.Salario,
              e.Tarifa, e.FechaIngreso, e.Puesto AS PuestoOID, e.Departamento AS DeptOID,
              CASE WHEN ea.Empleado IS NOT NULL THEN 1 ELSE 0 END AS Activo
       FROM Empleado e
       LEFT JOIN EmpleadoActivo ea ON ea.Empleado = e.OID AND ea.GCRecord IS NULL
       WHERE e.GCRecord IS NULL
       ORDER BY e.Apellido1, e.Nombre1`
    );
    const mapped = rows.map(r => ({
      oid: r.OID, codigo: r.Codigo, nombre: fullName(r), cedula: r.Cedula,
      salario: Number(r.Salario) || 0, tarifa: Number(r.Tarifa) || 0,
      fechaIngreso: r.FechaIngreso, puestoOID: r.PuestoOID, deptOID: r.DeptOID,
      activo: !!r.Activo,
    }));
    res.json(incluirInactivos ? mapped : mapped.filter(m => m.activo));
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Empleados ACTIVOS en GENERAL (Empleado.Estatus = 0, no eliminados) ───
// Fuente viva para la pantalla "Empleados activos" del directorio de RRHH.
router.get('/employees-active', auth, guard, async (req, res) => {
  try {
    const rows = await sql.query(
      `SELECT * FROM Empleado WHERE Estatus = 0 AND GCRecord IS NULL`
    );
    const puestos = await catalogMap(['Puesto', 'Cargo', 'Posicion']);
    const depts = await catalogMap(['Departamento', 'Depto']);
    const nacionalidades = await catalogMap(['Nacionalidad', 'Pais']);
    const niveles = await catalogMap(['NivelEducativo', 'NivelAcademico']);

    const mapped = rows.map((r) => {
      const nombre = cleanStr(r.NombreCompleto) ||
        [r.Nombre1, r.Nombre2, r.Apellido1, r.Apellido2].map(cleanStr).filter(Boolean).join(' ');
      const puestoRaw = r.Puesto;
      const deptRaw = r.Departamento;
      const numOr = (v) => (v == null || v === '' ? null : Number(v));
      return {
        oid: r.OID,
        codigo: cleanStr(r.Codigo),
        nombre1: cleanStr(r.Nombre1),
        nombre2: cleanStr(r.Nombre2),
        apellido1: cleanStr(r.Apellido1),
        apellido2: cleanStr(r.Apellido2),
        nombreCompleto: nombre,
        cedula: cleanStr(r.Cedula),
        fechaNacimiento: r.FechaNacimiento || null,
        edad: computeAge(r.FechaNacimiento),
        sexo: r.Sexo === 1 || r.Sexo === '1' ? 'Masculino' : (r.Sexo === 0 || r.Sexo === '0' ? 'Femenino' : null),
        nacionalidad: typeof r.Nacionalidad === 'number'
          ? (nacionalidades.get(Number(r.Nacionalidad)) || null)
          : cleanStr(r.Nacionalidad),
        nivelEducativo: niveles.get(numOr(r.NivelEducativo)) || null,
        puesto: typeof puestoRaw === 'number' ? (puestos.get(Number(puestoRaw)) || null) : cleanStr(puestoRaw),
        departamento: typeof deptRaw === 'number' ? (depts.get(Number(deptRaw)) || null) : cleanStr(deptRaw),
        fechaIngreso: r.FechaIngreso || null,
        salario: Number(r.Salario) || 0,
        estatus: 'Activo',
      };
    }).sort((a, b) => String(a.nombreCompleto).localeCompare(String(b.nombreCompleto), 'es'));

    res.json({ count: mapped.length, items: mapped });
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Comprobantes de pago: último pago por empleado activo (PIVOT) ───
const PAYSLIP_INCOME = [
  'Salario', 'Horas Normales', 'Horas Extras', 'Horas Nocturnas', 'Horas Disponibles',
  'Horas Vacaciones', 'Horas por Novedad', 'Novedades Digitadas', 'Horas Extras Digitado',
  'Horas Nocturnas Digitada', 'Incentivo', 'Almuerzo Digitado', 'Dias Feriados Digitado',
];
const PAYSLIP_DEDUCTIONS = ['AFP', 'SFS', 'ISR', 'Comida', 'Prestamo', 'Avance Efectivo', 'Percapita', 'Uniforme'];

router.get('/payslips', auth, guard, async (req, res) => {
  const brackets = (arr) => arr.map((c) => `[${c}]`).join(', ');
  const sumOf = (arr) => arr.map((c) => `ISNULL([${c}], 0)`).join(' + ');
  const int = (v) => (v == null || v === '' ? null : Number.parseInt(String(v), 10));
  const ano = int(req.query.ano), mes = int(req.query.mes), periodo = int(req.query.periodo);
  const usarPeriodo = Number.isFinite(ano) && Number.isFinite(mes) && Number.isFinite(periodo);

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
)`;

  const text = `
WITH ${fuente}
SELECT Empleado, Codigo, Cedula, Puesto, FechaPago, Periodo, Mes, Ano, Nomina,
  ${PAYSLIP_INCOME.map((c) => `ISNULL([${c}], 0) AS [${c}]`).join(',\n  ')},
  ${PAYSLIP_DEDUCTIONS.map((c) => `ISNULL([${c}], 0) AS [${c}]`).join(',\n  ')},
  ${sumOf(PAYSLIP_INCOME)} AS TotalDevengado,
  ${sumOf(PAYSLIP_DEDUCTIONS)} AS TotalDeducciones,
  (${sumOf(PAYSLIP_INCOME)}) - (${sumOf(PAYSLIP_DEDUCTIONS)}) AS NetoARecibir
FROM DatosPago
PIVOT (SUM(Monto) FOR Concepto IN (${brackets([...PAYSLIP_INCOME, ...PAYSLIP_DEDUCTIONS])})) AS PivotTable
ORDER BY Empleado`;


  try {
    const rows = await sql.query(text);
    const puestos = await catalogMap(['Puesto', 'Cargo', 'Posicion']);
    const num = (v) => Math.round((Number(v) || 0) * 100) / 100;
    const items = rows.map((r) => {
      const ingresos = {}; const deducciones = {};
      PAYSLIP_INCOME.forEach((c) => { ingresos[c] = num(r[c]); });
      // Las deducciones vienen negativas (IIF Tipo=0 → -Calculado): mostrar en positivo.
      PAYSLIP_DEDUCTIONS.forEach((c) => { deducciones[c] = Math.abs(num(r[c])); });
      const totalDeducciones = Math.abs(num(r.TotalDeducciones));
      const totalDevengado = num(r.TotalDevengado);
      return {
        empleado: cleanStr(r.Empleado),
        codigo: cleanStr(r.Codigo),
        cedula: cleanStr(r.Cedula),
        puesto: typeof r.Puesto === 'number' ? (puestos.get(Number(r.Puesto)) || null) : cleanStr(r.Puesto),
        fechaPago: r.FechaPago || null,
        periodo: r.Periodo ?? null,
        mes: r.Mes ?? null,
        ano: r.Ano ?? null,
        nomina: r.Nomina ?? null,
        ingresos, deducciones,
        totalDevengado,
        totalDeducciones,
        neto: Math.round((totalDevengado - totalDeducciones) * 100) / 100,
      };
    });
    const totals = items.reduce((a, i) => ({
      devengado: a.devengado + i.totalDevengado,
      deducciones: a.deducciones + i.totalDeducciones,
      neto: a.neto + i.neto,
    }), { devengado: 0, deducciones: 0, neto: 0 });
    res.json({
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

// ─── Historial de nómina: períodos disponibles (Query 5) ───
router.get('/payroll-periods', auth, guard, async (req, res) => {
  try {
    const rows = await sql.query(`
SELECT DISTINCT p.Ano, p.Mes, p.Periodo, MAX(p.Fecha) AS Fecha, MIN(p.OID) AS PagoOID
FROM Pago p
INNER JOIN PagoConcepto pc ON pc.Pago = p.OID
INNER JOIN PagoD pd ON pd.PagoConcepto = pc.OID
INNER JOIN Empleado e ON pd.Empleado = e.OID
WHERE e.Estatus = 0 AND e.GCRecord IS NULL AND p.GCRecord IS NULL AND pd.Calculado > 0
GROUP BY p.Ano, p.Mes, p.Periodo
ORDER BY p.Ano DESC, p.Mes DESC, p.Periodo DESC`);
    res.json(rows.map((r) => ({
      ano: Number(r.Ano), mes: Number(r.Mes), periodo: Number(r.Periodo),
      fecha: r.Fecha || null, pagoOid: Number(r.PagoOID),
      descripcion: `Q${r.Periodo} ${String(r.Mes).padStart(2, '0')}/${r.Ano}`,
    })));
  } catch (e) { res.status(502).json({ message: e.message }); }
});

const safeCode = (v) => String(v || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 20);

// ─── Historial de pagos de un empleado (Query 1) ───
router.get('/employee-payments', auth, guard, async (req, res) => {
  const codigo = safeCode(req.query.codigo);
  if (!codigo) return res.status(400).json({ message: 'codigo requerido' });
  try {
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
WHERE e.Codigo = '${codigo}' AND p.GCRecord IS NULL AND pd.Calculado > 0
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

// ─── Desglose de un pago específico (Query 2) ───
router.get('/payment-detail', auth, guard, async (req, res) => {
  const codigo = safeCode(req.query.codigo);
  const pagoOid = Number.parseInt(String(req.query.pagoOid), 10);
  if (!codigo || !Number.isFinite(pagoOid)) return res.status(400).json({ message: 'codigo y pagoOid requeridos' });
  try {
    const rows = await sql.query(`
SELECT e.NombreCompleto AS Empleado, e.Codigo, e.Cedula, e.Puesto,
  c.Descripcion AS Concepto, c.Tipo, pd.Valor, pd.Calculado, pd.Comentario,
  p.Fecha, p.Periodo, p.Mes, p.Ano, p.Nomina
FROM PagoD pd
INNER JOIN PagoConcepto pc ON pd.PagoConcepto = pc.OID
INNER JOIN Pago p ON pc.Pago = p.OID
INNER JOIN Concepto c ON pc.Concepto = c.OID
INNER JOIN Empleado e ON pd.Empleado = e.OID
WHERE e.Codigo = '${codigo}' AND p.OID = ${pagoOid} AND p.GCRecord IS NULL AND pd.Calculado > 0
ORDER BY c.Tipo DESC, c.Descripcion`);
    const puestos = await catalogMap(['Puesto', 'Cargo', 'Posicion']);
    const first = rows[0] || {};
    const lineas = rows.map((r) => ({
      concepto: cleanStr(r.Concepto),
      tipo: Number(r.Tipo),
      valor: Number(r.Valor) || 0,
      calculado: round2(Number(r.Calculado) || 0),
      monto: round2(Number(r.Tipo) === 1 ? Number(r.Calculado) || 0 : -(Number(r.Calculado) || 0)),
      comentario: cleanStr(r.Comentario),
    }));
    const devengado = round2(lineas.filter(l => l.tipo === 1).reduce((a, l) => a + l.calculado, 0));
    const deducciones = round2(lineas.filter(l => l.tipo !== 1).reduce((a, l) => a + l.calculado, 0));
    res.json({
      empleado: cleanStr(first.Empleado), codigo: cleanStr(first.Codigo), cedula: cleanStr(first.Cedula),
      puesto: typeof first.Puesto === 'number' ? (puestos.get(Number(first.Puesto)) || null) : cleanStr(first.Puesto),
      fecha: first.Fecha || null, periodo: first.Periodo ?? null, mes: first.Mes ?? null,
      ano: first.Ano ?? null, nomina: first.Nomina ?? null,
      lineas, totalDevengado: devengado, totalDeducciones: deducciones,
      neto: round2(devengado - deducciones),
    });
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Comparación entre dos pagos + anomalías (Query 3 y 4) ───
router.get('/payment-compare', auth, guard, async (req, res) => {
  const codigo = safeCode(req.query.codigo);
  const a = Number.parseInt(String(req.query.pago1), 10);
  const b = Number.parseInt(String(req.query.pago2), 10);
  if (!codigo || !Number.isFinite(a) || !Number.isFinite(b)) {
    return res.status(400).json({ message: 'codigo, pago1 y pago2 requeridos' });
  }
  const q = (oid) => `
SELECT c.Descripcion AS Concepto, c.Tipo, pd.Calculado
FROM PagoD pd
INNER JOIN PagoConcepto pc ON pd.PagoConcepto = pc.OID
INNER JOIN Pago p ON pc.Pago = p.OID
INNER JOIN Concepto c ON pc.Concepto = c.OID
INNER JOIN Empleado e ON pd.Empleado = e.OID
WHERE e.Codigo = '${codigo}' AND p.OID = ${oid} AND p.GCRecord IS NULL AND pd.Calculado > 0`;
  try {
    const [rowsA, rowsB] = await Promise.all([sql.query(q(a)), sql.query(q(b))]);
    const toMap = (rows) => {
      const m = new Map();
      rows.forEach((r) => {
        const key = `${cleanStr(r.Concepto)}|${Number(r.Tipo)}`;
        const monto = Number(r.Tipo) === 1 ? Number(r.Calculado) || 0 : -(Number(r.Calculado) || 0);
        m.set(key, (m.get(key) || 0) + monto);
      });
      return m;
    };
    const ma = toMap(rowsA), mb = toMap(rowsB);
    const keys = [...new Set([...ma.keys(), ...mb.keys()])];
    const items = keys.map((k) => {
      const [concepto, tipoStr] = k.split('|');
      const actual = round2(ma.get(k) || 0);
      const anterior = round2(mb.get(k) || 0);
      const diferencia = round2(actual - anterior);
      const variacion = anterior === 0 ? null : round2((diferencia / Math.abs(anterior)) * 100);
      const anomalia = Math.abs(diferencia) > 1000 || (variacion !== null && Math.abs(variacion) > 10);
      return { concepto, tipo: Number(tipoStr), actual, anterior, diferencia, variacion, anomalia };
    }).sort((x, y) => Math.abs(y.diferencia) - Math.abs(x.diferencia));
    res.json({
      items,
      totales: {
        actual: round2(items.reduce((s, i) => s + i.actual, 0)),
        anterior: round2(items.reduce((s, i) => s + i.anterior, 0)),
      },
      anomalias: items.filter(i => i.anomalia).length,
    });
  } catch (e) { res.status(502).json({ message: e.message }); }
});




// ─── Clientes (tabla Cliente + último servicio en ClienteServicio) ───
// Alimenta el selector de "Cliente CxC" en Seguimiento Clientes Monitoreo para
// no tener que reingresar los datos a mano. La descripción del servicio activo
// más reciente (ClienteServicio.Descripcion) se usa para sugerir el "Tipo de
// servicio" de la LX.
router.get('/clients', auth, guard, async (req, res) => {
  try {
    const codigoExpr = await optionalColumnExpr('Cliente', 'c', 'Codigo', 'Codigo');
    const inactivoExpr = await optionalColumnExpr('Cliente', 'c', 'Inactivo', 'Inactivo', '0');
    const rncExpr = await optionalColumnExpr('Cliente', 'c', 'RNC', 'RNC');
    const cedExpr = await optionalColumnExpr('Cliente', 'c', 'Cedula', 'Cedula');
    const contExpr = await optionalColumnExpr('Cliente', 'c', 'Contacto', 'Contacto');
    const dirExpr = await optionalColumnExpr('Cliente', 'c', 'Direccion', 'Direccion');
    const telExpr = await optionalColumnExpr('Cliente', 'c', 'Telefono', 'Telefono');
    const emailExpr = await optionalColumnExpr('Cliente', 'c', 'Email', 'Email');

    // ¿Existe la tabla ClienteServicio? Si no, omitimos el OUTER APPLY.
    let servicioExpr = 'NULL AS [Servicio]';
    let outerApply = '';
    try {
      const csCols = await tableColumnsMap('ClienteServicio');
      if (csCols && csCols.size > 0) {
        servicioExpr = 'cs.[Descripcion] AS [Servicio]';
        outerApply =
          ` OUTER APPLY (
              SELECT TOP 1 s.[Descripcion]
              FROM [ClienteServicio] s
              WHERE s.[Cliente] = c.[OID] AND s.[GCRecord] IS NULL
                AND (s.[FechaFin] IS NULL OR s.[FechaFin] >= GETDATE())
              ORDER BY s.[FechaInicio] DESC
            ) cs`;
      }
    } catch (_) { /* sin tabla de servicios: se deja NULL */ }

    const rows = await sql.query(
      `SELECT c.[OID], ${codigoExpr}, c.[Nombre], ${dirExpr}, ${telExpr},
              ${emailExpr}, ${rncExpr}, ${cedExpr}, ${contExpr}, ${inactivoExpr},
              ${servicioExpr}
       FROM [Cliente] c${outerApply}
       WHERE c.[GCRecord] IS NULL
       ORDER BY c.[Nombre]`
    );

    const mapped = rows.map(r => ({
      oid: r.OID,
      codigo: r.Codigo ?? null,
      nombre: (r.Nombre || '').trim(),
      direccion: r.Direccion ?? null,
      telefono: r.Telefono ?? null,
      email: r.Email ?? null,
      rnc: r.RNC ?? null,
      cedula: r.Cedula ?? null,
      contacto: r.Contacto ?? null,
      inactivo: !!r.Inactivo,
      servicio: r.Servicio ?? null,
    }));
    res.json(mapped);
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Servicios contratados de un cliente (ClienteServicio) ───
router.get('/clients/:oid/servicios', auth, guard, async (req, res) => {
  try {
    const oid = Number(req.params.oid);
    if (!Number.isFinite(oid)) return res.status(400).json({ message: 'OID inválido' });
    const rows = await sql.query(
      `SELECT cs.[OID], cs.[Articulo], cs.[Descripcion], cs.[Cantidad], cs.[Precio],
              cs.[FechaInicio], cs.[FechaFin]
       FROM [ClienteServicio] cs
       WHERE cs.[Cliente] = @oid AND cs.[GCRecord] IS NULL
       ORDER BY cs.[FechaInicio] DESC`,
      { oid }
    );
    res.json(rows.map(r => ({
      oid: r.OID,
      articulo: r.Articulo ?? null,
      descripcion: (r.Descripcion || '').trim() || null,
      cantidad: r.Cantidad ?? null,
      precio: r.Precio != null ? Number(r.Precio) : null,
      fechaInicio: r.FechaInicio || null,
      fechaFin: r.FechaFin || null,
    })));
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Contactos adicionales de un cliente (ClienteContacto) ───
router.get('/clients/:oid/contactos', auth, guard, async (req, res) => {
  try {
    const oid = Number(req.params.oid);
    if (!Number.isFinite(oid)) return res.status(400).json({ message: 'OID inválido' });
    const rows = await sql.query(
      `SELECT cc.[OID], cc.[Tipo], cc.[Valor]
       FROM [ClienteContacto] cc
       WHERE cc.[Cliente] = @oid AND cc.[GCRecord] IS NULL
       ORDER BY CASE
         WHEN cc.[Tipo] = 'Principal' THEN 1
         WHEN cc.[Tipo] = 'Email' THEN 2
         WHEN cc.[Tipo] = 'Telefono' THEN 3
         WHEN cc.[Tipo] = 'Celular' THEN 4
         WHEN cc.[Tipo] = 'WhatsApp' THEN 5
         ELSE 6 END`,
      { oid }
    );
    res.json(rows.map(r => ({ oid: r.OID, tipo: (r.Tipo || '').trim(), valor: (r.Valor || '').trim() })));
  } catch (e) { res.status(502).json({ message: e.message }); }
});


// ─── Préstamos (tabla Prestamo) ───
router.get('/loans', auth, guard, async (req, res) => {
  try {
    const rows = await sql.query(
      `SELECT pr.OID, pr.Fecha, pr.Monto, pr.Cuota, pr.Pagado, pr.Interes,
              pr.Meses, pr.TasaInteres, e.Codigo, e.Nombre1, e.Apellido1
       FROM Prestamo pr
       LEFT JOIN Empleado e ON e.OID = pr.Empleado
       WHERE pr.GCRecord IS NULL
       ORDER BY pr.Fecha DESC`
    );
    const items = rows.map(r => {
      const monto = Number(r.Monto) || 0;
      const pagado = Number(r.Pagado) || 0;
      return {
        oid: r.OID, codigo: r.Codigo, empleado: fullName(r),
        fecha: r.Fecha, monto, cuota: Number(r.Cuota) || 0, pagado,
        saldo: round2(monto - pagado), meses: Number(r.Meses) || 0,
        interes: Number(r.Interes) || 0, tasaInteres: Number(r.TasaInteres) || 0,
      };
    });
    const totals = items.reduce((a, i) => ({
      prestado: a.prestado + i.monto, cobrado: a.cobrado + i.pagado, saldo: a.saldo + i.saldo,
    }), { prestado: 0, cobrado: 0, saldo: 0 });
    res.json({
      count: items.length,
      totals: { prestado: round2(totals.prestado), cobrado: round2(totals.cobrado), saldo: round2(totals.saldo) },
      items,
    });
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Catálogos (Marca / Tipo / Calibre / Categoria) ───
// En Armamento estos campos son códigos numéricos (FK). Resolvemos el texto
// contra la tabla de catálogo correspondiente, con descubrimiento dinámico del
// nombre de tabla y de la columna descriptiva, cacheado por proceso.
const _catalogCache = new Map(); // candidateKey → Map(oid→texto)

async function tableExists(name) {
  try {
    const rows = await sql.query(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @t`,
      { t: name }
    );
    return rows.length > 0;
  } catch (_) { return false; }
}

async function catalogMap(candidates) {
  const key = candidates.join('|');
  if (_catalogCache.has(key)) return _catalogCache.get(key);
  const map = new Map();
  for (const tbl of candidates) {
    if (!(await tableExists(tbl))) continue;
    try {
      const rows = await sql.query(`SELECT * FROM [${tbl}]`);
      if (!rows.length) { continue; }
      const sample = rows[0];
      const skip = /optimisticlock|gcrecord|objecttype|^oid$|^codigo$|^id$/i;
      const descCol =
        Object.keys(sample).find((k) => /descrip|nombre|name/i.test(k)) ||
        Object.keys(sample).find((k) => !skip.test(k) && typeof sample[k] === 'string');
      for (const r of rows) {
        const oid = r.OID ?? r.Oid ?? r.oid;
        if (oid == null) continue;
        const txt = descCol ? r[descCol] : null;
        if (txt != null && txt !== '' && txt !== 'NULL') map.set(Number(oid), String(txt).trim());
      }
      break;
    } catch (_) { /* probar siguiente candidato */ }
  }
  _catalogCache.set(key, map);
  return map;
}

const cleanStr = (v) => (v == null || v === 'NULL' || v === '' ? null : v);

// Calcula la edad en años a partir de una fecha de nacimiento (Date/ISO).
function computeAge(v) {
  if (v == null || v === 'NULL' || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

// Columnas binarias de Armamento (fotos). NUNCA se leen en el listado: traer
// varbinary(max) por cada arma inflaba la respuesta y hacía fallar/expirar la
// carga del expediente en clientes con muchas armas (pantalla en blanco).
const WEAPON_BLOB_COLS = {
  licenciaFrente: 'FotoLicenciaFrente',
  licenciaDorso: 'FotoLicenciaDorso',
  arma1: 'FotoArma1',
  arma2: 'FotoArma2',
  arma3: 'FotoArma3',
  arma4: 'FotoArma4',
};

// Lee todas las armas de Armamento con sus catálogos resueltos.
async function readWeapons() {
  // Solo columnas escalares + banderas de existencia de cada foto.
  const colsMap = await tableColumnsMap('Armamento');
  const blobNames = new Set(Object.values(WEAPON_BLOB_COLS).map((c) => c.toLowerCase()));
  const scalarCols = [...colsMap.values()].filter((c) => !blobNames.has(String(c).toLowerCase()));
  const selectList = scalarCols.length ? scalarCols.map((c) => `[${c}]`).join(', ') : '*';
  const flagList = Object.entries(WEAPON_BLOB_COLS)
    .filter(([, col]) => colsMap.has(col.toLowerCase()))
    .map(([key, col]) => `CASE WHEN DATALENGTH([${col}]) > 0 THEN 1 ELSE 0 END AS [has_${key}]`);
  const rows = await sql.query(
    `SELECT ${selectList}${flagList.length ? ', ' + flagList.join(', ') : ''} FROM Armamento WHERE GCRecord IS NULL`
  );
  const [marcaCat, tipoCat, calCat, catCat, catalogEstatus] = await Promise.all([
    catalogMap(['MarcaArma', 'Marca', 'Marcas']),
    catalogMap(['TipoArma', 'TipoArmamento', 'Tipo']),
    catalogMap(['Calibre', 'CalibreArma', 'Calibres']),
    catalogMap(['CategoriaArma', 'Categoria', 'Categorias']),
    catalogMap(['EstatusArma', 'EstatusArmamento', 'Estatus']),
  ]);
  const pick = (r, ...names) => {
    for (const n of names) {
      const key = Object.keys(r).find((k) => k.toLowerCase() === n.toLowerCase());
      if (key && r[key] != null && r[key] !== '' && r[key] !== 'NULL') return r[key];
    }
    return null;
  };
  const resolve = (cat, code) => {
    if (code == null) return null;
    return cat.get(Number(code)) || String(code);
  };
  // Todo campo de texto se normaliza a string: si llega un número o una fecha
  // desde SQL, el front lo renderiza directo y rompía la vista (pantalla en blanco).
  const txt = (v) => {
    const c = cleanStr(v);
    if (c == null) return null;
    if (c instanceof Date) return c.toISOString();
    const s = String(c).trim();
    return s === '' || s.toUpperCase() === 'NULL' ? null : s;
  };
  return rows.map((r) => {
    const marcaCode = pick(r, 'Marca');
    const tipoCode = pick(r, 'Tipo');
    const calCode = pick(r, 'Calibre');
    const catCode = pick(r, 'Categoria');
    const flag = (k) => Number(r[`has_${k}`]) === 1;
    return {
      oid: pick(r, 'OID'),
      codigo: pick(r, 'Codigo'),
      serie: txt(pick(r, 'Serie', 'NumeroSerie', 'NoSerie', 'Serial')),
      marca: txt(resolve(marcaCat, marcaCode)),
      tipo: txt(resolve(tipoCat, tipoCode)),
      calibre: txt(resolve(calCat, calCode)),
      categoria: txt(resolve(catCat, catCode)),
      noLicencia: txt(pick(r, 'NoLicencia', 'Licencia', 'NoRegistro', 'Registro')),
      estatus: txt(resolve(catalogEstatus, pick(r, 'Estatus'))),
      permanente: pick(r, 'Permanente') === 1 || pick(r, 'Permanente') === true,
      vence: txt(pick(r, 'Vence')),
      nota: txt(pick(r, 'Nota')),
      propietario: txt(pick(r, 'Propietario')),
      // Fotos de licencia y del arma guardadas en gSafeOne (varbinary). Se
      // exponen como banderas; el binario se sirve bajo demanda por endpoint.
      fotoLicenciaFrenteDb: flag('licenciaFrente'),
      fotoLicenciaDorsoDb: flag('licenciaDorso'),
      fotosArmaDb: ['arma1', 'arma2', 'arma3', 'arma4'].filter((k) => flag(k)),
      // Cantidad de cápsulas / munición asignada al arma (columna de Armamento
      // en gSafeOne). Se prueban varios nombres posibles de columna.
      capsulas: (() => {
        const v = pick(
          r,
          'Capsulas', 'Capsula', 'Municiones', 'Municion', 'Balas',
          'Cantidad', 'CantidadMuniciones', 'CantidadCapsulas',
          'CantMuniciones', 'CantMunicion', 'NoCapsulas', 'NoMuniciones',
          'Existencia', 'Cartuchos'
        );
        if (v == null || v === '' || v === 'NULL') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      })(),
    };
  });
}

// ─── Armamento (números de serie de armas, catálogos resueltos) ───
router.get('/weapons', auth, guard, async (req, res) => {
  try {
    res.json(await readWeapons());
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Imagen (licencia / arma) almacenada en gSafeOne ───
// Las fotos viven como varbinary en Armamento; se sirven bajo demanda para no
// cargar binarios en el listado. Acepta el token por query (?token=) porque un
// <img> no puede enviar el header Authorization.
const jwtLib = require('jsonwebtoken');
function authImage(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ')
    ? header.split(' ')[1]
    : (req.query.token || null);
  if (!token) return res.status(401).json({ message: 'Token requerido' });
  try {
    req.user = jwtLib.verify(String(token), process.env.JWT_SECRET);
    next();
  } catch (_) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

function sniffImageType(buf) {
  if (!buf || buf.length < 4) return 'application/octet-stream';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49) return 'image/gif';
  if (buf[0] === 0x42 && buf[1] === 0x4d) return 'image/bmp';
  return 'image/jpeg';
}

router.get('/weapons/:oid/image/:kind', authImage, guard, async (req, res) => {
  try {
    const col = WEAPON_BLOB_COLS[req.params.kind];
    if (!col) return res.status(400).json({ message: 'Tipo de imagen inválido' });
    const oid = Number(req.params.oid);
    if (!Number.isFinite(oid)) return res.status(400).json({ message: 'OID inválido' });
    const cols = await tableColumnsMap('Armamento');
    if (!cols.has(col.toLowerCase())) return res.status(404).json({ message: 'Columna no disponible' });
    const rows = await sql.query(
      `SELECT [${col}] AS Img FROM Armamento WHERE OID = @oid`, { oid }
    );
    let img = rows[0]?.Img;
    if (!img) return res.status(404).json({ message: 'Sin imagen' });
    if (!Buffer.isBuffer(img)) img = Buffer.from(img);
    // XAF a veces guarda las imágenes con encabezado de serialización .NET;
    // recortamos hasta la firma real del archivo si aparece más adelante.
    const jpg = img.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
    const png = img.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const start = [jpg, png].filter((i) => i > 0).sort((a, b) => a - b)[0];
    if (start && start < 512) img = img.subarray(start);
    res.set('Content-Type', sniffImageType(img));
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(img);
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Expediente de Clientes (vivo desde GENERAL) ───
// Arma el 360° por cliente a partir del Reporte Diario, replicando la
// estructura oficial del query de Operaciones:
//   ReportePuesto → ReporteDiarioD → ReporteDiario (Zona/Tanda/Fecha)
//   ReportePuesto → HoraContratada (Puesto) → Cliente
//   ReportePuesto → Empleado (Vigilante) · Armamento (Arma)
// Jerarquía resultante:  Cliente → Zona(Localidad) → Puesto → Tanda(Turno).
//
// Por defecto muestra el ÚLTIMO reporte digitado (típicamente el de ayer);
// admite ?fecha=YYYY-MM-DD para navegar hacia atrás hasta el día de hoy.

function normalizeDateParam(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

async function latestReportDate() {
  const rows = await sql.query(
    `SELECT TOP 1 Fecha FROM ReporteDiario WHERE GCRecord IS NULL ORDER BY Fecha DESC`
  );
  return rows[0]?.Fecha || null;
}

// Mapa OID→arma enriquecida (serie, marca, tipo, calibre, licencia, estatus…).
async function weaponsMap() {
  const map = new Map();
  try {
    const weapons = await readWeapons();
    for (const w of weapons) {
      if (w.oid == null) continue;
      map.set(Number(w.oid), {
        serie: w.serie,
        modelo: w.marca || w.tipo,
        marca: w.marca,
        tipo: w.tipo,
        calibre: w.calibre,
        categoria: w.categoria,
        noLicencia: w.noLicencia,
        estatus: w.estatus,
        propietario: w.propietario,
        capsulas: w.capsulas,
        vence: w.vence,
        permanente: w.permanente,
        fotoLicenciaFrenteDb: w.fotoLicenciaFrenteDb,
        fotoLicenciaDorsoDb: w.fotoLicenciaDorsoDb,
        fotosArmaDb: w.fotosArmaDb,
      });
    }
  } catch (_) { /* Armamento puede no existir; se ignora */ }
  return map;
}

router.get('/expediente/status', auth, guard, async (req, res) => {
  try {
    const fecha = await latestReportDate();
    res.json({ fecha });
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// Fechas disponibles para el selector (últimos reportes hasta hoy, desc).
router.get('/expediente/dates', auth, guard, async (req, res) => {
  try {
    const rows = await sql.query(
      `SELECT DISTINCT TOP 60 CAST(Fecha AS DATE) AS Fecha
       FROM ReporteDiario
       WHERE GCRecord IS NULL AND CAST(Fecha AS DATE) <= CAST(GETDATE() AS DATE)
       ORDER BY CAST(Fecha AS DATE) DESC`
    );
    res.json(rows.map((r) => r.Fecha));
  } catch (e) { res.status(502).json({ message: e.message }); }
});

router.get('/expediente', auth, guard, async (req, res) => {
  try {
    // Fecha solicitada (YYYY-MM-DD / YYYYMMDD) o, por defecto, el último reporte.
    const pedida = normalizeDateParam(req.query.fecha);
    const fecha = pedida || (await latestReportDate());
    if (!fecha) return res.json({ fecha: null, clientes: [], totals: {} });

    const [clienteCodigoExpr, puestoCodigoExpr, vigilanteCodigoExpr] = await Promise.all([
      optionalColumnExpr('Cliente', 'c', 'Codigo', 'ClienteCodigo'),
      optionalColumnExpr('HoraContratada', 'h', 'Codigo', 'PuestoCodigo'),
      optionalColumnExpr('Empleado', 'e', 'Codigo', 'VigilanteCodigo'),
    ]);

    // Estructura oficial: ReportePuesto → HoraContratada (Puesto) → Cliente,
    // con Zona (localidad) y Tanda (turno) del ReporteDiario.
    const rows = await sql.query(
      `SELECT rp.OID AS LineaOID, rp.Horas, rp.Incentivo, rp.Arma AS ArmaOID,
              rp.Novedad AS NovedadOID, rp.Comentario,
              c.OID AS ClienteOID, ${clienteCodigoExpr}, c.Nombre AS ClienteNombre,
              c.Direccion, c.Telefono, c.Email, c.RNC, c.Cedula, c.Contacto, c.Inactivo,
              h.OID AS PuestoOID, ${puestoCodigoExpr}, h.Descripcion AS PuestoDesc,
              z.Descripcion AS Zona, t.Descripcion AS Tanda,
              e.OID AS VigilanteOID, ${vigilanteCodigoExpr},
              e.Nombre1, e.Apellido1, e.Cedula AS VigilanteCedula,
              e.FechaNacimiento AS VigilanteNacimiento
       FROM ReportePuesto rp
       JOIN ReporteDiarioD rd ON rp.ReporteDiarioD = rd.OID
       JOIN ReporteDiario r ON rd.ReporteDiario = r.OID
       JOIN HoraContratada h ON rp.Puesto = h.OID
       JOIN Cliente c ON h.Cliente = c.OID
       LEFT JOIN Empleado e ON rp.Vigilante = e.OID
       LEFT JOIN Zona z ON rd.Zona = z.OID
       LEFT JOIN Tanda t ON rd.Tanda = t.OID
       WHERE rp.GCRecord IS NULL AND r.GCRecord IS NULL
         AND CAST(r.Fecha AS DATE) = CAST(@fecha AS DATE)`,
      { fecha }
    );

    const weapons = await weaponsMap();
    const byClient = new Map();

    for (const r of rows) {
      const cid = r.ClienteOID;
      if (cid == null) continue;
      if (!byClient.has(cid)) {
        byClient.set(cid, {
          oid: cid,
          codigo: r.ClienteCodigo,
          nombre: r.ClienteNombre || `Cliente ${r.ClienteCodigo ?? cid}`,
          direccion: r.Direccion || '',
          telefono: r.Telefono || '',
          email: r.Email || '',
          rnc: r.RNC && r.RNC !== 'NULL' ? r.RNC : '',
          cedula: r.Cedula && r.Cedula !== 'NULL' ? r.Cedula : '',
          contacto: r.Contacto || '',
          inactivo: !!r.Inactivo,
          puestos: [],
        });
      }
      const arma = r.ArmaOID != null ? weapons.get(Number(r.ArmaOID)) : null;
      const vigilante = [r.Nombre1, r.Apellido1].filter(Boolean).join(' ').trim();
      const tanda = r.Tanda && r.Tanda !== 'NULL' ? String(r.Tanda).trim() : '';
      byClient.get(cid).puestos.push({
        lineaOID: r.LineaOID,
        puesto: r.PuestoDesc || `Puesto ${r.PuestoCodigo ?? ''}`.trim(),
        puestoCodigo: r.PuestoCodigo,
        localidad: r.Zona && r.Zona !== 'NULL' ? String(r.Zona).trim() : 'Sede Principal',
        tanda,
        vigilante: vigilante || '—',
        vigilanteOID: r.VigilanteOID ?? null,
        vigilanteCodigo: r.VigilanteCodigo ?? null,
        vigilanteCedula: r.VigilanteCedula && r.VigilanteCedula !== 'NULL' ? r.VigilanteCedula : null,
        vigilanteFechaNacimiento: cleanStr(r.VigilanteNacimiento),
        vigilanteEdad: computeAge(r.VigilanteNacimiento),
        horas: Number(r.Horas) || 0,
        incentivo: Number(r.Incentivo) || 0,
        requiereArma: r.ArmaOID != null,
        armaOID: r.ArmaOID != null ? Number(r.ArmaOID) : null,
        armaSerial: arma?.serie || null,
        armaModelo: arma?.modelo || arma?.marca || null,
        arma: arma
          ? {
              oid: r.ArmaOID != null ? Number(r.ArmaOID) : null,
              serie: arma.serie,
              marca: arma.marca,
              tipo: arma.tipo,
              calibre: arma.calibre,
              categoria: arma.categoria,
              noLicencia: arma.noLicencia,
              estatus: arma.estatus,
              propietario: arma.propietario,
              capsulas: arma.capsulas ?? null,
              vence: arma.vence ?? null,
              permanente: !!arma.permanente,
              fotoLicenciaFrenteDb: !!arma.fotoLicenciaFrenteDb,
              fotoLicenciaDorsoDb: !!arma.fotoLicenciaDorsoDb,
              fotosArmaDb: arma.fotosArmaDb || [],
            }
          : null,
        novedad: r.NovedadOID != null,
        comentario: r.Comentario && r.Comentario !== 'NULL' ? r.Comentario : '',
      });
    }

    const clientes = Array.from(byClient.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );

    let puestosCubiertos = 0, armas = 0, sinArma = 0, conNovedad = 0;
    const vigilantes = new Set();
    for (const c of clientes) {
      for (const p of c.puestos) {
        puestosCubiertos++;
        if (p.requiereArma) armas++; else sinArma++;
        if (p.novedad) conNovedad++;
        if (p.vigilanteCodigo != null) vigilantes.add(p.vigilanteCodigo);
      }
    }

    res.json({
      fecha,
      clientes,
      totals: {
        clientes: clientes.length,
        puestosCubiertos,
        vigilantes: vigilantes.size,
        armas,
        sinArma,
        conNovedad,
      },
    });
  } catch (e) { res.status(502).json({ message: e.message }); }
});

// ─── Expediente CONTRACTUAL de Clientes (estructura contratada, no el reporte diario) ───
//   Cliente (Nombre, RNC)
//     → ClienteLocalidad (Nombre, Zona, SubZona, GeoLocalizacion)
//       → ClientePuestoServicio (Referencia, Arma)
//         → ClientePuestoHorario (Dia, RegularHoras, Tandas)
//           → ClientePuestoHorarioD (Horas, Tanda, Vigilante, Incentivo, Precio, HoraDesde, HoraHasta)
//
// Las instalaciones de gSafeOne varían: si alguna tabla/columna no existe, se
// resuelve con descubrimiento dinámico y, en el peor caso, se deriva la
// localidad/puesto desde HoraContratada (respaldo) para no dejar la vista vacía.

// Lee una tabla completa seleccionando solo columnas escalares (sin binarios).
async function readTableScalar(table) {
  const cols = await sql.listColumns(table);
  const usable = cols
    .filter((c) => !/varbinary|image|timestamp|geography|geometry|xml/i.test(String(c.type)))
    .map((c) => c.name);
  const list = usable.length ? usable.map((c) => `[${c}]`).join(', ') : '*';
  const hasGC = cols.some((c) => String(c.name).toLowerCase() === 'gcrecord');
  return sql.query(`SELECT ${list} FROM [${table}]${hasGC ? ' WHERE GCRecord IS NULL' : ''}`);
}

// Devuelve el primer valor no vacío de una fila entre varios nombres de columna.
function pick(row, names) {
  for (const n of names) {
    for (const k of Object.keys(row)) {
      if (k.toLowerCase() === String(n).toLowerCase()) {
        const v = row[k];
        if (v != null && v !== '' && v !== 'NULL') return v;
      }
    }
  }
  return null;
}

// Resuelve un valor que puede ser texto o código (FK) contra un catálogo.
function resolveCat(value, map) {
  if (value == null || value === '' || value === 'NULL') return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value).trim())) {
    return map.get(Number(value)) || String(value);
  }
  return String(value).trim();
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
function resolveDia(value, map) {
  const txt = resolveCat(value, map);
  if (txt == null) return null;
  if (/^\d+$/.test(txt)) {
    const n = Number(txt);
    // XAF suele guardar 0-6 (Dom-Sáb) o 1-7 (Lun-Dom).
    if (n >= 0 && n <= 6) return DIAS_SEMANA[n];
    if (n === 7) return DIAS_SEMANA[0];
  }
  return txt;
}

const hhmm = (v) => {
  if (v == null || v === '' || v === 'NULL') return null;
  if (typeof v === 'string' && /^\d{1,2}:\d{2}/.test(v)) return v.slice(0, 5);
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }
  return String(v);
};

router.get('/contrato', auth, guard, async (req, res) => {
  try {
    const [hasLoc, hasPuesto, hasHorario, hasHorarioD] = await Promise.all([
      tableExists('ClienteLocalidad'),
      tableExists('ClientePuestoServicio'),
      tableExists('ClientePuestoHorario'),
      tableExists('ClientePuestoHorarioD'),
    ]);

    const [clientesRows, zonaCat, subZonaCat, tandaCat, diaCat, weapons] = await Promise.all([
      readTableScalar('Cliente'),
      catalogMap(['Zona', 'Zonas']),
      catalogMap(['SubZona', 'Subzona', 'SubZonas']),
      catalogMap(['Tanda', 'Tandas']),
      catalogMap(['Dia', 'DiaSemana', 'Dias']),
      weaponsMap(),
    ]);

    const localidades = hasLoc ? await readTableScalar('ClienteLocalidad') : [];
    const servicios = hasPuesto ? await readTableScalar('ClientePuestoServicio') : [];
    const horarios = hasHorario ? await readTableScalar('ClientePuestoHorario') : [];
    const detalles = hasHorarioD ? await readTableScalar('ClientePuestoHorarioD') : [];

    // Vigilantes (para resolver nombres en el detalle de horario).
    const empleados = new Map();
    try {
      const emps = await sql.query(
        `SELECT OID, Codigo, Nombre1, Apellido1, Cedula FROM Empleado WHERE GCRecord IS NULL`
      );
      for (const e of emps) {
        empleados.set(Number(e.OID), {
          oid: Number(e.OID), codigo: e.Codigo ?? null,
          nombre: fullName(e) || `Empleado ${e.Codigo ?? e.OID}`,
          cedula: cleanStr(e.Cedula),
        });
      }
    } catch (_) { /* opcional */ }

    // Detalles agrupados por horario.
    const detByHorario = new Map();
    for (const d of detalles) {
      const key = Number(pick(d, ['ClientePuestoHorario', 'Horario', 'Padre']) ?? NaN);
      if (Number.isNaN(key)) continue;
      const vigOID = Number(pick(d, ['Vigilante', 'Empleado']) ?? NaN);
      const vig = Number.isNaN(vigOID) ? null : empleados.get(vigOID) || null;
      const arr = detByHorario.get(key) || [];
      arr.push({
        oid: d.OID ?? null,
        horas: Number(pick(d, ['Horas'])) || 0,
        tanda: resolveCat(pick(d, ['Tanda']), tandaCat),
        vigilanteOID: Number.isNaN(vigOID) ? null : vigOID,
        vigilante: vig?.nombre || null,
        vigilanteCodigo: vig?.codigo ?? null,
        vigilanteCedula: vig?.cedula ?? null,
        incentivo: Number(pick(d, ['Incentivo'])) || 0,
        precio: Number(pick(d, ['Precio'])) || 0,
        horaDesde: hhmm(pick(d, ['HoraDesde'])),
        horaHasta: hhmm(pick(d, ['HoraHasta'])),
      });
      detByHorario.set(key, arr);
    }

    // Horarios agrupados por puesto de servicio.
    const horByServicio = new Map();
    for (const h of horarios) {
      const key = Number(pick(h, ['ClientePuestoServicio', 'PuestoServicio', 'Puesto', 'Padre']) ?? NaN);
      if (Number.isNaN(key)) continue;
      const arr = horByServicio.get(key) || [];
      arr.push({
        oid: h.OID ?? null,
        dia: resolveDia(pick(h, ['Dia', 'DiaSemana']), diaCat),
        regularHoras: Number(pick(h, ['RegularHoras', 'HorasRegulares'])) || 0,
        tandas: Number(pick(h, ['Tandas'])) || 0,
        detalles: detByHorario.get(Number(h.OID)) || [],
      });
      horByServicio.set(key, arr);
    }

    // Puestos de servicio agrupados por localidad.
    const srvByLocalidad = new Map();
    for (const s of servicios) {
      const key = Number(pick(s, ['ClienteLocalidad', 'Localidad']) ?? NaN);
      if (Number.isNaN(key)) continue;
      const armaOID = Number(pick(s, ['Arma', 'Armamento']) ?? NaN);
      const arma = Number.isNaN(armaOID) ? null : weapons.get(armaOID) || null;
      const hs = horByServicio.get(Number(s.OID)) || [];
      const arr = srvByLocalidad.get(key) || [];
      arr.push({
        oid: s.OID ?? null,
        referencia: pick(s, ['Referencia', 'Descripcion', 'Nombre']) || `Puesto ${s.OID}`,
        armaOID: Number.isNaN(armaOID) ? null : armaOID,
        requiereArma: !Number.isNaN(armaOID),
        armaSerial: arma?.serie || null,
        arma: arma
          ? {
              oid: Number.isNaN(armaOID) ? null : armaOID,
              serie: arma.serie, marca: arma.marca, tipo: arma.tipo,
              calibre: arma.calibre, categoria: arma.categoria,
              noLicencia: arma.noLicencia, estatus: arma.estatus,
              propietario: arma.propietario, capsulas: arma.capsulas ?? null,
              vence: arma.vence ?? null, permanente: !!arma.permanente,
              fotoLicenciaFrenteDb: !!arma.fotoLicenciaFrenteDb,
              fotoLicenciaDorsoDb: !!arma.fotoLicenciaDorsoDb,
              fotosArmaDb: arma.fotosArmaDb || [],
            }
          : null,
        horarios: hs,
      });
      srvByLocalidad.set(key, arr);
    }

    // Localidades agrupadas por cliente.
    const locByCliente = new Map();
    for (const l of localidades) {
      const key = Number(pick(l, ['Cliente']) ?? NaN);
      if (Number.isNaN(key)) continue;
      const arr = locByCliente.get(key) || [];
      arr.push({
        oid: l.OID ?? null,
        nombre: pick(l, ['Nombre', 'Descripcion']) || `Localidad ${l.OID}`,
        zona: resolveCat(pick(l, ['Zona']), zonaCat),
        subZona: resolveCat(pick(l, ['SubZona', 'Subzona']), subZonaCat),
        geo: pick(l, ['GeoLocalizacion', 'Geolocalizacion', 'GeoLocalizacion1', 'Coordenadas']),
        puestos: srvByLocalidad.get(Number(l.OID)) || [],
      });
      locByCliente.set(key, arr);
    }

    // Respaldo: sin tabla ClienteLocalidad, derivar localidad/puesto de HoraContratada.
    let fuente = hasLoc ? 'contrato' : 'hora-contratada';
    if (!hasLoc) {
      try {
        const hc = await sql.query(
          `SELECT h.OID, h.Cliente, h.Descripcion FROM HoraContratada h WHERE h.GCRecord IS NULL`
        );
        for (const r of hc) {
          const key = Number(r.Cliente);
          if (Number.isNaN(key)) continue;
          const arr = locByCliente.get(key) || [];
          let sede = arr.find((a) => a.oid === null);
          if (!sede) {
            sede = { oid: null, nombre: 'Sede Principal', zona: null, subZona: null, geo: null, puestos: [] };
            arr.push(sede);
          }
          sede.puestos.push({
            oid: r.OID, referencia: cleanStr(r.Descripcion) || `Puesto ${r.OID}`,
            armaOID: null, requiereArma: false, armaSerial: null, arma: null, horarios: [],
          });
          locByCliente.set(key, arr);
        }
      } catch (_) { /* respaldo opcional */ }
    }

    const soloConContrato = String(req.query.todos || '') !== '1';
    const clientes = clientesRows
      .map((c) => ({
        oid: Number(c.OID),
        codigo: c.Codigo ?? null,
        nombre: cleanStr(c.Nombre) || `Cliente ${c.Codigo ?? c.OID}`,
        rnc: cleanStr(c.RNC) || '',
        cedula: cleanStr(c.Cedula) || '',
        direccion: cleanStr(c.Direccion) || '',
        telefono: cleanStr(c.Telefono) || '',
        email: cleanStr(c.Email) || '',
        contacto: cleanStr(c.Contacto) || '',
        inactivo: !!c.Inactivo,
        localidades: locByCliente.get(Number(c.OID)) || [],
      }))
      .filter((c) => (soloConContrato ? c.localidades.length > 0 : true))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    let nLoc = 0, nPuestos = 0, nHorarios = 0, nLineas = 0, nArmas = 0, precio = 0, horas = 0;
    const vigilantes = new Set();
    for (const c of clientes) {
      for (const l of c.localidades) {
        nLoc++;
        for (const p of l.puestos) {
          nPuestos++;
          if (p.requiereArma) nArmas++;
          for (const h of p.horarios) {
            nHorarios++;
            horas += Number(h.regularHoras) || 0;
            for (const d of h.detalles) {
              nLineas++;
              precio += Number(d.precio) || 0;
              if (d.vigilanteOID != null) vigilantes.add(d.vigilanteOID);
            }
          }
        }
      }
    }

    res.json({
      fuente,
      disponible: { localidades: hasLoc, puestos: hasPuesto, horarios: hasHorario, detalles: hasHorarioD },
      clientes,
      totals: {
        clientes: clientes.length,
        localidades: nLoc,
        puestos: nPuestos,
        horarios: nHorarios,
        lineas: nLineas,
        armas: nArmas,
        vigilantes: vigilantes.size,
        horasSemana: round2(horas),
        precio: round2(precio),
      },
    });
  } catch (e) { res.status(502).json({ message: e.message }); }
});



// ─── Exportación de esquema: PKs/FKs por tabla ───
router.get('/schema-keys', auth, guard, async (req, res) => {
  try {
    const rows = await sql.query(
      `SELECT tc.TABLE_NAME AS tabla, tc.CONSTRAINT_TYPE AS tipo,
              kcu.COLUMN_NAME AS columna, tc.CONSTRAINT_NAME AS restriccion
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
       JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
         ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
       WHERE tc.CONSTRAINT_TYPE IN ('PRIMARY KEY','FOREIGN KEY')
       ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_TYPE`
    );
    res.json(rows.map((r) => ({
      tabla: r.tabla, tipo: r.tipo, columna: r.columna, restriccion: r.restriccion,
    })));
  } catch (e) { res.status(502).json({ message: e.message }); }
});

module.exports = router;
