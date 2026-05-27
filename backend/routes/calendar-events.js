/**
 * Calendar events — eventos del calendario corporativo.
 * Archivo: calendar-events.json
 */
const { createCrudRoutes } = require('../helpers/crud');
module.exports = createCrudRoutes('calendar-events.json', 'EVT');
