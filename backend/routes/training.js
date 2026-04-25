/**
 * Training (Capacitaciones BASC)
 *
 * State file: training.json
 * {
 *   courses: [...],          // catálogo de cursos (semilla embebida + custom)
 *   enrollments: [...],      // inscripciones por usuario y curso (progress, completedAt, score)
 *   certificates: [...],     // certificados emitidos
 *   pins: { [userId]: "1234" }  // PIN de 4 dígitos para acceso kiosko
 * }
 */
const express = require('express');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');
const { COURSES_SEED } = require('../helpers/coursesSeed');

const FILE = 'training.json';

function loadState() {
  const raw = readData(FILE);
  if (Array.isArray(raw) && raw.length === 0) {
    return { courses: COURSES_SEED, enrollments: [], certificates: [], pins: {} };
  }
  if (Array.isArray(raw)) {
    return { courses: COURSES_SEED, enrollments: [], certificates: [], pins: {} };
  }
  return {
    courses: Array.isArray(raw.courses) && raw.courses.length ? raw.courses : COURSES_SEED,
    enrollments: Array.isArray(raw.enrollments) ? raw.enrollments : [],
    certificates: Array.isArray(raw.certificates) ? raw.certificates : [],
    pins: raw.pins && typeof raw.pins === 'object' ? raw.pins : {},
  };
}

function saveState(state) { writeData(FILE, state); }

const router = express.Router();

// ─── Public: kiosk login by employee code + PIN ───
router.post('/kiosk-login', (req, res) => {
  const { employeeCode, pin } = req.body || {};
  if (!employeeCode || !pin) return res.status(400).json({ message: 'Código y PIN requeridos' });
  const users = readData('users.json');
  const u = users.find(x => (x.id || '').toLowerCase() === String(employeeCode).toLowerCase());
  if (!u) return res.status(404).json({ message: 'Empleado no encontrado' });
  const state = loadState();
  const stored = state.pins[u.id];
  if (!stored || String(stored) !== String(pin)) {
    return res.status(401).json({ message: 'PIN incorrecto' });
  }
  res.json({ user: { id: u.id, fullName: u.fullName, position: u.position, department: u.department } });
});

// All routes below require auth
router.use(auth);

// ─── Courses ───
router.get('/courses', (req, res) => res.json(loadState().courses));
router.get('/courses/:id', (req, res) => {
  const c = loadState().courses.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ message: 'No encontrado' });
  res.json(c);
});

// ─── Enrollments ───
router.get('/enrollments', (req, res) => {
  let list = loadState().enrollments;
  if (req.query.userId) list = list.filter(e => e.userId === req.query.userId);
  if (req.query.courseId) list = list.filter(e => e.courseId === req.query.courseId);
  res.json(list);
});

/**
 * Save / upsert enrollment progress (per user + course)
 * body: { userId, courseId, currentSection, sectionsRead: number[], status }
 */
router.post('/enrollments', (req, res) => {
  const { userId, courseId, currentSection = 0, sectionsRead = [], status = 'en-progreso' } = req.body || {};
  if (!userId || !courseId) return res.status(400).json({ message: 'userId y courseId requeridos' });
  const state = loadState();
  let e = state.enrollments.find(x => x.userId === userId && x.courseId === courseId);
  const now = new Date().toISOString();
  if (!e) {
    e = {
      id: `ENR-${Date.now()}`,
      userId, courseId,
      startedAt: now,
      currentSection,
      sectionsRead,
      status,
      attempts: [],
      updatedAt: now,
    };
    state.enrollments.push(e);
  } else {
    e.currentSection = currentSection;
    e.sectionsRead = Array.from(new Set([...(e.sectionsRead || []), ...sectionsRead]));
    // No degradar el estado: si ya está 'completado', se mantiene aunque
    // el usuario vuelva a entrar a repasar el material.
    if (e.status !== 'completado') {
      e.status = status;
    }
    e.updatedAt = now;
  }
  saveState(state);
  res.json(e);
});

/**
 * Submit attempt (quiz or confirmation)
 * body: { userId, courseId, mode: 'quiz' | 'confirm', answers?, score?, passed }
 * If passed=true, generates certificate.
 */
router.post('/attempts', (req, res) => {
  const { userId, courseId, mode, answers = [], score = null, passed,
          fullName, position, department } = req.body || {};
  if (!userId || !courseId || typeof passed !== 'boolean') {
    return res.status(400).json({ message: 'userId, courseId y passed requeridos' });
  }
  const state = loadState();
  const course = state.courses.find(c => c.id === courseId);
  if (!course) return res.status(404).json({ message: 'Curso no encontrado' });

  let e = state.enrollments.find(x => x.userId === userId && x.courseId === courseId);
  const now = new Date().toISOString();
  if (!e) {
    e = { id: `ENR-${Date.now()}`, userId, courseId, startedAt: now,
          currentSection: 0, sectionsRead: [], status: 'en-progreso', attempts: [], updatedAt: now };
    state.enrollments.push(e);
  }
  const attempt = { id: `ATT-${Date.now()}`, mode, answers, score, passed, takenAt: now };
  e.attempts = [...(e.attempts || []), attempt];
  e.updatedAt = now;
  if (passed) {
    e.status = 'completado';
    e.completedAt = now;
    e.score = score;
  }

  let certificate = null;
  if (passed) {
    // 1 certificado activo por curso/usuario (re-emitir si ya existía)
    state.certificates = state.certificates.filter(c => !(c.userId === userId && c.courseId === courseId));
    const seq = state.certificates.length + 1;
    const year = new Date().getFullYear();
    certificate = {
      id: `CERT-${year}-${String(seq).padStart(5, '0')}`,
      userId,
      fullName: fullName || '',
      position: position || '',
      department: department || '',
      courseId,
      courseName: course.title,
      courseCode: course.code,
      score,
      issuedAt: now,
      verificationCode: `SSC-${year}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    };
    state.certificates.push(certificate);
  }
  saveState(state);
  res.status(201).json({ enrollment: e, attempt, certificate });
});

// ─── Certificates ───
router.get('/certificates', (req, res) => {
  let list = loadState().certificates;
  if (req.query.userId) list = list.filter(c => c.userId === req.query.userId);
  res.json(list);
});

router.get('/certificates/:id', (req, res) => {
  const c = loadState().certificates.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ message: 'No encontrado' });
  res.json(c);
});

// ─── PIN management (RRHH/Admin) ───
router.get('/pins', (req, res) => {
  // Returns map { userId: pin } – only for admins
  if (!req.user?.isAdmin && req.user?.department !== 'Recursos Humanos') {
    return res.status(403).json({ message: 'No autorizado' });
  }
  res.json(loadState().pins);
});

router.put('/pins/:userId', (req, res) => {
  if (!req.user?.isAdmin && req.user?.department !== 'Recursos Humanos') {
    return res.status(403).json({ message: 'No autorizado' });
  }
  const { pin } = req.body || {};
  if (!/^\d{4}$/.test(String(pin || ''))) {
    return res.status(400).json({ message: 'PIN debe ser 4 dígitos' });
  }
  const state = loadState();
  state.pins[req.params.userId] = String(pin);
  saveState(state);
  res.json({ userId: req.params.userId, pin });
});

module.exports = router;
