const { createCrudRoutes } = require('../helpers/crud');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');

const FILE = 'notifications.json';

const router = createCrudRoutes(FILE, 'NOT', {
  customRoutes: (r) => {
    r.put('/:id/read', auth, (req, res) => {
      const items = readData(FILE);
      const idx = items.findIndex(i => i.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
      items[idx].read = true;
      writeData(FILE, items);
      res.json(items[idx]);
    });
  }
});

module.exports = router;
