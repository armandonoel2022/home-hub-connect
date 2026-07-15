/**
 * Encuestas (clima laboral) con soporte de enlace público y overlay recordatorio.
 * Archivo: surveys.json
 *
 * - Endpoints públicos (sin token): responder por enlace compartido.
 * - Endpoints autenticados: listar, crear, cerrar, ver resultados.
 *
 * El overlay del frontend consume /public/active para mostrar el recordatorio
 * hasta que el usuario acceda o complete la encuesta.
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();
const FILE = 'surveys.json';

// ─── Seed: Encuesta de Clima 2026 (2) ───
const SEED_ID = 'clima-2026';
const SI_NO_AV = ['Si', 'No', 'Aveces'];
const SI_NO = ['Si', 'No'];

const SEED_SURVEY = {
  id: SEED_ID,
  title: 'Encuesta de Clima 2026 (2)',
  description:
    'Con esta encuesta queremos conocer que piensas y como podemos mejorar, toda informacion sera manejada de manera confidencial por lo que te pedimos honestidad. Gracias!',
  createdBy: 'Recursos Humanos',
  createdAt: '2026-07-07',
  startDate: '2026-07-07',
  endDate: '2026-07-31',
  targetType: 'todos',
  status: 'activa',
  isPublic: true,
  showAsOverlay: true,
  reappearMinutes: 30,
  enforced: true,
  questions: [
    { id: 'q1', text: 'A que departamento perteneces', type: 'multiple', options: ['Gerencia Comercial', 'Recursos Humanos', 'Seguridad Electronica', 'Tecnologia y Monitoreo', 'Administracion y Finanzas', 'Operaciones Administrativo'] },
    { id: 'q2', text: 'Me siento comodo trabajando en mi equipo', type: 'multiple', options: SI_NO_AV },
    { id: 'q3', text: 'Me siento tratado (a) con equidad y respeto', type: 'multiple', options: SI_NO_AV },
    { id: 'q4', text: 'Mi supervisor comunica claramente las expectativas', type: 'multiple', options: SI_NO_AV },
    { id: 'q5', text: 'La comunicacion importante se comunica de manera oportuna', type: 'multiple', options: SI_NO_AV },
    { id: 'q6', text: 'La comunicacion entre areas es efectiva', type: 'multiple', options: SI_NO_AV },
    { id: 'q7', text: 'Tengo claridad sobre mis funciones y mi trabajo', type: 'multiple', options: SI_NO },
    { id: 'q8', text: 'Mi trabajo me permite mantener un buen equilibrio vida\u2013trabajo.', type: 'multiple', options: SI_NO_AV },
    { id: 'q9', text: 'Mi trabajo es reconocido, Me siento valorado/a por mi aporte.', type: 'multiple', options: SI_NO },
    { id: 'q10', text: 'Veo posibilidades de crecimiento dentro de la empresa.', type: 'multiple', options: SI_NO },
    { id: 'q11', text: 'Me siento identificado/a con la cultura de la empresa.', type: 'multiple', options: SI_NO },
    { id: 'q12', text: 'Recomendar\u00eda esta empresa como un buen lugar para trabajar.', type: 'multiple', options: SI_NO },
    { id: 'q13', text: '\u00bfQu\u00e9 es lo que m\u00e1s te gusta de trabajar aqu\u00ed?', type: 'text' },
    { id: 'q14', text: '\u00bfQu\u00e9 aspectos deber\u00edan mejorar?', type: 'text' },
    { id: 'q15', text: '\u00bfQu\u00e9 sugerencias tienes para mejorar el clima laboral?', type: 'text' },
    { id: 'q16', text: 'Desde la ultima encuesta a la fecha has notado cambios, ajustes en algun punto de los cuales hemos tocado?', type: 'multiple', options: SI_NO },
  ],
  responses: [],
  resultsVisibleTo: [],
  deleted: false,
};

function ensureSeed() {
  const list = readData(FILE);
  if (!Array.isArray(list) || list.length === 0) {
    writeData(FILE, [SEED_SURVEY]);
    return [SEED_SURVEY];
  }
  if (!list.find((s) => s.id === SEED_ID)) {
    list.unshift(SEED_SURVEY);
    writeData(FILE, list);
  }
  return list;
}

// Quita datos sensibles antes de exponer al público
function publicView(s) {
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    questions: s.questions,
    status: s.status,
    isPublic: s.isPublic,
    showAsOverlay: s.showAsOverlay,
    startDate: s.startDate,
    endDate: s.endDate,
  };
}

// ─── PÚBLICO: encuestas activas con overlay (para recordatorio) ───
router.get('/public/active', (req, res) => {
  const list = ensureSeed();
  const active = list
    .filter((s) => !s.deleted && s.status === 'activa' && s.isPublic && s.showAsOverlay)
    .map(publicView);
  res.json(active);
});

// ─── PÚBLICO: obtener una encuesta por id (para responder por enlace) ───
router.get('/public/:id', (req, res) => {
  const list = ensureSeed();
  const s = list.find((x) => x.id === req.params.id && !x.deleted && x.isPublic);
  if (!s) return res.status(404).json({ message: 'Encuesta no encontrada' });
  res.json(publicView(s));
});

// ─── PÚBLICO: enviar respuesta ───
router.post('/public/:id/respond', (req, res) => {
  const list = ensureSeed();
  const s = list.find((x) => x.id === req.params.id && !x.deleted && x.isPublic);
  if (!s) return res.status(404).json({ message: 'Encuesta no encontrada' });
  if (s.status !== 'activa') return res.status(400).json({ message: 'La encuesta está cerrada' });

  const { answers, userId, userName, department } = req.body || {};
  const response = {
    id: generateId('RSP', s.responses || []),
    surveyId: s.id,
    userId: userId || null,
    userName: userName || 'Anónimo',
    department: department || (answers ? answers.q1 : '') || '',
    answers: answers || {},
    submittedAt: new Date().toISOString(),
  };
  s.responses = s.responses || [];
  s.responses.push(response);
  writeData(FILE, list);
  res.status(201).json({ ok: true });
});

// ─── AUTENTICADO: listar todas ───
router.get('/', auth, (req, res) => {
  const list = ensureSeed();
  res.json(list.filter((s) => !s.deleted));
});

// ─── AUTENTICADO: crear ───
router.post('/', auth, (req, res) => {
  const list = ensureSeed();
  const now = new Date().toISOString();
  const survey = {
    id: generateId('SRV', list),
    responses: [],
    resultsVisibleTo: [],
    deleted: false,
    status: 'activa',
    isPublic: true,
    showAsOverlay: true,
    ...req.body,
    createdBy: req.body.createdBy || req.user.fullName || '',
    createdAt: now.slice(0, 10),
  };
  list.unshift(survey);
  writeData(FILE, list);
  res.status(201).json(survey);
});

// ─── AUTENTICADO: actualizar (cerrar, visibilidad, etc.) ───
router.put('/:id', auth, (req, res) => {
  const list = ensureSeed();
  const s = list.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ message: 'No encontrada' });
  Object.assign(s, req.body, { id: s.id, responses: s.responses });
  writeData(FILE, list);
  res.json(s);
});

// ─── AUTENTICADO: soft delete ───
router.delete('/:id', auth, (req, res) => {
  const list = ensureSeed();
  const s = list.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ message: 'No encontrada' });
  s.deleted = true;
  s.deletedBy = req.user.fullName;
  s.deletedAt = new Date().toISOString();
  s.deleteReason = (req.body && req.body.reason) || '';
  writeData(FILE, list);
  res.status(204).send();
});

module.exports = router;
