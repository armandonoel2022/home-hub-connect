/**
 * Provisionamiento de Vacaciones — TODOS los departamentos.
 *
 * Fuente de datos del personal: registro de empleados (employees.json, sembrado
 * desde employeesSeed.json y enriquecible con la base gSafeOne por SQL). Se lee
 * "de la base de datos" en lugar de rosters codificados a mano.
 *
 * Flujo:
 *   - El personal con acceso a la intranet puede SOLICITAR sus propias vacaciones.
 *   - El líder de cada departamento aprueba/rechaza las solicitudes de su equipo.
 *   - Los administradores ven y gestionan todo.
 *   - Al aprobarse, se notifica a todo el equipo de RRHH (y al solicitante).
 *   - Los cambios (agregar/eliminar días) quedan registrados y se notifican.
 *
 * Días por antigüedad (Art. 177 CT):
 *   < 5 años  → 14 días hábiles
 *   >= 5 años → 18 días hábiles
 *
 * Archivo: vacations.json → { policy, requests: [ ... ] }
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');
const sql = require('../config/sqlServer');
const SEED = require('../helpers/employeesSeed.json');

const router = express.Router();
const FILE = 'vacations.json';
const NOTIF_FILE = 'notifications.json';

const DEFAULT_POLICY = { under5Days: 14, from5Days: 18, tenureThresholdYears: 5 };

// ── Utilidades ──────────────────────────────────────────────────────────────
function slugify(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function loadStore() {
  let store = readData(FILE);
  if (!store || Array.isArray(store) || typeof store !== 'object') {
    store = { policy: DEFAULT_POLICY, requests: [] };
    writeData(FILE, store);
  }
  if (!store.policy) store.policy = DEFAULT_POLICY;
  if (!Array.isArray(store.requests)) store.requests = [];
  return store;
}

// Lista base de empleados desde el registro (employees.json) o el seed.
function loadEmployees() {
  const raw = readData('employees.json');
  const list = Array.isArray(raw) && raw.length ? raw : SEED;
  return list
    .filter((e) => (e.status || 'Activo') === 'Activo')
    .map((e) => ({
      codigo: String(e.employeeCode),
      nombre: e.fullName,
      department: e.department || 'Sin departamento',
      position: e.position || '',
      hireDate: e.hireDate || null,
      isLeader: !!e.isDeptLeader,
      cumpleanos: e.birthdayMMDD || '',
    }));
}

function yearsBetween(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
}

function entitledDays(years, policy) {
  if (years == null) return null;
  return years >= policy.tenureThresholdYears ? policy.from5Days : policy.under5Days;
}

// Enriquecimiento opcional con SQL (FechaIngreso por Código).
async function sqlHireDates() {
  const map = new Map();
  try {
    if (sql.isConfigured && sql.isConfigured()) {
      const rows = await sql.query(
        `SELECT e.Codigo, e.FechaIngreso FROM Empleado e WHERE e.GCRecord IS NULL`
      );
      rows.forEach((r) => map.set(String(r.Codigo), r.FechaIngreso));
    }
  } catch (e) {
    /* SQL no disponible: se usa hireDate del registro */
  }
  return map;
}

// Departamentos con su líder (aprobador) calculado desde el registro.
function buildDepartments(employees) {
  const byDept = new Map();
  employees.forEach((e) => {
    if (!byDept.has(e.department)) byDept.set(e.department, []);
    byDept.get(e.department).push(e);
  });
  const depts = [];
  byDept.forEach((emps, name) => {
    const leader = emps.find((e) => e.isLeader) || null;
    depts.push({
      id: slugify(name),
      name,
      available: true,
      count: emps.length,
      leaderCode: leader ? leader.codigo : null,
      leaderName: leader ? leader.nombre : null,
    });
  });
  return depts.sort((a, b) => b.count - a.count);
}

// ── Notificaciones ──────────────────────────────────────────────────────────
function pushNotifications(recipients, { title, message, relatedId }) {
  if (!recipients.length) return;
  const items = readData(NOTIF_FILE) || [];
  const now = new Date().toISOString();
  const seen = new Set();
  recipients.forEach((forUserId) => {
    if (!forUserId || seen.has(forUserId)) return;
    seen.add(forUserId);
    items.unshift({
      id: generateId('NOT', items),
      type: 'info',
      title,
      message,
      relatedId: relatedId || '',
      forUserId,
      read: false,
      createdAt: now,
      actionUrl: '/provisionamiento-vacaciones',
    });
  });
  writeData(NOTIF_FILE, items);
}

// IDs de usuarios de RRHH + administradores (para notificar aprobaciones).
function hrAndAdminUserIds() {
  const users = readData('users.json') || [];
  return users
    .filter((u) => {
      const dept = (u.department || '').toLowerCase();
      return u.isAdmin || dept.includes('recursos humanos') || dept.includes('rrhh');
    })
    .map((u) => u.id);
}

// ID de usuario por código de empleado (para notificar al solicitante).
function userIdByCode(codigo) {
  const users = readData('users.json') || [];
  const u = users.find((x) => String(x.employeeCode) === String(codigo));
  return u ? u.id : null;
}

const totalDays = (periods) =>
  (periods || []).reduce((a, p) => a + (Number(p.days) || 0), 0);

// ── Rutas ─────────────────────────────────────────────────────────────────
// Departamentos (con líder aprobador y conteos de solicitudes)
router.get('/departments', auth, (req, res) => {
  const store = loadStore();
  const employees = loadEmployees();
  const depts = buildDepartments(employees);
  const bySlug = new Map(depts.map((d) => [d.id, d]));
  // conteos por departamento
  const empByCode = new Map(employees.map((e) => [e.codigo, e]));
  store.requests.forEach((r) => {
    const emp = empByCode.get(String(r.codigo));
    const slug = slugify(emp ? emp.department : r.department);
    const d = bySlug.get(slug);
    if (!d) return;
    d.pendingCount = (d.pendingCount || 0) + (r.status === 'pendiente' ? 1 : 0);
    d.approvedCount = (d.approvedCount || 0) + (r.status === 'aprobada' ? 1 : 0);
  });
  res.json(depts);
});

router.get('/policy', auth, (req, res) => res.json(loadStore().policy));

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

// Roster de un departamento con derecho, solicitudes y estado.
router.get('/roster/:deptId', auth, async (req, res) => {
  const store = loadStore();
  const policy = store.policy;
  const employees = loadEmployees();
  const depts = buildDepartments(employees);
  const dept = depts.find((d) => d.id === req.params.deptId);
  if (!dept) return res.json({ department: req.params.deptId, available: false, employees: [] });

  const sqlDates = await sqlHireDates();

  const emps = employees.filter((e) => slugify(e.department) === dept.id).map((e) => {
    const hireDate = sqlDates.get(e.codigo) || e.hireDate;
    const years = yearsBetween(hireDate);
    const dias = entitledDays(years, policy);
    const requests = store.requests.filter((r) => String(r.codigo) === e.codigo);
    const diasAprobados = totalDays(requests.filter((r) => r.status === 'aprobada').flatMap((r) => r.periods));
    const diasPendientes = totalDays(requests.filter((r) => r.status === 'pendiente').flatMap((r) => r.periods));
    return {
      codigo: e.codigo,
      nombre: e.nombre,
      position: e.position,
      cumpleanos: e.cumpleanos,
      isLeader: e.isLeader,
      fechaIngreso: hireDate || null,
      antiguedadAnios: years != null ? Math.floor(years) : null,
      diasDerecho: dias != null ? dias : policy.under5Days,
      diasEstimados: dias == null,
      diasAprobados,
      diasPendientes,
      requests,
    };
  });

  res.json({
    department: dept.id,
    name: dept.name,
    available: true,
    sqlConnected: sqlDates.size > 0,
    leaderCode: dept.leaderCode,
    leaderName: dept.leaderName,
    employees: emps,
  });
});

// Todas las solicitudes (con filtros opcionales ?status=&codigo=)
router.get('/requests', auth, (req, res) => {
  const store = loadStore();
  let out = store.requests;
  if (req.query.status) out = out.filter((r) => r.status === req.query.status);
  if (req.query.codigo) out = out.filter((r) => String(r.codigo) === String(req.query.codigo));
  res.json(out);
});

// Empleados actualmente (o en un rango) de vacaciones (solo aprobadas).
router.get('/on-vacation', auth, (req, res) => {
  const store = loadStore();
  const employees = loadEmployees();
  const empByCode = new Map(employees.map((e) => [e.codigo, e]));
  const from = req.query.from || new Date().toISOString().slice(0, 10);
  const to = req.query.to || from;

  const overlaps = (p) => p.start <= to && p.end >= from;
  const result = [];
  store.requests
    .filter((r) => r.status === 'aprobada')
    .forEach((r) => {
      const activos = (r.periods || []).filter(overlaps);
      if (!activos.length) return;
      const emp = empByCode.get(String(r.codigo));
      result.push({
        codigo: r.codigo,
        nombre: r.nombre,
        department: emp ? emp.department : r.department,
        periods: activos,
        requestId: r.id,
      });
    });
  res.json({ from, to, employees: result });
});

// Crear una solicitud de vacaciones (self-service o por líder/admin).
router.post('/requests', auth, (req, res) => {
  const store = loadStore();
  const { codigo, nombre, department, periods, notes, requestedByName } = req.body || {};
  if (!codigo || !Array.isArray(periods) || !periods.length) {
    return res.status(400).json({ message: 'Código y al menos un período son requeridos.' });
  }
  const now = new Date().toISOString();
  const request = {
    id: generateId('VAC', store.requests),
    codigo: String(codigo),
    nombre: nombre || '',
    department: department || '',
    periods,
    notes: notes || '',
    status: 'pendiente',
    requestedBy: req.user ? req.user.email : 'sistema',
    requestedByName: requestedByName || (req.user ? req.user.email : 'sistema'),
    requestedAt: now,
    history: [{ at: now, by: requestedByName || (req.user && req.user.email) || 'sistema', action: 'creada', detail: `Solicitud de ${totalDays(periods)} día(s)` }],
  };
  store.requests.unshift(request);
  writeData(FILE, store);

  // Notificar a RRHH/admins que hay una nueva solicitud pendiente
  pushNotifications(hrAndAdminUserIds(), {
    title: 'Nueva solicitud de vacaciones',
    message: `${request.nombre || codigo} solicitó ${totalDays(periods)} día(s) de vacaciones. Pendiente de aprobación.`,
    relatedId: request.id,
  });
  res.json(request);
});

// Editar los períodos de una solicitud (se registran los cambios).
router.put('/requests/:id', auth, (req, res) => {
  const store = loadStore();
  const idx = store.requests.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Solicitud no encontrada.' });
  const r = store.requests[idx];
  const { periods, notes, actorName } = req.body || {};
  const now = new Date().toISOString();
  const changes = [];

  if (Array.isArray(periods)) {
    const before = (r.periods || []).map((p) => `${p.start}→${p.end}`);
    const after = periods.map((p) => `${p.start}→${p.end}`);
    const removed = before.filter((x) => !after.includes(x));
    const added = after.filter((x) => !before.includes(x));
    removed.forEach((x) => changes.push(`Se eliminó ${x}`));
    added.forEach((x) => changes.push(`Se agregó ${x}`));
    r.periods = periods;
    // Un cambio en días previamente aprobados vuelve la solicitud a pendiente.
    if ((removed.length || added.length) && r.status === 'aprobada') r.status = 'pendiente';
  }
  if (typeof notes === 'string') r.notes = notes;
  if (changes.length) {
    r.history = r.history || [];
    r.history.push({ at: now, by: actorName || (req.user && req.user.email) || 'sistema', action: 'modificada', detail: changes.join('; ') });
  }
  r.updatedAt = now;
  store.requests[idx] = r;
  writeData(FILE, store);

  // Notificar cambios (a RRHH/admins y al solicitante)
  if (changes.length) {
    const recipients = [...hrAndAdminUserIds(), userIdByCode(r.codigo)];
    pushNotifications(recipients, {
      title: 'Cambio en vacaciones',
      message: `Vacaciones de ${r.nombre || r.codigo}: ${changes.join('; ')}.`,
      relatedId: r.id,
    });
  }
  res.json(r);
});

// Aprobar / rechazar una solicitud.
router.post('/requests/:id/decision', auth, (req, res) => {
  const store = loadStore();
  const idx = store.requests.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Solicitud no encontrada.' });
  const r = store.requests[idx];
  const { decision, approverName, decisionNotes } = req.body || {};
  if (!['aprobada', 'rechazada'].includes(decision)) {
    return res.status(400).json({ message: 'Decisión inválida.' });
  }
  const now = new Date().toISOString();
  r.status = decision;
  r.approverName = approverName || (req.user ? req.user.email : 'sistema');
  r.decidedAt = now;
  r.decisionNotes = decisionNotes || '';
  r.history = r.history || [];
  r.history.push({ at: now, by: r.approverName, action: decision, detail: decisionNotes || '' });
  store.requests[idx] = r;
  writeData(FILE, store);

  if (decision === 'aprobada') {
    // Notificar a TODO el equipo de RRHH (y al solicitante)
    const recipients = [...hrAndAdminUserIds(), userIdByCode(r.codigo)];
    pushNotifications(recipients, {
      title: 'Vacaciones aprobadas',
      message: `${r.approverName} aprobó ${totalDays(r.periods)} día(s) de vacaciones de ${r.nombre || r.codigo}.`,
      relatedId: r.id,
    });
  } else {
    const su = userIdByCode(r.codigo);
    if (su) pushNotifications([su], {
      title: 'Vacaciones rechazadas',
      message: `Tu solicitud de vacaciones fue rechazada. ${decisionNotes || ''}`.trim(),
      relatedId: r.id,
    });
  }
  res.json(r);
});

// Eliminar una solicitud.
router.delete('/requests/:id', auth, (req, res) => {
  const store = loadStore();
  const before = store.requests.length;
  store.requests = store.requests.filter((r) => r.id !== req.params.id);
  if (store.requests.length === before) return res.status(404).json({ message: 'Solicitud no encontrada.' });
  writeData(FILE, store);
  res.json({ success: true });
});

module.exports = router;
