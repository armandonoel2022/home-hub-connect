const { createCrudRoutes } = require('../helpers/crud');
module.exports = createCrudRoutes('tickets.json', 'TK');
