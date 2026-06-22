/**
 * Payroll & TSS Compliance module
 * 
 * Files:
 *  - tss-imports.json          → array de períodos importados [{period, importedAt, importedBy, rows:[...]}]
 *  - payroll-runs.json         → array de nóminas generadas
 *  - payslip-log.json          → log de envíos de volantes (modo prueba o real)
 * 
 * Cálculo descuentos (DR 2026):
 *   - SFS afiliado: 3.04% sobre salario cotizable, tope 10 SM (≈ 246,300)
 *   - AFP afiliado: 2.87% sobre salario cotizable, tope 4 SM (≈ 98,520)
 *   - ISR: escala anualizada DGII vigente
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');
const SEED = require('../helpers/employeesSeed.json');

const router = express.Router();

const TSS_FILE = 'tss-imports.json';
const RUNS_FILE = 'payroll-runs.json';
const LOG_FILE = 'payslip-log.json';

// ─── DR Tax constants 2026 (editables si cambia normativa) ───
const SM = 24633; // Salario mínimo cotizable TSS observado en archivo abril 2026
const SFS_RATE = 0.0304;
const AFP_RATE = 0.0287;
const SFS_CAP = SM * 10;
const AFP_CAP = SM * 4;

// ISR escala anual (DGII vigente)
const ISR_BRACKETS = [
  { from: 0,        to: 416220.00, rate: 0,    fixed: 0 },
  { from: 416220.01,to: 624329.00, rate: 0.15, fixed: 0 },
  { from: 624329.01,to: 867123.00, rate: 0.20, fixed: 31216 },
  { from: 867123.01,to: Infinity,  rate: 0.25, fixed: 79776 },
];

function calcISRMonthly(taxableMonthly) {
  const annual = taxableMonthly * 12;
  const b = ISR_BRACKETS.find(x => annual >= x.from && annual <= x.to);
  if (!b || b.rate === 0) return 0;
  const isrAnnual = b.fixed + (annual - b.from + 0.01) * b.rate;
  return Math.max(0, isrAnnual / 12);
}

function calcDeductions(grossMonthly) {
  const sfsBase = Math.min(grossMonthly, SFS_CAP);
  const afpBase = Math.min(grossMonthly, AFP_CAP);
  const sfs = sfsBase * SFS_RATE;
  const afp = afpBase * AFP_RATE;
  const taxable = grossMonthly - sfs - afp;
  const isr = calcISRMonthly(taxable);
  return {
    sfs: round2(sfs),
    afp: round2(afp),
    isr: round2(isr),
    totalDeductions: round2(sfs + afp + isr),
    netMonthly: round2(grossMonthly - sfs - afp - isr),
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

/**
 * Cálculo de tarifa por hora según Superintendencia de Seguridad y CT R.D.
 * - Administrativos: salario / 23.83 días / 8 horas (regla CT estándar).
 * - Agentes/Operativos de seguridad: salario / 26 días / 10 horas normales diarias
 *   (disposición de la Superintendencia de Vigilancia y Seguridad Privada).
 */
function isSecurityAgent(emp) {
  const cat = String(emp.category || emp.payrollType || '').toLowerCase();
  const pos = String(emp.position || '').toLowerCase();
  if (cat.includes('administrativ')) return false;
  // Por defecto, cualquier no-administrativo se considera operativo de seguridad
  return /agente|guardia|oficial|operativo|escolta|supervisor|vigilancia/.test(pos) || cat !== 'administrativo';
}

function payrollFactors(emp) {
  const security = isSecurityAgent(emp);
  const monthlyDivisor = security ? 26 : 23.83;
  const normalDailyHours = security ? 10 : 8;
  const hourlyRate = (Number(emp.salary) || 0) / monthlyDivisor / normalDailyHours;
  return { security, monthlyDivisor, normalDailyHours, hourlyRate };
}

function loadEmployees() {
  const raw = readData('employees.json');
  return Array.isArray(raw) && raw.length > 0 ? raw : SEED;
}

function loadTssImports() {
  const r = readData(TSS_FILE);
  return Array.isArray(r) ? r : [];
}

function loadExtrasForPeriod(period) {
  const all = readData('payroll-extras.json');
  const arr = Array.isArray(all) ? all : [];
  // period esperado: "YYYY-MM" o "YYYY-MM-Q1"/"Q2"
  const ym = (period || '').slice(0, 7);
  return arr.filter(x => (x.date || '').startsWith(ym));
}

function normalizeCedula(c) {
  return String(c || '').replace(/\D/g, '');
}

function normalizeName(n) {
  return String(n || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[,.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ──────────────────── TSS IMPORTS ────────────────────

// POST /api/payroll/tss/import   { period, rows:[{cedula, nombre, salarioSS, salarioReportado, sfsEmp, afpEmp, total}] }
router.post('/tss/import', auth, (req, res) => {
  const { period, rows } = req.body;
  if (!period || !Array.isArray(rows)) {
    return res.status(400).json({ message: 'period y rows requeridos' });
  }
  const all = loadTssImports();
  const idx = all.findIndex(x => x.period === period);
  const entry = {
    id: generateId('TSS', all),
    period,
    importedAt: new Date().toISOString(),
    importedBy: req.user?.fullName || req.user?.email || 'Sistema',
    rowCount: rows.length,
    rows: rows.map(r => ({
      cedula: normalizeCedula(r.cedula),
      nombre: r.nombre || '',
      idNss: r.idNss || '',
      salarioSS: Number(r.salarioSS) || 0,
      salarioReportado: Number(r.salarioReportado) || 0,
      sfsAfiliado: Number(r.sfsAfiliado) || 0,
      afpAfiliado: Number(r.afpAfiliado) || 0,
      total: Number(r.total) || 0,
    })),
  };
  if (idx >= 0) all[idx] = { ...all[idx], ...entry, id: all[idx].id };
  else all.push(entry);
  writeData(TSS_FILE, all);
  res.json({ ok: true, period, count: rows.length });
});

// GET /api/payroll/tss   → list of periods (without rows for size)
router.get('/tss', auth, (req, res) => {
  const all = loadTssImports();
  res.json(all.map(({ rows, ...meta }) => ({ ...meta })));
});

// GET /api/payroll/tss/:period  → full rows
router.get('/tss/:period', auth, (req, res) => {
  const all = loadTssImports();
  const found = all.find(x => x.period === req.params.period);
  if (!found) return res.status(404).json({ message: 'Período no encontrado' });
  res.json(found);
});

// DELETE /api/payroll/tss/:period
router.delete('/tss/:period', auth, (req, res) => {
  if (!req.user?.isAdmin && req.user?.department !== 'Recursos Humanos') {
    return res.status(403).json({ message: 'No autorizado' });
  }
  const all = loadTssImports();
  const next = all.filter(x => x.period !== req.params.period);
  writeData(TSS_FILE, next);
  res.json({ ok: true });
});

// GET /api/payroll/tss/:period/compare   → cruce con activos
router.get('/tss/:period/compare', auth, (req, res) => {
  const all = loadTssImports();
  const tss = all.find(x => x.period === req.params.period);
  if (!tss) return res.status(404).json({ message: 'Período no encontrado' });

  const employees = loadEmployees();
  const tssByCed = new Map();
  const tssByName = new Map();
  tss.rows.forEach(r => {
    if (r.cedula) tssByCed.set(r.cedula, r);
    if (r.nombre) tssByName.set(normalizeName(r.nombre), r);
  });

  const matched = [];      // activo + tss OK
  const missingTss = [];   // activo sin tss
  const ghostTss = [];     // tss pero no activo
  const salaryMismatch = []; // diferencia entre intranet y reportado

  const matchedTssCeds = new Set();

  employees.forEach(e => {
    const ced = normalizeCedula(e.tss);
    let row = ced ? tssByCed.get(ced) : null;
    let matchType = row ? 'cedula' : 'none';
    if (!row) {
      row = tssByName.get(normalizeName(e.fullName));
      if (row) matchType = 'nombre';
    }

    if (e.status === 'Activo') {
      if (row) {
        matchedTssCeds.add(row.cedula);
        matched.push({
          employeeCode: e.employeeCode,
          fullName: e.fullName,
          department: e.department,
          position: e.position,
          category: e.category || e.payrollType,
          cedula: e.tss || row.cedula,
          intranetSalary: Number(e.salary) || 0,
          tssReportedSalary: row.salarioReportado,
          tssSalary: row.salarioSS,
          afp: row.afpAfiliado,
          sfs: row.sfsAfiliado,
          matchType,
        });
        // Salary check (compara salario intranet vs SALARIO_SS_REPORTADO)
        const intra = Number(e.salary) || 0;
        const reported = row.salarioReportado;
        const diff = Math.abs(intra - reported);
        if (intra > 0 && diff > 100) {
          salaryMismatch.push({
            employeeCode: e.employeeCode,
            fullName: e.fullName,
            department: e.department,
            intranetSalary: intra,
            tssReportedSalary: reported,
            difference: round2(intra - reported),
          });
        }
      } else {
        missingTss.push({
          employeeCode: e.employeeCode,
          fullName: e.fullName,
          department: e.department,
          position: e.position,
          category: e.category || e.payrollType,
          cedula: e.tss || '',
          intranetSalary: Number(e.salary) || 0,
        });
      }
    }
  });

  // Ghost: en TSS pero no activos en intranet
  tss.rows.forEach(r => {
    if (matchedTssCeds.has(r.cedula)) return;
    // ¿Existe en intranet pero inactivo?
    const inactive = employees.find(e =>
      normalizeCedula(e.tss) === r.cedula ||
      normalizeName(e.fullName) === normalizeName(r.nombre)
    );
    ghostTss.push({
      cedula: r.cedula,
      fullName: r.nombre,
      idNss: r.idNss,
      tssReportedSalary: r.salarioReportado,
      total: r.total,
      intranetStatus: inactive ? inactive.status : 'No registrado',
      intranetCode: inactive?.employeeCode || '',
    });
  });

  res.json({
    period: tss.period,
    importedAt: tss.importedAt,
    summary: {
      activeEmployees: employees.filter(e => e.status === 'Activo').length,
      tssReported: tss.rows.length,
      matched: matched.length,
      missingTss: missingTss.length,
      ghostTss: ghostTss.length,
      salaryMismatch: salaryMismatch.length,
    },
    matched,
    missingTss,
    ghostTss,
    salaryMismatch,
  });
});

// ──────────────────── PAYROLL RUNS ────────────────────

/**
 * Genera nómina para un período.
 * body: { period: "2026-05-Q1", payDate: "2026-05-15", schedule: "admin"|"ops", scope: "all"|"category"|"selected" }
 */
router.post('/runs/generate', auth, (req, res) => {
  if (!req.user?.isAdmin && req.user?.department !== 'Recursos Humanos') {
    return res.status(403).json({ message: 'No autorizado' });
  }
  const { period, payDate, schedule = 'admin', scope = 'all', selectedCodes = [], frequency = 'monthly' } = req.body;
  if (!period || !payDate) return res.status(400).json({ message: 'period y payDate requeridos' });

  const employees = loadEmployees().filter(e => e.status === 'Activo');
  let target = employees;
  if (scope === 'category') {
    if (schedule === 'admin') {
      target = employees.filter(e => (e.category || e.payrollType) === 'Administrativo');
    } else {
      target = employees.filter(e => (e.category || e.payrollType) !== 'Administrativo');
    }
  } else if (scope === 'selected') {
    target = employees.filter(e => selectedCodes.includes(e.employeeCode));
  }

  // factor: si frequency = quincenal → 0.5 ; si mensual completa → 1
  const factor = frequency === 'quincenal' ? 0.5 : 1;

  // Cargar extras (horas extras, nocturnas, feriados, almuerzos) del período
  const extras = loadExtrasForPeriod(period);
  const extrasByEmp = new Map();
  extras.forEach(x => {
    const arr = extrasByEmp.get(x.employeeCode) || [];
    arr.push(x);
    extrasByEmp.set(x.employeeCode, arr);
  });

  const items = target.map(e => {
    const grossMonthly = Number(e.salary) || 0;
    const factors = payrollFactors(e);
    const empExtras = extrasByEmp.get(e.employeeCode) || [];

    // Cálculos por tipo (CT R.D. Art. 203, 204, 205 — recargos referenciales)
    let overtimeHours = 0, overtimeAmount = 0;
    let nightHours = 0, nightAmount = 0;
    let holidayDays = 0, holidayAmount = 0;
    let mealDeduction = 0;
    let incentiveAmount = 0;
    const mealDetail = [];
    const incentiveDetail = [];

    empExtras.forEach(x => {
      const hourly = factors.hourlyRate;
      if (x.type === 'overtime') {
        const h = Number(x.hours) || 0;
        overtimeHours += h;
        // 35% recargo (Art. 203) hasta 68h/sem; aquí simplificamos a 35%
        overtimeAmount += x.amount ? Number(x.amount) : h * hourly * 1.35;
      } else if (x.type === 'night') {
        const h = Number(x.hours) || 0;
        nightHours += h;
        // Recargo nocturno 15%
        nightAmount += x.amount ? Number(x.amount) : h * hourly * 1.15;
      } else if (x.type === 'holiday') {
        const d = Number(x.days) || 1;
        holidayDays += d;
        // Día feriado trabajado: salario diario = sueldo mensual / 26, pagado al
        // 200% (día normal + 100% adicional por ser día libre/feriado).
        holidayAmount += x.amount ? Number(x.amount) : d * (grossMonthly / 26) * 2;
      } else if (x.type === 'incentive') {
        const a = Number(x.amount) || 0;
        incentiveAmount += a;
        incentiveDetail.push({ date: x.date, description: x.description || 'Incentivo', amount: round2(a) });
      } else if (x.type === 'meal') {
        const a = Number(x.amount) || 0;
        mealDeduction += a;
        mealDetail.push({ date: x.date, description: x.description || 'Almuerzo', amount: round2(a) });
      }
    });

    const ded = calcDeductions(grossMonthly);
    const grossPeriodBase = grossMonthly * factor;
    const earningsExtra = overtimeAmount + nightAmount + holidayAmount + incentiveAmount;
    const grossPeriod = grossPeriodBase + earningsExtra;
    const totalDeductions = ded.totalDeductions * factor + mealDeduction;
    const net = grossPeriod - totalDeductions;

    return {
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      cedula: e.cedula || e.tss || '',
      department: e.department,
      position: e.position,
      bank: e.bank,
      category: e.category || e.payrollType,
      hireDate: e.hireDate || '',
      isSecurityAgent: factors.security,
      monthlyDivisor: factors.monthlyDivisor,
      normalDailyHours: factors.normalDailyHours,
      hourlyRate: round2(factors.hourlyRate),
      grossMonthly,
      grossPeriodBase: round2(grossPeriodBase),
      overtimeHours: round2(overtimeHours),
      overtimeAmount: round2(overtimeAmount),
      nightHours: round2(nightHours),
      nightAmount: round2(nightAmount),
      holidayDays: round2(holidayDays),
      holidayAmount: round2(holidayAmount),
      mealDeduction: round2(mealDeduction),
      mealDetail,
      incentiveAmount: round2(incentiveAmount),
      incentiveDetail,
      grossPeriod: round2(grossPeriod),
      sfs: round2(ded.sfs * factor),
      afp: round2(ded.afp * factor),
      isr: round2(ded.isr * factor),
      totalDeductions: round2(totalDeductions),
      net: round2(net),
    };
  });

  const totals = items.reduce((acc, i) => ({
    gross: acc.gross + i.grossPeriod,
    sfs: acc.sfs + i.sfs,
    afp: acc.afp + i.afp,
    isr: acc.isr + i.isr,
    overtime: acc.overtime + i.overtimeAmount,
    night: acc.night + i.nightAmount,
    holiday: acc.holiday + i.holidayAmount,
    meals: acc.meals + i.mealDeduction,
    deductions: acc.deductions + i.totalDeductions,
    net: acc.net + i.net,
  }), { gross: 0, sfs: 0, afp: 0, isr: 0, overtime: 0, night: 0, holiday: 0, meals: 0, deductions: 0, net: 0 });

  const all = readData(RUNS_FILE);
  const list = Array.isArray(all) ? all : [];
  const run = {
    id: generateId('NOM', list),
    period,
    payDate,
    schedule,
    frequency,
    scope,
    createdAt: new Date().toISOString(),
    createdBy: req.user?.fullName || req.user?.email || 'Sistema',
    closed: false,
    items,
    totals: {
      gross: round2(totals.gross),
      sfs: round2(totals.sfs),
      afp: round2(totals.afp),
      isr: round2(totals.isr),
      overtime: round2(totals.overtime),
      night: round2(totals.night),
      holiday: round2(totals.holiday),
      meals: round2(totals.meals),
      deductions: round2(totals.deductions),
      net: round2(totals.net),
      count: items.length,
    },
  };
  // Marca extras como procesadas
  const extrasAll = readData('payroll-extras.json');
  if (Array.isArray(extrasAll)) {
    const ids = new Set(items.flatMap(i => extras.filter(x => x.employeeCode === i.employeeCode).map(x => x.id)));
    const updated = extrasAll.map(x => ids.has(x.id) ? { ...x, status: 'Procesada', payrollRunId: run?.id } : x);
    writeData('payroll-extras.json', updated);
  }
  list.unshift(run);
  writeData(RUNS_FILE, list);
  res.json(run);
});

router.get('/runs', auth, (req, res) => {
  const list = readData(RUNS_FILE);
  const arr = Array.isArray(list) ? list : [];
  // Sin items, solo metadata
  res.json(arr.map(({ items, ...meta }) => ({ ...meta, itemCount: items?.length || 0 })));
});

router.get('/runs/:id', auth, (req, res) => {
  const list = readData(RUNS_FILE);
  const r = (Array.isArray(list) ? list : []).find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ message: 'Nómina no encontrada' });
  res.json(r);
});

router.post('/runs/:id/close', auth, (req, res) => {
  if (!req.user?.isAdmin && req.user?.department !== 'Recursos Humanos') {
    return res.status(403).json({ message: 'No autorizado' });
  }
  const list = readData(RUNS_FILE);
  const arr = Array.isArray(list) ? list : [];
  const idx = arr.findIndex(x => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ message: 'No encontrada' });
  arr[idx] = { ...arr[idx], closed: true, closedAt: new Date().toISOString(), closedBy: req.user?.fullName };
  writeData(RUNS_FILE, arr);
  res.json(arr[idx]);
});

router.delete('/runs/:id', auth, (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).json({ message: 'Solo admin' });
  const list = readData(RUNS_FILE);
  const arr = (Array.isArray(list) ? list : []).filter(x => x.id !== req.params.id);
  writeData(RUNS_FILE, arr);
  res.json({ ok: true });
});

// ──────────────────── PAYSLIP SEND (stub mientras no haya SMTP) ────────────────────

/**
 * Modo prueba: siempre va a anoel@safeone.com.do hasta configurar SMTP.
 * Cuando se configure, leer FORCE_TEST_EMAIL del entorno.
 */
const FORCE_TEST_EMAIL = process.env.PAYSLIP_TEST_EMAIL || 'anoel@safeone.com.do';
const PAYSLIP_LIVE = String(process.env.PAYSLIP_LIVE || 'false') === 'true';

router.post('/payslips/send', auth, (req, res) => {
  const { runId, employeeCode, recipientEmail } = req.body;
  if (!runId || !employeeCode) return res.status(400).json({ message: 'runId y employeeCode requeridos' });
  const list = readData(RUNS_FILE);
  const run = (Array.isArray(list) ? list : []).find(x => x.id === runId);
  if (!run) return res.status(404).json({ message: 'Nómina no encontrada' });
  const item = run.items.find(i => i.employeeCode === employeeCode);
  if (!item) return res.status(404).json({ message: 'Empleado no en nómina' });

  const targetEmail = PAYSLIP_LIVE ? (recipientEmail || FORCE_TEST_EMAIL) : FORCE_TEST_EMAIL;

  // STUB: por ahora solo loguea. Cuando agreguen nodemailer + SMTP, se envía aquí.
  const log = readData(LOG_FILE);
  const arr = Array.isArray(log) ? log : [];
  const entry = {
    id: generateId('PSL', arr),
    runId,
    period: run.period,
    payDate: run.payDate,
    employeeCode,
    fullName: item.fullName,
    intendedEmail: recipientEmail || '',
    actualEmail: targetEmail,
    mode: PAYSLIP_LIVE ? 'live' : 'test',
    sentAt: new Date().toISOString(),
    sentBy: req.user?.fullName || req.user?.email || 'Sistema',
    delivered: true, // stub
  };
  arr.unshift(entry);
  writeData(LOG_FILE, arr);
  res.json({ ok: true, log: entry });
});

router.get('/payslips/log', auth, (req, res) => {
  const log = readData(LOG_FILE);
  res.json(Array.isArray(log) ? log : []);
});

module.exports = router;
