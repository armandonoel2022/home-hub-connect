// Operaciones — Clientes (expediente digital)
const { createCrudRoutes } = require('../helpers/crud');
module.exports = createCrudRoutes('ops_clients.json', 'OCL');
