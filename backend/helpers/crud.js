/**
 * Generic CRUD factory for Express routes + File-based storage
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

function createCrudRoutes(filename, idPrefix, options = {}) {
  const router = express.Router();

  // GET all
  router.get('/', auth, (req, res) => {
    let items = readData(filename);
    if (req.query.userId) items = items.filter(i => i.userId === req.query.userId);
    if (req.query.department) items = items.filter(i => i.department === req.query.department);
    if (req.query.status) items = items.filter(i => i.status === req.query.status);
    res.json(items);
  });

  // GET by id
  router.get('/:id', auth, (req, res) => {
    const items = readData(filename);
    const item = items.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ message: 'No encontrado' });
    res.json(item);
  });

  // POST create
  router.post('/', auth, (req, res) => {
    const items = readData(filename);
    const newItem = {
      ...req.body,
      id: req.body.id || generateId(idPrefix, items),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    items.push(newItem);
    writeData(filename, items);
    res.status(201).json(newItem);
  });

  // PUT update
  router.put('/:id', auth, (req, res) => {
    const items = readData(filename);
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
    items[idx] = { ...items[idx], ...req.body, updatedAt: new Date().toISOString() };
    writeData(filename, items);
    res.json(items[idx]);
  });

  // DELETE
  router.delete('/:id', auth, (req, res) => {
    const items = readData(filename);
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
    items.splice(idx, 1);
    writeData(filename, items);
    res.status(204).send();
  });

  if (options.customRoutes) options.customRoutes(router, filename);

  return router;
}

module.exports = { createCrudRoutes };
