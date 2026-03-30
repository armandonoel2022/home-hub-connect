const express = require('express');
const router = express.Router();
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const FILENAME = 'audit-log.json';

// GET all audit entries (admin only)
router.get('/', auth, (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Solo administradores pueden ver el log de auditoría' });
  }
  let logs = readData(FILENAME);
  
  // Filters
  if (req.query.action) logs = logs.filter(l => l.action === req.query.action);
  if (req.query.userId) logs = logs.filter(l => l.userId === req.query.userId);
  if (req.query.module) logs = logs.filter(l => l.module === req.query.module);
  if (req.query.from) logs = logs.filter(l => l.timestamp >= req.query.from);
  if (req.query.to) logs = logs.filter(l => l.timestamp <= req.query.to);

  // Sort newest first, limit to 500
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(logs.slice(0, 500));
});

// POST create audit entry (internal use - called from other routes)
router.post('/', auth, (req, res) => {
  const logs = readData(FILENAME);
  const entry = {
    id: generateId('AUD', logs),
    userId: req.body.userId || req.user?.id,
    userName: req.body.userName || req.user?.fullName,
    action: req.body.action, // 'create', 'update', 'delete', 'login', 'approve', 'reject', 'password_change', 'password_reset'
    module: req.body.module, // 'tickets', 'users', 'purchases', 'processes', 'auth'
    targetId: req.body.targetId,
    targetName: req.body.targetName,
    details: req.body.details || '',
    ip: req.ip || req.connection?.remoteAddress,
    timestamp: new Date().toISOString(),
  };
  logs.push(entry);
  writeData(FILENAME, logs);
  res.status(201).json(entry);
});

// GET summary stats (admin only)
router.get('/stats', auth, (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Solo administradores' });
  }
  const logs = readData(FILENAME);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const todayLogs = logs.filter(l => l.timestamp >= today);
  const weekLogs = logs.filter(l => l.timestamp >= weekAgo);

  const actionCounts = {};
  weekLogs.forEach(l => {
    actionCounts[l.action] = (actionCounts[l.action] || 0) + 1;
  });

  res.json({
    totalEntries: logs.length,
    todayEntries: todayLogs.length,
    weekEntries: weekLogs.length,
    actionBreakdown: actionCounts,
  });
});

module.exports = router;
