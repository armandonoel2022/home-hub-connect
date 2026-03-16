const { createCrudRoutes } = require('../helpers/crud');
module.exports = createCrudRoutes('armed-personnel.json', 'AP');
