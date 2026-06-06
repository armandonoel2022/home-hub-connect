/**
 * Motor analítico de nómina.
 * Funciones puras que reciben arreglos ya leídos (de SQL Server o JSON) y
 * devuelven: anomalías, conciliación contra Excel y proyección predictiva.
 */

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Detecta anomalías comparando la nómina actual contra la anterior.
 * rows = [{ empleadoOID, codigo, nombre, departamento, salario, incentivo,
 *           comision, afp, sfs, bruto, deducciones, neto }]
 */
function detectAnomalies(current, previous = []) {
  const prevByCode = new Map();
  previous.forEach(r => prevByCode.set(String(r.codigo || r.empleadoOID), r));
  const curCodes = new Set(current.map(r => String(r.codigo || r.empleadoOID)));

  const anomalies = [];

  // Estadística para outliers (z-score sobre el neto del período actual)
  const nets = current.map(r => Number(r.neto) || 0).filter(n => n > 0);
  const mean = nets.reduce((a, b) => a + b, 0) / (nets.length || 1);
  const variance = nets.reduce((a, b) => a + (b - mean) ** 2, 0) / (nets.length || 1);
  const std = Math.sqrt(variance) || 1;

  current.forEach(r => {
    const code = String(r.codigo || r.empleadoOID);
    const prev = prevByCode.get(code);
    const neto = Number(r.neto) || 0;

    // 1) Empleado nuevo en nómina
    if (!prev) {
      anomalies.push({
        severity: 'info', type: 'nuevo', empleado: r.nombre, codigo: code,
        departamento: r.departamento,
        message: `Aparece en esta nómina pero no estaba en el período anterior.`,
      });
    } else {
      // 2) Cambio de salario base
      const ps = Number(prev.salario) || 0, cs = Number(r.salario) || 0;
      if (ps > 0 && Math.abs(cs - ps) > 1) {
        anomalies.push({
          severity: Math.abs(cs - ps) / ps > 0.15 ? 'high' : 'medium', type: 'salario',
          empleado: r.nombre, codigo: code, departamento: r.departamento,
          message: `Salario base cambió de ${ps.toLocaleString()} a ${cs.toLocaleString()}.`,
          delta: round2(cs - ps),
        });
      }
      // 3) Variación brusca del neto
      const pn = Number(prev.neto) || 0;
      if (pn > 0) {
        const pct = (neto - pn) / pn;
        if (Math.abs(pct) > 0.25) {
          anomalies.push({
            severity: Math.abs(pct) > 0.5 ? 'high' : 'medium', type: 'neto',
            empleado: r.nombre, codigo: code, departamento: r.departamento,
            message: `Neto a pagar varió ${(pct * 100).toFixed(1)}% vs período anterior (${pn.toLocaleString()} → ${neto.toLocaleString()}).`,
            delta: round2(neto - pn),
          });
        }
      }
    }

    // 4) Outlier estadístico
    const z = (neto - mean) / std;
    if (Math.abs(z) > 3) {
      anomalies.push({
        severity: 'medium', type: 'outlier', empleado: r.nombre, codigo: code,
        departamento: r.departamento,
        message: `Neto atípico para el período (z=${z.toFixed(1)}).`,
      });
    }

    // 5) Deducciones cero con salario > 0 (posible omisión TSS)
    if ((Number(r.salario) || 0) > 0 && (Number(r.deducciones) || 0) === 0) {
      anomalies.push({
        severity: 'high', type: 'deduccion', empleado: r.nombre, codigo: code,
        departamento: r.departamento,
        message: `Sin deducciones AFP/SFS teniendo salario. Revisar cumplimiento TSS.`,
      });
    }
  });

  // 6) Empleados que salieron de la nómina
  previous.forEach(r => {
    const code = String(r.codigo || r.empleadoOID);
    if (!curCodes.has(code)) {
      anomalies.push({
        severity: 'info', type: 'baja', empleado: r.nombre, codigo: code,
        departamento: r.departamento,
        message: `Estaba en el período anterior y ya no aparece en esta nómina.`,
      });
    }
  });

  return anomalies.sort((a, b) => {
    const order = { high: 0, medium: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });
}

/**
 * Concilia las horas extras / feriados reportados contra el Excel de
 * "cuentas y pagos" subido por el usuario.
 *
 * reported = [{ empleado, codigo, tipo: 'overtime'|'holiday', horas, monto, fecha }]
 * excelRows = [{ empleado, codigo, concepto, monto }]  (filas del Excel)
 */
function reconcileExcel(reported = [], excelRows = []) {
  const excelIndex = new Map(); // key por codigo|nombre normalizado → suma de montos extra/feriado
  excelRows.forEach(x => {
    const key = norm(x.codigo) || norm(x.empleado);
    if (!key) return;
    const concept = norm(x.concepto);
    const bucket = excelIndex.get(key) || { overtime: 0, holiday: 0, total: 0, nombre: x.empleado };
    const monto = Number(x.monto) || 0;
    if (/extra|hora/.test(concept)) bucket.overtime += monto;
    else if (/feriad|holiday/.test(concept)) bucket.holiday += monto;
    bucket.total += monto;
    excelIndex.set(key, bucket);
  });

  const reportIndex = new Map();
  reported.forEach(r => {
    const key = norm(r.codigo) || norm(r.empleado);
    if (!key) return;
    const bucket = reportIndex.get(key) || { overtime: 0, holiday: 0, nombre: r.empleado };
    const monto = Number(r.monto) || 0;
    if (r.tipo === 'overtime') bucket.overtime += monto;
    else if (r.tipo === 'holiday') bucket.holiday += monto;
    reportIndex.set(key, bucket);
  });

  const results = [];
  const keys = new Set([...reportIndex.keys(), ...excelIndex.keys()]);
  keys.forEach(key => {
    const rep = reportIndex.get(key) || { overtime: 0, holiday: 0 };
    const exc = excelIndex.get(key) || { overtime: 0, holiday: 0 };
    const nombre = (reportIndex.get(key) || excelIndex.get(key) || {}).nombre || key;
    const otDiff = round2((exc.overtime || 0) - (rep.overtime || 0));
    const hoDiff = round2((exc.holiday || 0) - (rep.holiday || 0));
    let status = 'ok';
    if (rep.overtime + rep.holiday > 0 && exc.overtime + exc.holiday === 0) status = 'faltante_excel';
    else if (exc.overtime + exc.holiday > 0 && rep.overtime + rep.holiday === 0) status = 'no_reportado';
    else if (Math.abs(otDiff) > 1 || Math.abs(hoDiff) > 1) status = 'discrepancia';
    results.push({
      empleado: nombre,
      reportadoExtra: round2(rep.overtime), excelExtra: round2(exc.overtime), difExtra: otDiff,
      reportadoFeriado: round2(rep.holiday), excelFeriado: round2(exc.holiday), difFeriado: hoDiff,
      status,
    });
  });

  const summary = {
    total: results.length,
    ok: results.filter(r => r.status === 'ok').length,
    discrepancia: results.filter(r => r.status === 'discrepancia').length,
    faltanteExcel: results.filter(r => r.status === 'faltante_excel').length,
    noReportado: results.filter(r => r.status === 'no_reportado').length,
  };
  return { summary, rows: results.sort((a, b) => (a.status === 'ok' ? 1 : 0) - (b.status === 'ok' ? 1 : 0)) };
}

/**
 * Proyección predictiva por regresión lineal simple sobre el costo total
 * histórico de la nómina.
 * history = [{ label, total }] en orden cronológico.
 */
function forecast(history = [], periodsAhead = 3) {
  const pts = history.map((h, i) => ({ x: i, y: Number(h.total) || 0 }));
  const n = pts.length;
  if (n < 2) {
    return { trend: 'insuficiente', slope: 0, projection: [], r2: 0 };
  }
  const sx = pts.reduce((a, p) => a + p.x, 0);
  const sy = pts.reduce((a, p) => a + p.y, 0);
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const intercept = (sy - slope * sx) / n;

  // R²
  const meanY = sy / n;
  const ssTot = pts.reduce((a, p) => a + (p.y - meanY) ** 2, 0) || 1;
  const ssRes = pts.reduce((a, p) => a + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const r2 = Math.max(0, 1 - ssRes / ssTot);

  const projection = [];
  for (let k = 1; k <= periodsAhead; k++) {
    const x = n - 1 + k;
    projection.push({ label: `Proyección +${k}`, total: round2(Math.max(0, slope * x + intercept)), projected: true });
  }
  return {
    trend: slope > 0 ? 'creciente' : slope < 0 ? 'decreciente' : 'estable',
    slope: round2(slope),
    avgGrowthPct: meanY ? round2((slope / meanY) * 100) : 0,
    r2: round2(r2),
    projection,
  };
}

module.exports = { detectAnomalies, reconcileExcel, forecast, round2 };
