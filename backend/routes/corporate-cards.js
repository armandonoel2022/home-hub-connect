/**
 * Corporate Cards: cards (assignee, limit) + charges (monthly purchases).
 * Single JSON file: { cards: [...], charges: [...] }
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { readData, writeData, saveFile, UPLOADS_DIR } = require('../config/database');
const auth = require('../middleware/auth');

const FILE = 'corporate-cards.json';
const RECEIPTS_DIR = path.join(UPLOADS_DIR, 'corporate-cards');
if (!fs.existsSync(RECEIPTS_DIR)) fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

const jsonLarge = express.json({ limit: '10mb' });

function loadState() {
  const raw = readData(FILE);
  if (Array.isArray(raw)) return { cards: [], charges: [] };
  return {
    cards: Array.isArray(raw.cards) ? raw.cards : [],
    charges: Array.isArray(raw.charges) ? raw.charges : [],
  };
}
const saveState = (s) => writeData(FILE, s);

const router = express.Router();

router.get('/', auth, (req, res) => res.json(loadState()));

// ─── Cards ───
router.post('/cards', auth, (req, res) => {
  const state = loadState();
  const { holder, holderUserId, last4, brand, monthlyLimit, notes, department } = req.body || {};
  if (!holder || !last4) return res.status(400).json({ message: 'holder y last4 requeridos' });
  const card = {
    id: `CC-${Date.now()}`,
    holder,
    holderUserId: holderUserId || null,
    last4: String(last4).slice(-4),
    brand: brand || 'Visa',
    monthlyLimit: Number(monthlyLimit) || 0,
    department: department || '',
    notes: notes || '',
    active: true,
    createdAt: new Date().toISOString(),
  };
  state.cards.unshift(card);
  saveState(state);
  res.status(201).json(card);
});

router.put('/cards/:id', auth, (req, res) => {
  const state = loadState();
  const idx = state.cards.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
  state.cards[idx] = { ...state.cards[idx], ...req.body, id: state.cards[idx].id, updatedAt: new Date().toISOString() };
  saveState(state);
  res.json(state.cards[idx]);
});

router.delete('/cards/:id', auth, (req, res) => {
  const state = loadState();
  const idx = state.cards.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
  // Soft-delete: marcar inactiva si tiene cargos; eliminar si no
  const hasCharges = state.charges.some(ch => ch.cardId === req.params.id);
  if (hasCharges) {
    state.cards[idx].active = false;
  } else {
    state.cards.splice(idx, 1);
  }
  saveState(state);
  res.status(204).send();
});

// ─── Charges ───
router.post('/charges', auth, jsonLarge, (req, res) => {
  const state = loadState();
  const { cardId, expenseDate, description, amount, category, merchant, notes, registeredBy, receiptDataUrl, receiptName } = req.body || {};
  if (!cardId || !expenseDate || !description || !amount) {
    return res.status(400).json({ message: 'cardId, expenseDate, description y amount requeridos' });
  }
  if (!state.cards.find(c => c.id === cardId)) return res.status(400).json({ message: 'Tarjeta no existe' });

  let receiptUrl = '';
  if (receiptDataUrl && receiptName) {
    const allowed = /\.(pdf|jpg|jpeg|png)$/i;
    if (!allowed.test(receiptName)) return res.status(400).json({ message: 'Solo PDF/JPG/PNG' });
    const base64 = (receiptDataUrl.split('base64,')[1] || '');
    if (Math.floor(base64.length * 0.75) > 5 * 1024 * 1024) return res.status(400).json({ message: 'Archivo > 5MB' });
    const safeName = `${cardId}_${Date.now()}_${receiptName.replace(/[^\w.\-]/g, '_')}`;
    saveFile('corporate-cards', safeName, receiptDataUrl);
    receiptUrl = `/uploads/corporate-cards/${safeName}`;
  }

  const charge = {
    id: `CCH-${Date.now()}`,
    cardId,
    expenseDate,
    description,
    amount: Number(amount),
    category: category || 'Otros',
    merchant: merchant || '',
    notes: notes || '',
    registeredBy: registeredBy || req.user?.fullName || 'Sistema',
    registeredAt: new Date().toISOString(),
    receiptUrl,
    receiptName: receiptName || '',
    voided: false,
  };
  state.charges.unshift(charge);
  saveState(state);
  res.status(201).json(charge);
});

router.put('/charges/:id', auth, jsonLarge, (req, res) => {
  const state = loadState();
  const idx = state.charges.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
  state.charges[idx] = { ...state.charges[idx], ...req.body, id: state.charges[idx].id, updatedAt: new Date().toISOString() };
  saveState(state);
  res.json(state.charges[idx]);
});

router.post('/charges/:id/void', auth, (req, res) => {
  const state = loadState();
  const c = state.charges.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ message: 'No encontrado' });
  const reason = (req.body.reason || '').trim();
  if (!reason) return res.status(400).json({ message: 'Justificación requerida' });
  c.voided = true;
  c.voidedReason = reason;
  c.voidedBy = req.body.by || req.user?.fullName || 'Sistema';
  c.voidedAt = new Date().toISOString();
  saveState(state);
  res.json(c);
});

router.delete('/charges/:id', auth, (req, res) => {
  const state = loadState();
  const idx = state.charges.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
  state.charges.splice(idx, 1);
  saveState(state);
  res.status(204).send();
});

module.exports = router;
