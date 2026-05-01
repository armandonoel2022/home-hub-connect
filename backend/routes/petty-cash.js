/**
 * Petty Cash: monthly repositions + cash denominations.
 * Single JSON file holding { repositions: [...], denominations: [...] }.
 */
const express = require('express');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');

const FILE = 'petty-cash.json';

const DEFAULT_DENOMS = [
  { value: 2000, count: 0 },
  { value: 1000, count: 0 },
  { value: 500, count: 0 },
  { value: 200, count: 0 },
  { value: 100, count: 0 },
  { value: 50, count: 0 },
  { value: 25, count: 0 },
  { value: 10, count: 0 },
  { value: 5, count: 0 },
  { value: 1, count: 0 },
];

function loadState() {
  const raw = readData(FILE);
  // readData returns []. Normalize to object.
  if (Array.isArray(raw) && raw.length === 0) {
    return { repositions: [], denominations: DEFAULT_DENOMS };
  }
  if (Array.isArray(raw)) {
    return { repositions: raw, denominations: DEFAULT_DENOMS };
  }
  return {
    repositions: Array.isArray(raw.repositions) ? raw.repositions : [],
    denominations: Array.isArray(raw.denominations) ? raw.denominations : DEFAULT_DENOMS,
  };
}

function saveState(state) {
  writeData(FILE, state);
}

const router = express.Router();

// Get full state
router.get('/', auth, (req, res) => {
  res.json(loadState());
});

// ─── Repositions ───
router.post('/repositions', auth, (req, res) => {
  const state = loadState();
  const { yearMonth, amountReposed, requestedBy, purchaseId, purchaseDescription, note } = req.body || {};
  if (!yearMonth || !amountReposed || !requestedBy) {
    return res.status(400).json({ message: 'yearMonth, amountReposed y requestedBy requeridos' });
  }
  // Per-transaction repositions (purchaseId presente) NO chequean duplicado mensual.
  if (!purchaseId) {
    const exists = state.repositions.find(
      r => r.yearMonth === yearMonth && r.status !== 'rechazado' && !r.purchaseId
    );
    if (exists) return res.status(400).json({ message: 'Ya existe una reposición mensual para ese mes' });
  } else {
    // Evitar reposición duplicada de la misma transacción (excepto si la anterior fue rechazada)
    const dup = state.repositions.find(
      r => r.purchaseId === purchaseId && r.status !== 'rechazado'
    );
    if (dup) return res.status(400).json({ message: 'Ya existe una reposición para esta transacción' });
  }

  const reposition = {
    id: `REP-${Date.now()}`,
    yearMonth,
    amountReposed: Number(amountReposed),
    requestedBy,
    requestedAt: new Date().toISOString(),
    status: 'pendiente',
    ...(purchaseId ? { purchaseId, purchaseDescription: purchaseDescription || '', kind: 'transaccion' } : { kind: 'mensual' }),
    ...(note ? { note } : {}),
  };
  state.repositions = [reposition, ...state.repositions];
  saveState(state);
  res.status(201).json(reposition);
});

router.post('/repositions/:id/approve', auth, (req, res) => {
  const state = loadState();
  const r = state.repositions.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ message: 'No encontrado' });
  if (r.status !== 'pendiente') return res.status(400).json({ message: 'Ya procesada' });
  r.status = 'aprobado';
  r.approvedBy = req.body.by || req.user?.fullName || 'Sistema';
  r.approvedAt = new Date().toISOString();
  saveState(state);
  res.json(r);
});

router.post('/repositions/:id/apply', auth, (req, res) => {
  const state = loadState();
  const r = state.repositions.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ message: 'No encontrado' });
  if (r.status !== 'aprobado') return res.status(400).json({ message: 'Debe aprobarse primero' });
  r.status = 'aplicado';
  r.appliedBy = req.body.by || req.user?.fullName || 'Sistema';
  r.appliedAt = new Date().toISOString();
  saveState(state);
  res.json(r);
});

router.delete('/repositions/:id', auth, (req, res) => {
  const state = loadState();
  const idx = state.repositions.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
  state.repositions.splice(idx, 1);
  saveState(state);
  res.status(204).send();
});

// ─── Denominations ───
router.put('/denominations', auth, (req, res) => {
  const state = loadState();
  const { denominations } = req.body || {};
  if (!Array.isArray(denominations)) return res.status(400).json({ message: 'denominations array requerido' });
  state.denominations = denominations.map(d => ({ value: Number(d.value), count: Number(d.count) || 0 }));
  saveState(state);
  res.json(state.denominations);
});

module.exports = router;
