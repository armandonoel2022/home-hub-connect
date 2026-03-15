const { sql } = require('../config/database');
const { createCrudRouter } = require('../helpers/crud');
const { mapPersonnel } = require('../helpers/mappers');

module.exports = createCrudRouter({
  table: 'IntranetArmedPersonnel',
  idPrefix: 'AP',
  mapper: mapPersonnel,
  insertFields: {
    name:           { col: 'Name',               type: sql.VarChar },
    photo:          { col: 'Photo',              type: sql.VarChar },
    location:       { col: 'AssignmentLocation', type: sql.VarChar },
    position:       { col: 'Position',           type: sql.VarChar },
    supervisor:     { col: 'Supervisor',         type: sql.VarChar },
    fleetPhone:     { col: 'FleetPhone',         type: sql.VarChar },
    personalPhone:  { col: 'PersonalPhone',      type: sql.VarChar },
    address:        { col: 'Address',            type: sql.VarChar },
    weaponType:     { col: 'WeaponType',         type: sql.VarChar },
    weaponSerial:   { col: 'WeaponSerial',       type: sql.VarChar },
    weaponBrand:    { col: 'WeaponBrand',        type: sql.VarChar },
    weaponCaliber:  { col: 'WeaponCaliber',      type: sql.VarChar },
    ammunitionCount:{ col: 'AmmunitionCount',    type: sql.Int },
    licenseNumber:  { col: 'LicenseNumber',      type: sql.VarChar },
    licenseExpiry:  { col: 'LicenseExpiry',      type: sql.DateTime },
    status:         { col: 'Status',             type: sql.VarChar },
  },
});
