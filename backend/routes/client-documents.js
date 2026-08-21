/**
 * Documentación digital por cliente (Servicio al Cliente / Expediente).
 *
 * Los archivos se guardan físicamente en:
 *   <DATA_DIR>/uploads/clientes/<clienteId>/<archivo>
 * y se sirven de forma estática en /uploads/clientes/...
 *
 * El índice se guarda en client-documents.json:
 *   { "1001": [ { id, docKey, fileName, storedName, url, mime, size,
 *                 uploadedAt, uploadedBy, activo, nota } ] }
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { readData, writeData, generateId, UPLOADS_DIR } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();
const FILE = 'client-documents.json';
const BASE_DIR = path.join(UPLOADS_DIR, 'clientes');

const ALLOWED_EXT = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf', 'odt', 'ods',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic',
  'ppt', 'pptx', 'zip', 'rar', '7z',
];
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function load() {
  const d = readData(FILE);
  if (!d || Array.isArray(d)) return {};
  return d;
}

function canEdit(user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const dep = String(user.department || '').toLowerCase();
  return /servicio al cliente|comercial|administrac|gerencia|tecnolog|cuentas por cobrar/.test(dep);
}

function audit(user, action, clienteId, details) {
  try {
    const logs = readData('audit-log.json');
    logs.push({
      id: generateId('AUD', logs),
      userId: user?.id || 'system',
      userName: user?.fullName || user?.name || 'Sistema',
      action,
      module: 'documentos-cliente',
      targetId: String(clienteId),
      targetName: `Cliente ${clienteId}`,
      details,
      timestamp: new Date().toISOString(),
    });
    writeData('audit-log.json', logs);
  } catch (e) { console.error('audit documentos-cliente:', e.message); }
}

function safeName(name) {
  return String(name || 'archivo')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function safeId(id) {
  return String(id || '').replace(/[^A-Za-z0-9_-]/g, '');
}

router.use(auth);

// Índice completo (todos los clientes)
router.get('/', (req, res) => res.json(load()));

// Documentos de un cliente
router.get('/:clienteId', (req, res) => {
  const store = load();
  res.json(store[String(req.params.clienteId)] || []);
});

// Subir un archivo (base64 dataURL)
router.post('/:clienteId', (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ message: 'Sin permisos para cargar documentos.' });

  const clienteId = safeId(req.params.clienteId);
  if (!clienteId) return res.status(400).json({ message: 'ClienteID inválido.' });

  const { docKey, docNombre, fileName, dataUrl, nota } = req.body || {};
  if (!fileName || !dataUrl) return res.status(400).json({ message: 'Archivo incompleto.' });

  const clean = safeName(fileName);
  const ext = (clean.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return res.status(400).json({ message: `Formato .${ext} no permitido.` });
  }

  const base64 = String(dataUrl).includes('base64,') ? String(dataUrl).split('base64,')[1] : String(dataUrl);
  let buffer;
  try { buffer = Buffer.from(base64, 'base64'); } catch { return res.status(400).json({ message: 'Archivo corrupto.' }); }
  if (!buffer.length) return res.status(400).json({ message: 'Archivo vacío.' });
  if (buffer.length > MAX_BYTES) return res.status(400).json({ message: 'El archivo supera los 25 MB.' });

  const dir = path.join(BASE_DIR, clienteId);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const storedName = `${Date.now()}-${clean}`;
    fs.writeFileSync(path.join(dir, storedName), buffer);

    const store = load();
    const list = store[clienteId] || [];
    const record = {
      id: `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      docKey: String(docKey || 'general'),
      docNombre: String(docNombre || docKey || 'General'),
      fileName: clean,
      storedName,
      url: `/uploads/clientes/${clienteId}/${encodeURIComponent(storedName)}`,
      mime: req.body?.mime || '',
      size: buffer.length,
      nota: String(nota || ''),
      activo: true,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user?.fullName || req.user?.name || null,
    };
    list.push(record);
    store[clienteId] = list;
    writeData(FILE, store);
    audit(req.user, 'upload', clienteId, `Documento "${clean}" (${record.docNombre})`);
    res.status(201).json(record);
  } catch (e) {
    console.error('upload documento cliente:', e.message);
    res.status(500).json({ message: 'No se pudo guardar el archivo en el servidor.' });
  }
});

// Eliminar (borrado lógico, requiere justificación)
router.delete('/:clienteId/:docId', (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ message: 'Sin permisos.' });
  const clienteId = safeId(req.params.clienteId);
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ message: 'Debe indicar la justificación de la eliminación.' });

  const store = load();
  const list = store[clienteId] || [];
  const idx = list.findIndex((d) => d.id === req.params.docId);
  if (idx === -1) return res.status(404).json({ message: 'Documento no encontrado.' });

  list[idx] = {
    ...list[idx],
    activo: false,
    eliminadoPor: req.user?.fullName || req.user?.name || null,
    eliminadoEn: new Date().toISOString(),
    motivoEliminacion: reason,
  };
  store[clienteId] = list;
  writeData(FILE, store);
  audit(req.user, 'delete', clienteId, `Documento "${list[idx].fileName}" eliminado. Justificación: ${reason}`);
  res.json(list[idx]);
});

module.exports = router;
