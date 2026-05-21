/**
 * Photo Sync — bulk-load employee/agent photos from a local folder.
 * 
 * Default folder: C:\intranet-nueva\FOTOS  (override via env PHOTOS_DIR)
 * Filenames are matched (normalized, accent-insensitive) against:
 *   - employees.json     → field `photo`
 *   - armed-personnel.json → field `photo` (and as first agentPhotos[] record)
 *   - users.json         → field `photoUrl` (if email/fullName matches)
 *
 * Files are NOT copied — they're served via the static mount /photos/<filename>.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

const PHOTOS_DIR = process.env.PHOTOS_DIR || 'C:\\intranet-nueva\\FOTOS';
const PUBLIC_BASE = '/photos';

function normalize(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[;,()\[\]]/g, ' ')
    .replace(/\b(copy|activo|2)\b/g, ' ')
    .replace(/[._\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanBaseName(filename) {
  const base = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  // Drop ";Activo", "(2)", " - Copy" annotations
  return base.replace(/\s*-\s*copy\s*$/i, '')
             .replace(/\s*\(\d+\)\s*$/i, '')
             .replace(/;.*$/i, '')
             .trim();
}

function listPhotos() {
  if (!fs.existsSync(PHOTOS_DIR)) return [];
  return fs.readdirSync(PHOTOS_DIR)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .map(f => {
      const cleaned = cleanBaseName(f);
      return {
        file: f,
        url: `${PUBLIC_BASE}/${encodeURIComponent(f)}`,
        normalized: normalize(cleaned),
        cleanedName: cleaned,
      };
    });
}

function tokenSetScore(a, b) {
  const A = new Set(a.split(' ').filter(Boolean));
  const B = new Set(b.split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let common = 0;
  A.forEach(t => { if (B.has(t)) common++; });
  return common / Math.max(A.size, B.size);
}

function bestMatch(targetNorm, photos) {
  if (!targetNorm) return null;
  let best = null;
  for (const p of photos) {
    if (p.normalized === targetNorm) return { ...p, score: 1, exact: true };
    const score = tokenSetScore(targetNorm, p.normalized);
    if (score >= 0.75 && (!best || score > best.score)) best = { ...p, score, exact: false };
  }
  return best;
}

// GET /api/photo-sync/scan — returns matches for employees + armed personnel
router.get('/scan', auth, (req, res) => {
  const photos = listPhotos();
  const employees = readData('employees.json') || [];
  const armed = readData('armed-personnel.json') || [];
  const users = readData('users.json') || [];

  const employeeMatches = employees
    .filter(e => e.status !== 'Inactivo')
    .map(e => {
      const m = bestMatch(normalize(e.fullName), photos);
      return {
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        department: e.department,
        currentPhoto: e.photo || null,
        match: m,
      };
    });

  const armedMatches = armed.map(a => {
    const m = bestMatch(normalize(a.fullName), photos);
    return {
      id: a.id,
      employeeCode: a.employeeCode,
      fullName: a.fullName,
      currentPhoto: a.photo || null,
      hasGallery: Array.isArray(a.agentPhotos) && a.agentPhotos.length > 0,
      match: m,
    };
  });

  const userMatches = users.map(u => {
    const m = bestMatch(normalize(u.fullName), photos);
    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      currentPhoto: u.photoUrl || null,
      match: m,
    };
  });

  // Files not matched to anyone
  const matchedFiles = new Set();
  [employeeMatches, armedMatches, userMatches].forEach(list =>
    list.forEach(x => { if (x.match) matchedFiles.add(x.match.file); })
  );
  const unmatchedFiles = photos.filter(p => !matchedFiles.has(p.file));

  res.json({
    photosDir: PHOTOS_DIR,
    photosCount: photos.length,
    publicBase: PUBLIC_BASE,
    employees: employeeMatches,
    armed: armedMatches,
    users: userMatches,
    unmatchedFiles,
    counts: {
      employees: { total: employeeMatches.length, matched: employeeMatches.filter(x => x.match).length },
      armed: { total: armedMatches.length, matched: armedMatches.filter(x => x.match).length },
      users: { total: userMatches.length, matched: userMatches.filter(x => x.match).length },
    },
  });
});

// POST /api/photo-sync/apply
// Body: { employees: [{employeeCode, url}], armed: [{id, url, fullName}], users: [{id, url}], overwrite: bool, uploadedBy: string }
router.post('/apply', auth, (req, res) => {
  const { employees: empList = [], armed: armedList = [], users: userList = [], overwrite = false, uploadedBy = req.user?.fullName || 'Sistema' } = req.body || {};

  let empUpdated = 0, armedUpdated = 0, usersUpdated = 0;
  const nowIso = new Date().toISOString();

  if (empList.length) {
    const employees = readData('employees.json') || [];
    empList.forEach(({ employeeCode, url }) => {
      const idx = employees.findIndex(e => String(e.employeeCode) === String(employeeCode));
      if (idx === -1) return;
      if (!overwrite && employees[idx].photo) return;
      employees[idx] = { ...employees[idx], photo: url, photoUpdatedAt: nowIso, photoUpdatedBy: uploadedBy };
      empUpdated++;
    });
    writeData('employees.json', employees);
  }

  if (armedList.length) {
    const armed = readData('armed-personnel.json') || [];
    armedList.forEach(({ id, url, fullName }) => {
      const idx = armed.findIndex(a => a.id === id);
      if (idx === -1) return;
      const cur = armed[idx];
      if (!overwrite && cur.photo) return;
      const gallery = Array.isArray(cur.agentPhotos) ? [...cur.agentPhotos] : [];
      // Avoid duplicating same URL
      if (!gallery.some(p => p.url === url)) {
        gallery.unshift({
          id: `PH-${Date.now()}-${idx}`,
          url,
          uploadedAt: nowIso,
          uploadedBy,
          kind: 'agent',
          metadata: { notes: `Importado desde carpeta de fotos (${fullName || cur.fullName})` },
        });
      }
      armed[idx] = { ...cur, photo: url, agentPhotos: gallery, updatedAt: nowIso };
      armedUpdated++;
    });
    writeData('armed-personnel.json', armed);
  }

  if (userList.length) {
    const users = readData('users.json') || [];
    userList.forEach(({ id, url }) => {
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) return;
      if (!overwrite && users[idx].photoUrl) return;
      users[idx] = { ...users[idx], photoUrl: url };
      usersUpdated++;
    });
    writeData('users.json', users);
  }

  res.json({ ok: true, empUpdated, armedUpdated, usersUpdated });
});

module.exports = router;
module.exports.PHOTOS_DIR = PHOTOS_DIR;
module.exports.PUBLIC_BASE = PUBLIC_BASE;
