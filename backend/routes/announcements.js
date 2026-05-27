/**
 * Announcements (Comunicados) con overlay global y evento opcional en calendario.
 * Archivo: announcements.json
 * Si trae eventDate, se crea automáticamente una entrada en calendar-events.json.
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();
const FILE = 'announcements.json';
const CAL_FILE = 'calendar-events.json';

function visibleFor(a, userId, userDept, isAdmin) {
  if (isAdmin) return true;
  if (a.createdByUserId === userId) return true;
  if (a.audienceType === 'todos' || !a.audienceType) return true;
  if (a.audienceType === 'departamento' && a.audienceDept === userDept) return true;
  if (a.audienceType === 'personas' && Array.isArray(a.audienceUserIds) && a.audienceUserIds.includes(userId)) return true;
  return false;
}

// GET /api/announcements — todos los visibles para el usuario
router.get('/', auth, (req, res) => {
  const users = readData('users.json');
  const me = users.find(u => u.id === req.user.id);
  const list = readData(FILE);
  const filtered = list.filter(a => visibleFor(a, req.user.id, me?.department, !!req.user.isAdmin));
  res.json(filtered);
});

// GET /api/announcements/active — comunicados con showAsOverlay activo y no leídos por mí
router.get('/active', auth, (req, res) => {
  const users = readData('users.json');
  const me = users.find(u => u.id === req.user.id);
  const list = readData(FILE);
  const now = Date.now();
  const active = list.filter(a => {
    if (!a.showAsOverlay) return false;
    if (a.expiresAt && new Date(a.expiresAt).getTime() < now) return false;
    if ((a.readBy || []).includes(req.user.id)) return false;
    return visibleFor(a, req.user.id, me?.department, !!req.user.isAdmin);
  });
  res.json(active);
});

// POST /api/announcements
router.post('/', auth, (req, res) => {
  const list = readData(FILE);
  const now = new Date();
  const ann = {
    ...req.body,
    id: generateId('ANN', list),
    createdAt: now.toISOString(),
    date: now.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
    createdByUserId: req.user.id,
    readBy: [],
    showAsOverlay: req.body.showAsOverlay !== false, // default true
  };
  list.unshift(ann);
  writeData(FILE, list);

  // Si trae eventDate, crear evento en calendario
  if (ann.eventDate) {
    const cal = readData(CAL_FILE);
    const evt = {
      id: generateId('EVT', cal),
      title: ann.title,
      description: ann.excerpt || '',
      date: ann.eventDate,
      startTime: ann.eventStartTime || '09:00',
      endTime: ann.eventEndTime || '10:00',
      location: ann.eventLocation || '',
      createdBy: ann.createdBy || '',
      department: ann.audienceDept || '',
      type: 'evento',
      invitees: ann.audienceType === 'departamento' ? 'departamento' : 'todos',
      inviteeDepartment: ann.audienceDept,
      sourceAnnouncementId: ann.id,
    };
    cal.push(evt);
    writeData(CAL_FILE, cal);
  }

  res.status(201).json(ann);
});

// PUT /api/announcements/:id/read — marcar como leído
router.put('/:id/read', auth, (req, res) => {
  const list = readData(FILE);
  const ann = list.find(a => a.id === req.params.id);
  if (!ann) return res.status(404).json({ message: 'Comunicado no encontrado' });
  ann.readBy = ann.readBy || [];
  if (!ann.readBy.includes(req.user.id)) ann.readBy.push(req.user.id);
  writeData(FILE, list);
  res.json({ ok: true });
});

// DELETE /api/announcements/:id — sólo creador o admin
router.delete('/:id', auth, (req, res) => {
  const list = readData(FILE);
  const idx = list.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
  const ann = list[idx];
  if (!req.user.isAdmin && ann.createdByUserId !== req.user.id) {
    return res.status(403).json({ message: 'No autorizado' });
  }
  list.splice(idx, 1);
  writeData(FILE, list);
  res.status(204).send();
});

module.exports = router;
