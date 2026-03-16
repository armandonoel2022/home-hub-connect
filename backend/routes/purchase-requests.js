const { createCrudRoutes } = require('../helpers/crud');
const { readData, writeData } = require('../config/database');
const auth = require('../middleware/auth');

const FILE = 'purchase-requests.json';

const router = createCrudRoutes(FILE, 'PR', {
  customRoutes: (r) => {
    r.post('/:id/approve', auth, (req, res) => {
      const items = readData(FILE);
      const idx = items.findIndex(i => i.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
      items[idx] = { ...items[idx], status: 'Aprobado', approvedBy: req.body.by, approvalLevel: req.body.level, approvalDate: new Date().toISOString(), updatedAt: new Date().toISOString() };
      writeData(FILE, items);
      res.json(items[idx]);
    });

    r.post('/:id/reject', auth, (req, res) => {
      const items = readData(FILE);
      const idx = items.findIndex(i => i.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'No encontrado' });
      items[idx] = { ...items[idx], status: 'Rechazado', rejectedBy: req.body.by, rejectionReason: req.body.reason, updatedAt: new Date().toISOString() };
      writeData(FILE, items);
      res.json(items[idx]);
    });
  }
});

module.exports = router;
