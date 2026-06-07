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
  return /recursos humanos|rrhh|tecnolog|gerencia/.test(dept);
}

function guard(req, res, next) {
  if (!canAccess(req.user)) return res.status(403).json({ message: 'No autorizado' });
  next();
}

const fullName = (r) => [r.Nombre1, r.Apellido1].filter(Boolean).join(' ').trim();

function mapPayrollRow(r) {
  const salario = Number(r.Salario) || 0;
  const incentivo = Number(r.Incentivo) || 0;
  const comision = Number(r.Comision) || 0;
  const afp = Number(r.AFP) || 0;
  const sfs = Number(r.SFS) || 0;
  const bruto = salario + incentivo + comision;
  const deducciones = afp + sfs;
  return {
    pagoDetalleOID: r.OID,
    empleadoOID: r.EmpleadoOID,
    codigo: r.Codigo,
    nombre: fullName(r),
    departamento: r.DeptOID ?? null,
    salario, incentivo, comision, afp, sfs,
    bruto: round2(bruto),
    deducciones: round2(deducciones),
    neto: round2(bruto - deducciones),
  };
}

async function readPayroll(pagoOID) {
  const rows = await sql.query(
    `SELECT d.OID, e.OID AS EmpleadoOID, e.Codigo, e.Nombre1, e.Apellido1,
            e.Departamento AS DeptOID, d.Salario, d.Incentivo, d.Comision, d.AFP, d.SFS
     FROM PagoD d
     JOIN Empleado e ON e.OID = d.Empleado
     WHERE d.Pago = @pago AND d.GCRecord IS NULL`,
    { pago: pagoOID }
  );
  return rows.map(mapPayrollRow);
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
async function buildHistory() {
  const rows = await sql.query(
    `SELECT TOP 12 p.OID, p.Ano, p.Mes,
            SUM(ISNULL(d.Salario,0)+ISNULL(d.Incentivo,0)+ISNULL(d.Comision,0)
                -ISNULL(d.AFP,0)-ISNULL(d.SFS,0)) AS Neto
     FROM Pago p
     JOIN PagoD d ON d.Pago = p.OID AND d.GCRecord IS NULL
     WHERE p.GCRecord IS NULL
     GROUP BY p.OID, p.Ano, p.Mes
     ORDER BY p.Ano DESC, p.Mes DESC`
  );
  // Orden cronológico ascendente para la regresión
  return rows.reverse().map(r => ({ label: `${r.Ano}-${String(r.Mes).padStart(2, '0')}`, total: round2(r.Neto) }));
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
    });
  } catch (e) { res.status(502).json({ message: e.message }); }
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

// ─── Armamento (números de serie de armas) ───
router.get('/weapons', auth, guard, async (req, res) => {
  try {
    const rows = await sql.query(
      `SELECT a.OID, a.Serie, a.NumeroSerie, a.Modelo, a.Registro,
              ma.Descripcion AS Marca, ca.Descripcion AS Calibre,
              ta.Descripcion AS Tipo, ea.Descripcion AS Estatus
       FROM Armamento a
       LEFT JOIN MarcaArma ma ON ma.OID = a.Marca
       LEFT JOIN CalibreArma ca ON ca.OID = a.Calibre
       LEFT JOIN TipoArma ta ON ta.OID = a.Tipo
       LEFT JOIN EstatusArma ea ON ea.OID = a.Estatus
       WHERE a.GCRecord IS NULL
       ORDER BY a.Serie`
    );
    res.json(rows.map(r => ({
      oid: r.OID,
      serie: r.Serie || r.NumeroSerie || null,
      modelo: r.Modelo || null,
      registro: r.Registro || null,
      marca: r.Marca || null,
      calibre: r.Calibre || null,
      tipo: r.Tipo || null,
      estatus: r.Estatus || null,
    })));
  } catch (e) { res.status(502).json({ message: e.message }); }
});

module.exports = router;
