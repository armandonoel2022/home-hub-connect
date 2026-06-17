// Operaciones — Reporte diario por puesto/turno (fuente viva del expediente)
const { createCrudRoutes } = require('../helpers/crud');

// Filtros adicionales por fecha y puesto sobre el GET genérico.
module.exports = createCrudRoutes('ops_daily_reports.json', 'ODR', {
  customRoutes: (router, filename) => {
    const { readData } = require('../config/database');
    const auth = require('../middleware/auth');
    router.get('/q/filter', auth, (req, res) => {
      let items = readData(filename);
      if (req.query.fecha) items = items.filter(i => i.fecha === req.query.fecha);
      if (req.query.postId) items = items.filter(i => i.postId === req.query.postId);
      res.json(items);
    });
  },
});
