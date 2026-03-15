const { sql } = require('../config/database');
const { createCrudRouter } = require('../helpers/crud');
const { mapTicket } = require('../helpers/mappers');

const J = (v) => JSON.stringify(v);

module.exports = createCrudRouter({
  table: 'IntranetTickets',
  idPrefix: 'TK',
  mapper: mapTicket,
  insertFields: {
    title:       { col: 'Title',       type: sql.VarChar },
    description: { col: 'Description', type: sql.NVarChar },
    category:    { col: 'Category',    type: sql.VarChar },
    priority:    { col: 'Priority',    type: sql.VarChar },
    status:      { col: 'Status',      type: sql.VarChar },
    createdBy:   { col: 'CreatedBy',   type: sql.VarChar },
    department:  { col: 'Department',  type: sql.VarChar },
    slaHours:    { col: 'SlaHours',    type: sql.Int },
    slaDeadline: { col: 'SlaDeadline', type: sql.DateTime },
    attachments: { col: 'Attachments', type: sql.NVarChar, serialize: J },
  },
});
