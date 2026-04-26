/**
 * File-based storage engine for SafeOne Intranet
 * Stores all data as JSON files in department folders on C:\
 * 
 * Structure:
 *   C:\intranet-nueva\data\
 *     users.json
 *     tickets.json
 *     equipment.json
 *     vehicles.json
 *     phones.json
 *     armed-personnel.json
 *     notifications.json
 *     purchase-requests.json
 *     hiring-requests.json
 *     minor-purchases.json
 *     uploads\           (uploaded files)
 *       tickets\
 *       departments\
 *         Accounting\
 *         Operations\
 *         ...
 */

const fs = require('fs');
const path = require('path');

// Base data directory — same drive as the project
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Department folder mapping (C:\ folders → department names)
const DEPARTMENT_FOLDERS = {
  'Gerencia': 'Management',
  'Gerencia General': 'Management',
  'Gerencia Comercial': 'Management',
  'Comercial': 'Management',
  'Administración': 'Management',
  'Contabilidad': 'Accounting',
  'Cuentas por Cobrar': 'Accounting',
  'Recursos Humanos': 'Human_Resources',
  'RRHH': 'Human_Resources',
  'Operaciones': 'Operations',
  'Servicio al Cliente': 'Customer Service',
  'Calidad': 'Quality Assurance',
  'Tecnología': 'IT',
  'Tecnología y Monitoreo': 'IT',
  'Monitoreo': 'IT',
  'Seguridad Electrónica': 'Security Systems',
  'Recepción': 'Management',
  'Cocina': 'Management',
};

// Ensure directories exist
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  // Create upload subdirs
  const subdirs = ['tickets', 'departments'];
  subdirs.forEach(d => {
    const dir = path.join(UPLOADS_DIR, d);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Create department upload folders
  const deptFolders = [...new Set(Object.values(DEPARTMENT_FOLDERS))];
  deptFolders.forEach(folder => {
    const dir = path.join(UPLOADS_DIR, 'departments', folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

/**
 * Read a JSON data file. Returns [] if not found.
 */
function readData(filename) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    return [];
  }
}

/**
 * Write data to a JSON file (atomic write with temp file).
 */
function writeData(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  const tmpPath = filePath + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (err) {
    console.error(`Error writing ${filename}:`, err.message);
    // Clean up temp file
    try { fs.unlinkSync(tmpPath); } catch {}
    return false;
  }
}

/**
 * Generate a sequential ID for a collection.
 * Format: PREFIX-001, PREFIX-002, etc.
 */
function generateId(prefix, existingItems) {
  if (!existingItems || existingItems.length === 0) return `${prefix}-001`;
  const nums = existingItems
    .map(item => {
      const match = item.id?.match(/\d+$/);
      return match ? parseInt(match[0], 10) : 0;
    })
    .filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

/**
 * Get the upload path for a department.
 */
function getDepartmentUploadPath(department) {
  const folder = DEPARTMENT_FOLDERS[department] || 'General';
  return path.join(UPLOADS_DIR, 'departments', folder);
}

/**
 * Save an uploaded file (base64 or buffer).
 */
function saveFile(subDir, fileName, fileData) {
  const dir = path.join(UPLOADS_DIR, subDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  const filePath = path.join(dir, fileName);
  
  if (typeof fileData === 'string' && fileData.includes('base64,')) {
    // Base64 data URL
    const base64Data = fileData.split('base64,')[1];
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  } else if (Buffer.isBuffer(fileData)) {
    fs.writeFileSync(filePath, fileData);
  } else {
    fs.writeFileSync(filePath, fileData, 'utf8');
  }

  return filePath;
}

// Initialize on load
ensureDirs();

module.exports = {
  readData,
  writeData,
  generateId,
  getDepartmentUploadPath,
  saveFile,
  DATA_DIR,
  UPLOADS_DIR,
  DEPARTMENT_FOLDERS,
  ensureDirs,
};
