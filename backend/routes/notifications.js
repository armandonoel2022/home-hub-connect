const { createCrudRoutes } = require('../helpers/crud');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const FILE = 'notifications.json';

const router = createCrudRoutes(FILE, 'NOT', {
  customRoutes: (r) => {
    // Mark single notification as read
    r.put('/:id/read', auth, (req, res) => {
      const items = readData(FILE);
      const idx = items.findIndex(i => i.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
      items[idx].read = true;
      writeData(FILE, items);
      res.json(items[idx]);
    });

    // Mark all notifications as read for a user
    r.put('/read-all', auth, (req, res) => {
      const userId = req.query.userId || req.user.id;
      const items = readData(FILE);
      items.forEach(item => {
        if (item.forUserId === userId || item.forUserId === 'ALL') {
          item.read = true;
        }
      });
      writeData(FILE, items);
      res.json({ success: true });
    });
  }
});

// Override GET to include notifications for ALL users (panic button broadcasts)
const express = require('express');
const broadcastRouter = express.Router();

broadcastRouter.get('/', auth, (req, res) => {
  const userId = req.query.userId || req.user.id;
  let items = readData(FILE);
  // Return notifications for this user OR broadcast to ALL
  items = items.filter(i => i.forUserId === userId || i.forUserId === 'ALL');
  res.json(items);
});

// Use broadcast router for GET, regular router for everything else
broadcastRouter.use('/', router);

module.exports = broadcastRouter;
