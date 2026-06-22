/**
 * Feriados de República Dominicana — fuente externa con cache local.
 *
 * Consulta la API pública Nager.Date (sin API key) y cachea el resultado en
 * holidays-do.json para que siga funcionando sin internet. Admite ajustes
 * manuales (agregar/eliminar feriados que el calendario oficial no traiga),
 * gateados a admin/RRHH.
 *
 * Archivo: holidays-do.json
 *   {
 *     "2026": { fetchedAt, source: 'nager'|'cache', items: [{date,name,localName}] },
 *     "manual": [{ date: 'YYYY-MM-DD', name }],   // ajustes locales
 *     "removed": ["YYYY-MM-DD", ...]              // feriados oficiales eliminados
 *   }
 */
const express = require('express');
const auth = require('../middleware/auth');
const { readData, writeData } = require('../config/database');

const FILE = 'holidays-do.json';
const router = express.Router();

function load() {
  const d = readData(FILE);
  if (Array.isArray(d) || !d) return { manual: [], removed: [] };
  return { manual: [], removed: [], ...d };
}

function canEdit(user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  return /recursos humanos|rrhh|gerencia|tecnolog/.test(String(user.department || '').toLowerCase());
}

async function fetchFromNager(year) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/DO`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Nager.Date HTTP ${res.status}`);
  const arr = await res.json();
  return (Array.isArray(arr) ? arr : []).map((h) => ({
    date: h.date,
    name: h.localName || h.name,
    localName: h.localName,
  }));
}

/** Combina oficiales (cache/online) + manuales - removidos. */
function buildList(store, year) {
  const yKey = String(year);
  const official = (store[yKey] && store[yKey].items) || [];
  const removed = new Set(store.removed || []);
  const manual = (store.manual || []).filter((m) => (m.date || '').startsWith(yKey));
  const map = new Map();
  official.forEach((h) => { if (!removed.has(h.date)) map.set(h.date, { ...h, origen: 'oficial' }); });
  manual.forEach((m) => map.set(m.date, { date: m.date, name: m.name, origen: 'manual' }));
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// GET /api/holidays?year=YYYY  → refresca cache best-effort y devuelve lista combinada
router.get('/', auth, async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const store = load();
  const yKey = String(year);
  let source = store[yKey] ? store[yKey].source : null;

  // Refresco best-effort (no rompe si no hay internet)
  const stale = !store[yKey] || (Date.now() - new Date(store[yKey].fetchedAt || 0).getTime() > 7 * 864e5);
  if (stale) {
    try {
      const items = await fetchFromNager(year);
      if (items.length) {
        store[yKey] = { fetchedAt: new Date().toISOString(), source: 'nager', items };
        writeData(FILE, store);
        source = 'nager';
      }
    } catch (e) {
      // sin internet → usamos cache si existe
      source = store[yKey] ? 'cache' : null;
    }
  }

  res.json({ year, source, items: buildList(store, year) });
});

// POST /api/holidays/refresh  { year }
router.post('/refresh', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ message: 'No autorizado' });
  const year = Number(req.body.year) || new Date().getFullYear();
  const store = load();
  try {
    const items = await fetchFromNager(year);
    store[String(year)] = { fetchedAt: new Date().toISOString(), source: 'nager', items };
    writeData(FILE, store);
    res.json({ year, source: 'nager', items: buildList(store, year) });
  } catch (e) {
    res.status(502).json({ message: 'No se pudo consultar el calendario oficial: ' + e.message });
  }
});

// POST /api/holidays/manual  { date, name }  → agrega/edita feriado local
router.post('/manual', auth, (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ message: 'No autorizado' });
  const date = String(req.body.date || '').trim();
  const name = String(req.body.name || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) {
    return res.status(400).json({ message: 'date (YYYY-MM-DD) y name requeridos' });
  }
  const store = load();
  store.manual = (store.manual || []).filter((m) => m.date !== date);
  store.manual.push({ date, name });
  store.removed = (store.removed || []).filter((d) => d !== date);
  writeData(FILE, store);
  res.json({ items: buildList(store, date.slice(0, 4)) });
});

// DELETE /api/holidays/manual  { date }  → elimina un feriado (manual u oficial)
router.delete('/manual', auth, (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ message: 'No autorizado' });
  const date = String(req.body.date || '').trim();
  const store = load();
  store.manual = (store.manual || []).filter((m) => m.date !== date);
  if (!(store.removed || []).includes(date)) store.removed = [...(store.removed || []), date];
  writeData(FILE, store);
  res.json({ items: buildList(store, date.slice(0, 4)) });
});

module.exports = router;
