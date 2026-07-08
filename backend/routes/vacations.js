/**
 * Provisionamiento de Vacaciones.
 * Archivo: vacations.json  → { policy, plans: { [codigo]: { periods: [...], ... } } }
 *
 * A partir de ahora las vacaciones NO se pagan: el empleado selecciona en un
 * calendario los días a disfrutar. Días por antigüedad:
 *   < 5 años  → 14 días
 *   >= 5 años → 18 días
 *
 * El roster de "Tecnología y Monitoreo" se enriquece con la tabla Empleado de
 * gSafeOne (SQL Server, solo lectura) por Código para obtener FechaIngreso y
 * calcular la antigüedad. Si SQL no está disponible, se usa el roster local.
 */
const express = require('express');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');
const sql = require('../config/sqlServer');

const router = express.Router();
const FILE = 'vacations.json';

const DEFAULT_POLICY = { under5Days: 14, from5Days: 18, tenureThresholdYears: 5 };

// Departamentos disponibles (se irán agregando). Cada uno con su propio botón.
const DEPARTMENTS = [
  { id: 'tecnologia-monitoreo', name: 'Tecnología y Monitoreo', available: true },
  { id: 'operaciones', name: 'Operaciones', available: false },
  { id: 'administracion', name: 'Administración y Finanzas', available: false },
  { id: 'comercial', name: 'Gerencia Comercial', available: false },
  { id: 'rrhh', name: 'Recursos Humanos', available: false },
  { id: 'seguridad-electronica', name: 'Seguridad Electrónica', available: false },
];

// Roster de Monitoreo (códigos de empleado en gSafeOne).
const MONITOREO_ROSTER = [
  { codigo: '1846', nombre: 'Rusbert Michel', ubicacion: 'ALNAP', horario: 'Dom–Jue 07:00–15:00', cumpleanos: '01-oct', celular: '(849) 207-4201' },
  { codigo: '2979', nombre: 'Raúl Antonio Moreta Méndez', ubicacion: 'ALNAP', horario: 'Lun–Vie 06:00–14:00', cumpleanos: '18-jun', celular: '(849) 855-9284' },
  { codigo: '2173', nombre: 'Diego Guzman Hidalgo', ubicacion: 'ALNAP', horario: 'Sáb–Mié 02:00–10:00', cumpleanos: '28-abr', celular: '(809) 459-9792' },
  { codigo: '1745', nombre: 'Frederlin Peguero Peguero', ubicacion: 'ALNAP', horario: 'Lun–Jue 01:00–09:00 / Vie 07:00–15:00', cumpleanos: '26-mar', celular: '(849) 624-2381' },
  { codigo: '3876', nombre: 'Luis Enrique Rosario', ubicacion: 'ALNAP', horario: 'Dom–Lun 22:00–06:00 / Jue–Vie 02:00–10:00', cumpleanos: '13-oct', celular: '(809) 843-9143' },
  { codigo: '4085', nombre: 'Diego Castillo Ramos', ubicacion: 'ALNAP', horario: 'Mar–Sáb 22:00–06:00', cumpleanos: '17-dic', celular: '(829) 690-2351' },
  { codigo: '4087', nombre: 'Issac Peralta De Oleo', ubicacion: 'Banco Caribe', horario: 'Lun–Vie 07:00–19:00', cumpleanos: '27-jul', celular: '(829) 729-5695' },
  { codigo: '4110', nombre: 'Brayan Piña Ramirez', ubicacion: 'Banco Caribe', horario: 'Lun–Mié / Sáb–Dom 19:00–07:00', cumpleanos: '10-feb', celular: '(829) 323-5262' },
  { codigo: '3889', nombre: 'Yunior Manzanillo Peña', ubicacion: 'Banco Caribe', horario: 'Jue–Vie 19:00–07:00 / Sáb–Dom 07:00–19:00', cumpleanos: '25-may', celular: '(849) 504-7804' },
  { codigo: '3751', nombre: 'Brandon Diaz Perez', ubicacion: 'Sede Central', horario: 'Lun–Vie 07:00–17:00', cumpleanos: '14-jul', celular: '(829) 570-8977' },
  { codigo: '3686', nombre: 'Cesar Rafael Reyes Diaz', ubicacion: 'Sede Central', horario: 'Lun–Vie 09:00–19:00', cumpleanos: '17-ago', celular: '(829) 850-3712' },
  { codigo: '3374', nombre: 'Alejandro Alcantara Echavarria', ubicacion: 'Sede Central', horario: 'Lun–Vie 19:00–07:00', cumpleanos: '27-oct', celular: '(809) 901-9862' },
  { codigo: '1536', nombre: 'Bradelin Almonte', ubicacion: 'Sede Central', horario: 'Lun–Vie 19:00–07:00', cumpleanos: '25-feb', celular: '(829) 620-9578' },
];

function loadStore() {
  let store = readData(FILE);
  if (!store || Array.isArray(store) || typeof store !== 'object') {
    store = { policy: DEFAULT_POLICY, plans: {} };
    writeData(FILE, store);
  }
  if (!store.policy) store.policy = DEFAULT_POLICY;
  if (!store.plans) store.plans = {};
  return store;
}

function yearsBetween(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return diff / (365.25 * 24 * 3600 * 1000);
}

function entitledDays(years, policy) {
  if (years == null) return null;
  return years >= policy.tenureThresholdYears ? policy.from5Days : policy.under5Days;
}

// GET departamentos
router.get('/departments', auth, (req, res) => {
  res.json(DEPARTMENTS);
});

// GET política
router.get('/policy', auth, (req, res) => {
  res.json(loadStore().policy);
});

// PUT política (admin)
router.put('/policy', auth, (req, res) => {
  const store = loadStore();
  const { under5Days, from5Days, tenureThresholdYears } = req.body || {};
  store.policy = {
    under5Days: Number(under5Days) || store.policy.under5Days,
    from5Days: Number(from5Days) || store.policy.from5Days,
    tenureThresholdYears: Number(tenureThresholdYears) || store.policy.tenureThresholdYears,
  };
  writeData(FILE, store);
  res.json(store.policy);
});

// GET roster de un departamento (por ahora solo Monitoreo) enriquecido con SQL.
router.get('/roster/:deptId', auth, async (req, res) => {
  const store = loadStore();
  const policy = store.policy;

  if (req.params.deptId !== 'tecnologia-monitoreo') {
    return res.json({ department: req.params.deptId, available: false, employees: [] });
  }

  // Mapa codigo → datos de SQL (FechaIngreso, salario, activo)
  const sqlByCode = new Map();
  try {
    if (sql.isConfigured && sql.isConfigured()) {
      const rows = await sql.query(
        `SELECT e.Codigo, e.Nombre1, e.Apellido1, e.FechaIngreso, e.Salario,
                CASE WHEN ea.Empleado IS NOT NULL THEN 1 ELSE 0 END AS Activo
         FROM Empleado e
         LEFT JOIN EmpleadoActivo ea ON ea.Empleado = e.OID AND ea.GCRecord IS NULL
         WHERE e.GCRecord IS NULL`
      );
      rows.forEach((r) => sqlByCode.set(String(r.Codigo), r));
    }
  } catch (e) {
    // SQL no disponible: se continúa con el roster local
  }

  const employees = MONITOREO_ROSTER.map((emp) => {
    const s = sqlByCode.get(String(emp.codigo));
    const fechaIngreso = s ? s.FechaIngreso : null;
    const years = yearsBetween(fechaIngreso);
    const dias = entitledDays(years, policy);
    const plan = store.plans[emp.codigo] || null;
    const takenDays = plan ? (plan.periods || []).reduce((a, p) => a + (Number(p.days) || 0), 0) : 0;
    return {
      ...emp,
      fechaIngreso,
      salario: s ? Number(s.Salario) || 0 : null,
      activo: s ? !!s.Activo : null,
      antiguedadAnios: years != null ? Math.floor(years) : null,
      diasDerecho: dias != null ? dias : policy.under5Days,
      diasEstimados: dias == null,
      plan,
      diasTomados: takenDays,
    };
  });

  res.json({ department: 'tecnologia-monitoreo', available: true, sqlConnected: sqlByCode.size > 0, employees });
});

// GET planes
router.get('/plans', auth, (req, res) => {
  res.json(loadStore().plans);
});

// PUT plan de un empleado
router.put('/plans/:codigo', auth, (req, res) => {
  const store = loadStore();
  const { periods, nombre, ubicacion, notes } = req.body || {};
  store.plans[req.params.codigo] = {
    codigo: req.params.codigo,
    nombre: nombre || (store.plans[req.params.codigo] || {}).nombre || '',
    ubicacion: ubicacion || (store.plans[req.params.codigo] || {}).ubicacion || '',
    notes: notes || '',
    periods: Array.isArray(periods) ? periods : [],
    updatedAt: new Date().toISOString(),
    updatedBy: req.user ? req.user.fullName || req.user.email : 'sistema',
  };
  writeData(FILE, store);
  res.json(store.plans[req.params.codigo]);
});

module.exports = router;
