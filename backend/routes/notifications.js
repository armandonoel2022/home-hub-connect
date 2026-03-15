const express = require('express');
const { getPool, sql } = require('../config/database');
const auth = require('../middleware/auth');
const { mapNotification } = require('../helpers/mappers');
const { generateId } = require('../helpers/crud');

const router = express.Router();

// GET /api/notifications?userId=XXX
router.get('/', auth, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.query.userId || req.user.id;
    const result = await pool.request()
      .input('userId', sql.VarChar, userId)
      .query('SELECT * FROM IntranetNotifications WHERE UserId = @userId ORDER BY CreatedAt DESC');
    res.json(result.recordset.map(mapNotification));
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

// POST /api/notifications
router.post('/', auth, async (req, res) => {
  try {
    const pool = getPool();
    const n = req.body;
    const id = generateId('NT');
    await pool.request()
      .input('id', sql.VarChar, id)
      .input('title', sql.VarChar, n.title)
      .input('message', sql.NVarChar, n.message || '')
      .input('type', sql.VarChar, n.type || 'info')
      .input('userId', sql.VarChar, n.forUserId)
      .input('relatedId', sql.VarChar, n.relatedId || '')
      .input('actionUrl', sql.VarChar, n.actionUrl || '')
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO IntranetNotifications (Id, Title, Message, Type, UserId, RelatedId, ActionUrl, CreatedAt)
        VALUES (@id, @title, @message, @type, @userId, @relatedId, @actionUrl, @createdAt)
      `);
    res.status(201).json({ id, ...n, read: false, createdAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('UPDATE IntranetNotifications SET IsRead = 1 WHERE Id = @id');
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

// PUT /api/notifications/read-all?userId=XXX
router.put('/read-all', auth, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.query.userId || req.user.id;
    await pool.request()
      .input('userId', sql.VarChar, userId)
      .query('UPDATE IntranetNotifications SET IsRead = 1 WHERE UserId = @userId');
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('DELETE FROM IntranetNotifications WHERE Id = @id');
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

module.exports = router;
