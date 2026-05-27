/**
 * Folder ACL — gestiona quién puede ver/editar las carpetas departamentales.
 * Sólo el superusuario (tecnologia@safeone.com.do) puede modificar la ACL.
 * Estructura folder-acl.json:
 *   { "Administración": { "viewers": ["USR-1"], "editors": ["USR-1"] }, ... }
 */
const express = require('express');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();
const FILE = 'folder-acl.json';
const SUPER_EMAIL = 'tecnologia@safeone.com.do';

function isSuper(reqUser) {
  return reqUser && (reqUser.email || '').toLowerCase() === SUPER_EMAIL;
}

function loadAcl() {
  const raw = readData(FILE);
  // readData devuelve [] por defecto cuando no existe; tratamos como objeto.
  if (Array.isArray(raw)) return {};
  return raw || {};
}

// GET /api/folder-acl — lee toda la ACL (cualquier usuario autenticado para que el front sepa permisos)
router.get('/', auth, (req, res) => {
  res.json(loadAcl());
});

// PUT /api/folder-acl/:department — actualiza viewers/editors de un dpto (sólo super)
router.put('/:department', auth, (req, res) => {
  if (!isSuper(req.user)) {
    return res.status(403).json({ message: 'Sólo el superusuario puede modificar la ACL.' });
  }
  const department = decodeURIComponent(req.params.department);
  const { viewers = [], editors = [] } = req.body || {};
  const acl = loadAcl();
  acl[department] = {
    viewers: Array.from(new Set(viewers.filter(Boolean))),
    editors: Array.from(new Set(editors.filter(Boolean))),
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.id,
  };
  writeData(FILE, acl);
  res.json(acl[department]);
});

// DELETE /api/folder-acl/:department — quita la ACL (vuelve a fallback departamental)
router.delete('/:department', auth, (req, res) => {
  if (!isSuper(req.user)) return res.status(403).json({ message: 'No autorizado' });
  const department = decodeURIComponent(req.params.department);
  const acl = loadAcl();
  delete acl[department];
  writeData(FILE, acl);
  res.status(204).send();
});

// Helpers exportados para que department-folders los use
function canViewFolder(reqUser, department) {
  if (!reqUser) return false;
  if (isSuper(reqUser)) return true;
  const users = readData('users.json');
  const u = users.find(x => x.id === reqUser.id);
  if (!u) return false;
  if (u.isAdmin) return true;
  const acl = loadAcl();
  const entry = acl[department];
  if (entry) {
    return (entry.viewers || []).includes(u.id) || (entry.editors || []).includes(u.id);
  }
  // Fallback: miembros del departamento
  return u.department === department;
}

function canEditFolder(reqUser, department) {
  if (!reqUser) return false;
  if (isSuper(reqUser)) return true;
  const users = readData('users.json');
  const u = users.find(x => x.id === reqUser.id);
  if (!u) return false;
  if (u.isAdmin) return true;
  const acl = loadAcl();
  const entry = acl[department];
  if (entry) return (entry.editors || []).includes(u.id);
  return u.department === department;
}

module.exports = router;
module.exports.canViewFolder = canViewFolder;
module.exports.canEditFolder = canEditFolder;
module.exports.isSuper = isSuper;
