const { sql } = require('../config/database');
const { createCrudRouter } = require('../helpers/crud');
const { mapVehicle } = require('../helpers/mappers');

module.exports = createCrudRouter({
  table: 'IntranetVehicles',
  idPrefix: 'VH',
  mapper: mapVehicle,
  insertFields: {
    plate:           { col: 'Plate',           type: sql.VarChar },
    brand:           { col: 'Brand',           type: sql.VarChar },
    model:           { col: 'Model',           type: sql.VarChar },
    year:            { col: 'Year',            type: sql.Int },
    status:          { col: 'Status',          type: sql.VarChar },
    assignedTo:      { col: 'AssignedTo',      type: sql.VarChar },
    acquisitionDate: { col: 'AcquisitionDate', type: sql.DateTime },
    mileage:         { col: 'Kilometers',      type: sql.Int },
    notes:           { col: 'Notes',           type: sql.NVarChar },
  },
});
