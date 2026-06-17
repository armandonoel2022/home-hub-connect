// Operaciones — Bóveda de armas (entrada/salida del almacén, FROM→TO)
const { createCrudRoutes } = require('../helpers/crud');

module.exports = createCrudRoutes('vault_movements.json', 'VMV', {
  customRoutes: (router, filename) => {
    const { readData } = require('../config/database');
    const auth = require('../middleware/auth');
    router.get('/q/filter', auth, (req, res) => {
      let items = readData(filename);
      if (req.query.armaSerial) items = items.filter(i => i.armaSerial === req.query.armaSerial);
      res.json(items);
    });
  },
});
