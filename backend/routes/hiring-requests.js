const { createCrudRoutes } = require('../helpers/crud');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');

const FILE = 'hiring-requests.json';

const router = createCrudRoutes(FILE, 'HR', {
  customRoutes: (r) => {
    r.put('/:id/status', auth, (req, res) => {
      const items = readData(FILE);
      const idx = items.findIndex(i => i.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
      items[idx] = { ...items[idx], status: req.body.status, updatedAt: new Date().toISOString() };
      writeData(FILE, items);
      res.json(items[idx]);
    });
  }
});

module.exports = router;
