const { createCrudRoutes } = require('../helpers/crud');
module.exports = createCrudRoutes('vehicles.json', 'VH');
