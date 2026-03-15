const { sql } = require('../config/database');
const { createCrudRouter } = require('../helpers/crud');
const { mapPhone } = require('../helpers/mappers');

module.exports = createCrudRouter({
  table: 'IntranetPhones',
  idPrefix: 'PH',
  mapper: mapPhone,
  insertFields: {
    imei:        { col: 'IMEI',         type: sql.VarChar },
    serial:      { col: 'Serial',       type: sql.VarChar },
    brand:       { col: 'Brand',        type: sql.VarChar },
    model:       { col: 'Model',        type: sql.VarChar },
    status:      { col: 'Status',       type: sql.VarChar },
    assignedTo:  { col: 'AssignedTo',   type: sql.VarChar },
    department:  { col: 'Department',   type: sql.VarChar },
    phoneNumber: { col: 'PhoneNumber',  type: sql.VarChar },
    notes:       { col: 'Notes',        type: sql.NVarChar },
  },
});
