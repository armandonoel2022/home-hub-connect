/**
 * Expediente Overlay — capa editable LOCAL sobre los datos de GENERAL (solo lectura).
 *
 * GENERAL (gSafeOne / SQL Server) es de SOLO LECTURA, por eso toda edición del
 * expediente (estatus de arma, nota, No. de licencia, fotos del arma y de la
 * licencia) y los movimientos FROM→TO de armas y personal se guardan aquí, en
 * archivos JSON locales en el servidor (C:), enlazados por la SERIE del arma.
 *
 * Solo editores autorizados (Samuel, Aurelio Pérez, Armando Noel y super admin)
 * pueden escribir. La lectura está disponible para los mismos roles que ven el
 * módulo (Operaciones / Gerencia / Tecnología / RRHH / admin).
 */
const express = require('express');
const auth = require('../middleware/auth');
const { readData, writeData, saveFile } = require('../config/database');

const router = express.Router();

const OVERLAY_FILE = 'expediente-overlay.json';   // { [serie]: {...campos} }
const MOVES_FILE = 'expediente-movements.json';   // [ {id, tipo, serie/empleado, desde, hacia, ...} ]
const HIDDEN_FILE = 'expediente-hidden.json';     // { keys: [ "claveLinea", ... ] }

// Correos con permiso de edición (alineado con src/lib/permissions.ts).
const EDITOR_EMAILS = [
  'tecnologia@safeone.com.do',  // super admin
  'anoel@safeone.com.do',       // Armando Noel
  'aperez@safeone.com.do',      // Aurelio Pérez
  'sperez@safeone.com.do',      // Samuel Pérez
  'samuel@safeone.com.do',
  'aurelio@safeone.com.do',
];

function canRead(user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const dept = String(user.department || '').toLowerCase();
  return /operac|recursos humanos|rrhh|tecnolog|gerencia/.test(dept);
}

function isEditor(user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const email = String(user.email || '').toLowerCase().trim();
  return EDITOR_EMAILS.includes(email);
}

function readGuard(req, res, next) {
  if (!canRead(req.user)) return res.status(403).json({ message: 'No autorizado' });
  next();
}

function editGuard(req, res, next) {
  if (!isEditor(req.user)) return res.status(403).json({ message: 'Solo editores autorizados pueden modificar el expediente' });
  next();
}

const jsonLarge = express.json({ limit: '12mb' });

function readOverlay() {
  const data = readData(OVERLAY_FILE);
  // readData devuelve [] cuando el archivo no existe; normalizamos a objeto.
  return Array.isArray(data) ? {} : (data || {});
}

const safeSerie = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '_');

// ─── ¿Puede el usuario editar? (para que el front muestre/oculte controles) ───
router.get('/can-edit', auth, (req, res) => {
  res.json({ canEdit: isEditor(req.user) });
});

// ─── Listado completo de overlays ───
router.get('/', auth, readGuard, (req, res) => {
  res.json(readOverlay());
});

// ─── Overlay de una serie ───
router.get('/:serie', auth, readGuard, (req, res) => {
  const overlay = readOverlay();
  res.json(overlay[req.params.serie] || {});
});

// ─── Guardar/editar campos de una serie ───
router.put('/:serie', auth, editGuard, jsonLarge, (req, res) => {
  const serie = req.params.serie;
  if (!serie) return res.status(400).json({ message: 'serie requerida' });
  const overlay = readOverlay();
  const prev = overlay[serie] || {};
  const allowed = ['estatus', 'nota', 'noLicencia', 'custodioOverride', 'puestoOverride', 'clienteOverride'];
  const patch = {};
  for (const k of allowed) {
    if (k in (req.body || {})) patch[k] = req.body[k];
  }
  overlay[serie] = {
    ...prev,
    ...patch,
    fotosArma: prev.fotosArma || [],
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.email || req.user?.fullName || 'desconocido',
  };
  writeData(OVERLAY_FILE, overlay);
  res.json(overlay[serie]);
});

// ─── Subir foto (arma o licencia) ───
// body: { dataUrl, fileName, kind: 'arma' | 'licenciaFrente' | 'licenciaDorso' }
router.post('/:serie/photo', auth, editGuard, jsonLarge, (req, res) => {
  const serie = req.params.serie;
  const { dataUrl, fileName, kind = 'arma' } = req.body || {};
  if (!serie || !dataUrl || !fileName) return res.status(400).json({ message: 'serie, dataUrl y fileName requeridos' });

  const subDir = `operaciones/armas/${safeSerie(serie)}`;
  const ext = (String(fileName).split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const stamp = Date.now();
  const safeName = `${kind}-${stamp}.${ext}`;
  try {
    saveFile(subDir, safeName, dataUrl);
  } catch (e) {
    return res.status(500).json({ message: 'No se pudo guardar la imagen: ' + e.message });
  }
  const url = `/uploads/${subDir}/${safeName}`;

  const overlay = readOverlay();
  const prev = overlay[serie] || {};
  if (kind === 'licenciaFrente') prev.fotoLicenciaFrente = url;
  else if (kind === 'licenciaDorso') prev.fotoLicenciaDorso = url;
  else prev.fotosArma = [...(prev.fotosArma || []), url];
  prev.updatedAt = new Date().toISOString();
  prev.updatedBy = req.user?.email || 'desconocido';
  overlay[serie] = prev;
  writeData(OVERLAY_FILE, overlay);
  res.json({ url, overlay: prev });
});

// ─── Eliminar una foto del arma ───
router.delete('/:serie/photo', auth, editGuard, jsonLarge, (req, res) => {
  const serie = req.params.serie;
  const { url, kind } = req.body || {};
  const overlay = readOverlay();
  const prev = overlay[serie];
  if (!prev) return res.status(404).json({ message: 'Overlay no encontrado' });
  if (kind === 'licenciaFrente') prev.fotoLicenciaFrente = null;
  else if (kind === 'licenciaDorso') prev.fotoLicenciaDorso = null;
  else prev.fotosArma = (prev.fotosArma || []).filter((u) => u !== url);
  prev.updatedAt = new Date().toISOString();
  prev.updatedBy = req.user?.email || 'desconocido';
  overlay[serie] = prev;
  writeData(OVERLAY_FILE, overlay);
  res.json(prev);
});

// ─── Movimientos FROM→TO (armas y personal) ───
router.get('/movements/all', auth, readGuard, (req, res) => {
  let items = readData(MOVES_FILE);
  if (!Array.isArray(items)) items = [];
  const { serie, empleado, tipo } = req.query;
  if (serie) items = items.filter((m) => m.serie === serie);
  if (empleado) items = items.filter((m) => String(m.empleado) === String(empleado));
  if (tipo) items = items.filter((m) => m.tipo === tipo);
  items.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  res.json(items);
});

router.post('/movements', auth, editGuard, jsonLarge, (req, res) => {
  let items = readData(MOVES_FILE);
  if (!Array.isArray(items)) items = [];
  const b = req.body || {};
  if (!b.tipo || (!b.serie && !b.empleado)) {
    return res.status(400).json({ message: 'tipo y (serie o empleado) requeridos' });
  }
  const mov = {
    id: `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tipo: b.tipo,                 // 'arma' | 'personal'
    serie: b.serie || null,
    armaModelo: b.armaModelo || null,
    empleado: b.empleado || null,
    empleadoNombre: b.empleadoNombre || null,
    desde: b.desde || null,       // FROM (puesto/almacén/custodio)
    hacia: b.hacia || null,       // TO
    motivo: b.motivo || '',
    fecha: b.fecha || new Date().toISOString(),
    registradoPor: req.user?.email || req.user?.fullName || 'desconocido',
    createdAt: new Date().toISOString(),
  };
  items.push(mov);
  writeData(MOVES_FILE, items);
  res.status(201).json(mov);
});

module.exports = router;
