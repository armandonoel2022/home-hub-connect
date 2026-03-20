/**
 * Department Folders routes — manages folders and files per department
 * Only department members can access their department's folders
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();
const FILE = 'department-folders.json';

// Helper: check if user belongs to department
function isMemberOfDept(userId, department) {
  const users = readData('users.json');
  const user = users.find(u => u.id === userId);
  if (!user) return false;
  if (user.isAdmin) return true;
  return user.department === department;
}

// ── GET /api/department-folders/:department — get all folders for a department ──
router.get('/:department', auth, (req, res) => {
  const department = decodeURIComponent(req.params.department);
  
  if (!isMemberOfDept(req.user.id, department)) {
    return res.status(403).json({ message: 'No tienes acceso a las carpetas de este departamento' });
  }
  
  const allFolders = readData(FILE);
  const deptFolders = allFolders.filter(f => f.department === department);
  
  // If no folders exist, create default "General" folder
  if (deptFolders.length === 0) {
    const defaultFolder = {
      id: generateId('FLD', allFolders),
      department,
      name: 'General',
      files: [],
      createdAt: new Date().toISOString(),
      createdBy: req.user.id,
    };
    allFolders.push(defaultFolder);
    writeData(FILE, allFolders);
    return res.json([defaultFolder]);
  }
  
  res.json(deptFolders);
});

// ── POST /api/department-folders/:department — create a new subfolder ──
router.post('/:department', auth, (req, res) => {
  const department = decodeURIComponent(req.params.department);
  const { name } = req.body;
  
  if (!isMemberOfDept(req.user.id, department)) {
    return res.status(403).json({ message: 'No tienes acceso a este departamento' });
  }
  
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'El nombre de la carpeta es requerido' });
  }
  
  const allFolders = readData(FILE);
  
  // Check duplicate name in same department
  const exists = allFolders.find(f => f.department === department && f.name.toLowerCase() === name.trim().toLowerCase());
  if (exists) {
    return res.status(400).json({ message: 'Ya existe una carpeta con ese nombre' });
  }
  
  const newFolder = {
    id: generateId('FLD', allFolders),
    department,
    name: name.trim(),
    files: [],
    createdAt: new Date().toISOString(),
    createdBy: req.user.id,
  };
  allFolders.push(newFolder);
  writeData(FILE, allFolders);
  res.status(201).json(newFolder);
});

// ── DELETE /api/department-folders/:department/:folderId — delete a folder ──
router.delete('/:department/:folderId', auth, (req, res) => {
  const department = decodeURIComponent(req.params.department);
  const { folderId } = req.params;
  
  if (!isMemberOfDept(req.user.id, department)) {
    return res.status(403).json({ message: 'No tienes acceso a este departamento' });
  }
  
  const allFolders = readData(FILE);
  const idx = allFolders.findIndex(f => f.id === folderId && f.department === department);
  if (idx === -1) return res.status(404).json({ message: 'Carpeta no encontrada' });
  
  // Don't allow deleting the "General" folder
  if (allFolders[idx].name === 'General') {
    return res.status(400).json({ message: 'No se puede eliminar la carpeta General' });
  }
  
  allFolders.splice(idx, 1);
  writeData(FILE, allFolders);
  res.status(204).send();
});

// ── POST /api/department-folders/:department/:folderId/files — add file to folder ──
router.post('/:department/:folderId/files', auth, (req, res) => {
  const department = decodeURIComponent(req.params.department);
  const { folderId } = req.params;
  const { name, size, fileData } = req.body;
  
  if (!isMemberOfDept(req.user.id, department)) {
    return res.status(403).json({ message: 'No tienes acceso a este departamento' });
  }
  
  const allFolders = readData(FILE);
  const folder = allFolders.find(f => f.id === folderId && f.department === department);
  if (!folder) return res.status(404).json({ message: 'Carpeta no encontrada' });
  
  const newFile = {
    id: `FILE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: req.user.fullName || req.user.id,
    uploadedByUserId: req.user.id,
  };
  
  folder.files.push(newFile);
  writeData(FILE, allFolders);
  res.status(201).json(newFile);
});

// ── DELETE /api/department-folders/:department/:folderId/files/:fileId — delete file ──
router.delete('/:department/:folderId/files/:fileId', auth, (req, res) => {
  const department = decodeURIComponent(req.params.department);
  const { folderId, fileId } = req.params;
  
  if (!isMemberOfDept(req.user.id, department)) {
    return res.status(403).json({ message: 'No tienes acceso a este departamento' });
  }
  
  const allFolders = readData(FILE);
  const folder = allFolders.find(f => f.id === folderId && f.department === department);
  if (!folder) return res.status(404).json({ message: 'Carpeta no encontrada' });
  
  const fileIdx = folder.files.findIndex(f => f.id === fileId);
  if (fileIdx === -1) return res.status(404).json({ message: 'Archivo no encontrado' });
  
  folder.files.splice(fileIdx, 1);
  writeData(FILE, allFolders);
  res.status(204).send();
});

module.exports = router;
