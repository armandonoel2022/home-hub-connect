// Operaciones — Puestos dentro de cada localidad
const { createCrudRoutes } = require('../helpers/crud');
module.exports = createCrudRoutes('ops_posts.json', 'OPS');
