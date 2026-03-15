const { sql } = require('../config/database');
const { createCrudRouter } = require('../helpers/crud');
const { mapEquipment } = require('../helpers/mappers');

module.exports = createCrudRouter({
  table: 'IntranetEquipment',
  idPrefix: 'EQ',
  mapper: mapEquipment,
  insertFields: {
    type:            { col: 'Type',           type: sql.VarChar },
    brand:           { col: 'Brand',          type: sql.VarChar },
    model:           { col: 'Model',          type: sql.VarChar },
    serial:          { col: 'SerialNumber',   type: sql.VarChar },
    status:          { col: 'Status',         type: sql.VarChar },
    assignedTo:      { col: 'AssignedTo',     type: sql.VarChar },
    department:      { col: 'Department',     type: sql.VarChar },
    acquisitionDate: { col: 'AssignedDate',   type: sql.DateTime },
    notes:           { col: 'Notes',          type: sql.NVarChar },
  },
});
