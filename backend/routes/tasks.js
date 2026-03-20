const { createCrudRoutes } = require('../helpers/crud');
module.exports = createCrudRoutes('tasks.json', 'TSK');
