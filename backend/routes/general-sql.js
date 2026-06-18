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

// Lee todas las armas de Armamento con sus catálogos resueltos.
async function readWeapons() {
  const rows = await sql.query(`SELECT * FROM Armamento WHERE GCRecord IS NULL`);
  const [marcaCat, tipoCat, calCat, catCat] = await Promise.all([
    catalogMap(['MarcaArma', 'Marca', 'Marcas']),
    catalogMap(['TipoArma', 'TipoArmamento', 'Tipo']),
    catalogMap(['Calibre', 'CalibreArma', 'Calibres']),
    catalogMap(['CategoriaArma', 'Categoria', 'Categorias']),
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
  return rows.map((r) => {
    const marcaCode = pick(r, 'Marca');
    const tipoCode = pick(r, 'Tipo');
    const calCode = pick(r, 'Calibre');
    const catCode = pick(r, 'Categoria');
    return {
      oid: pick(r, 'OID'),
      codigo: pick(r, 'Codigo'),
      serie: cleanStr(pick(r, 'Serie', 'NumeroSerie', 'NoSerie', 'Serial')),
      marca: resolve(marcaCat, marcaCode),
      tipo: resolve(tipoCat, tipoCode),
      calibre: resolve(calCat, calCode),
      categoria: resolve(catCat, catCode),
      noLicencia: cleanStr(pick(r, 'NoLicencia', 'Licencia', 'NoRegistro', 'Registro')),
      estatus: cleanStr(pick(r, 'Estatus')),
      permanente: pick(r, 'Permanente') === 1 || pick(r, 'Permanente') === true,
      vence: cleanStr(pick(r, 'Vence')),
      nota: cleanStr(pick(r, 'Nota')),
      propietario: cleanStr(pick(r, 'Propietario')),
    };
  });
}

// ─── Armamento (números de serie de armas, catálogos resueltos) ───
router.get('/weapons', auth, guard, async (req, res) => {
  try {
    res.json(await readWeapons());
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
      });
    }
  } catch (_) { /* Armamento puede no existir; se ignora */ }
  return map;
}

// Devuelve el conjunto de columnas existentes (en minúsculas) de una tabla.
const _colCache = new Map();
async function tableColumns(table) {
  if (_colCache.has(table)) return _colCache.get(table);
  let set = new Set();
  try {
    const rows = await sql.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @t`,
      { t: table }
    );
    set = new Set(rows.map((r) => String(r.COLUMN_NAME).toLowerCase()));
  } catch (_) { /* si falla, set vacío → se usan NULLs */ }
  _colCache.set(table, set);
  return set;
}

// Construye "alias.Col AS Alias" si existe, o "NULL AS Alias" si no.
function selCol(cols, alias, column, asName) {
  return cols.has(String(column).toLowerCase())
    ? `${alias}.${column} AS ${asName}`
    : `NULL AS ${asName}`;
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

    // Estructura oficial: ReportePuesto → HoraContratada (Puesto) → Cliente,
    // con Zona (localidad) y Tanda (turno) del ReporteDiario.
    // Algunas instalaciones de gSafeOne no tienen ciertas columnas (p.ej. Codigo
    // en Cliente/HoraContratada). Detectamos las columnas reales para evitar
    // "Invalid column name 'Codigo'".
    const [cCols, hCols, eCols, rpCols] = await Promise.all([
      tableColumns('Cliente'),
      tableColumns('HoraContratada'),
      tableColumns('Empleado'),
      tableColumns('ReportePuesto'),
    ]);

    // Nombre del empleado: usa NombreCompleto si existe (query oficial),
    // si no, concatena Nombre1/Apellido1 como respaldo.
    const empNombre = eCols.has('nombrecompleto')
      ? 'e.NombreCompleto AS EmpleadoNombre'
      : `${selCol(eCols, 'e', 'Nombre1', 'Nombre1')}, ${selCol(eCols, 'e', 'Apellido1', 'Apellido1')}, NULL AS EmpleadoNombre`;

    const rpGcFilter = rpCols.has('gcrecord') ? 'rp.GCRecord IS NULL AND ' : '';

    const rows = await sql.query(
      `SELECT rp.OID AS LineaOID, rp.Horas, rp.Arma AS ArmaOID,
              ${selCol(rpCols, 'rp', 'Incentivo', 'Incentivo')},
              ${selCol(rpCols, 'rp', 'Novedad', 'NovedadOID')},
              ${selCol(rpCols, 'rp', 'Comentario', 'Comentario')},
              c.OID AS ClienteOID,
              ${selCol(cCols, 'c', 'Codigo', 'ClienteCodigo')},
              ${selCol(cCols, 'c', 'Nombre', 'ClienteNombre')},
              ${selCol(cCols, 'c', 'Direccion', 'Direccion')},
              ${selCol(cCols, 'c', 'Telefono', 'Telefono')},
              ${selCol(cCols, 'c', 'Email', 'Email')},
              ${selCol(cCols, 'c', 'RNC', 'RNC')},
              ${selCol(cCols, 'c', 'Cedula', 'Cedula')},
              ${selCol(cCols, 'c', 'Contacto', 'Contacto')},
              ${selCol(cCols, 'c', 'Inactivo', 'Inactivo')},
              h.OID AS PuestoOID,
              ${selCol(hCols, 'h', 'Codigo', 'PuestoCodigo')},
              ${selCol(hCols, 'h', 'Descripcion', 'PuestoDesc')},
              z.Descripcion AS Zona, t.Descripcion AS Tanda,
              e.OID AS VigilanteOID,
              ${selCol(eCols, 'e', 'Codigo', 'VigilanteCodigo')},
              ${empNombre},
              ${selCol(eCols, 'e', 'Cedula', 'VigilanteCedula')},
              ${selCol(eCols, 'e', 'FechaNacimiento', 'VigilanteNacimiento')}
       FROM ReportePuesto rp
       JOIN ReporteDiarioD rd ON rp.ReporteDiarioD = rd.OID
       JOIN ReporteDiario r ON rd.ReporteDiario = r.OID
       JOIN HoraContratada h ON rp.Puesto = h.OID
       JOIN Cliente c ON h.Cliente = c.OID
       LEFT JOIN Empleado e ON rp.Vigilante = e.OID
       JOIN Zona z ON rd.Zona = z.OID
       JOIN Tanda t ON rd.Tanda = t.OID
       LEFT JOIN Armamento a ON rp.Arma = a.OID
       WHERE ${rpGcFilter}r.GCRecord IS NULL
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
