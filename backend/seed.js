/**
 * Seed script: Inserta los usuarios iniciales en SQL Server.
 * Ejecutar: node seed.js
 */
require('dotenv').config();
const { connectDB, getPool, sql } = require('./config/database');

const DEPARTMENTS = [
  "Administración", "Gerencia General", "Gerencia Comercial",
  "Recursos Humanos", "Operaciones", "Servicio al Cliente",
  "Calidad", "Cuentas por Cobrar", "Contabilidad",
  "Tecnología y Monitoreo", "Seguridad Electrónica",
];

const ALL_DEPTS = JSON.stringify(DEPARTMENTS);

const USERS = [
  { id: 'USR-001', fullName: 'Administrador SafeOne', email: 'tecnologia@safeone.com.do', department: 'Tecnología y Monitoreo', position: 'Administrador IT', birthday: '03-05', isAdmin: true, allowedDepartments: ALL_DEPTS, extension: '' },
  { id: 'USR-100', fullName: 'Aurelio Pérez', email: 'Aperez@safeone.com.do', department: 'Gerencia General', position: 'Gerente General', isAdmin: true, isDepartmentLeader: true, allowedDepartments: ALL_DEPTS, extension: '201' },
  { id: 'USR-101', fullName: 'Chrisnel Fabian', email: 'Cfabiancxc@safeone.com.do', department: 'Administración', position: 'Gerente Administrativo', isDepartmentLeader: true, reportsTo: 'USR-100', allowedDepartments: JSON.stringify(["Administración","Cuentas por Cobrar","Contabilidad","Calidad"]), extension: '204' },
  { id: 'USR-102', fullName: 'Xuxa Lugo', email: 'contabilidad@safeone.com.do', department: 'Contabilidad', position: 'Contadora', isDepartmentLeader: true, reportsTo: 'USR-101', allowedDepartments: JSON.stringify(["Contabilidad"]), extension: '' },
];

async function seed() {
  await connectDB();
  const pool = getPool();

  console.log('🌱 Insertando usuarios iniciales...');

  for (const u of USERS) {
    try {
      await pool.request()
        .input('id', sql.VarChar, u.id)
        .input('fullName', sql.VarChar, u.fullName)
        .input('email', sql.VarChar, u.email || '')
        .input('department', sql.VarChar, u.department || '')
        .input('position', sql.VarChar, u.position || '')
        .input('birthday', sql.VarChar, u.birthday || '')
        .input('photoUrl', sql.VarChar, '')
        .input('allowedDepts', sql.NVarChar, u.allowedDepartments || '[]')
        .input('isAdmin', sql.Bit, u.isAdmin ? 1 : 0)
        .input('isDeptLeader', sql.Bit, u.isDepartmentLeader ? 1 : 0)
        .input('reportsTo', sql.VarChar, u.reportsTo || null)
        .input('extension', sql.VarChar, u.extension || '')
        .query(`
          IF NOT EXISTS (SELECT 1 FROM IntranetUsuarios WHERE Id = @id)
          INSERT INTO IntranetUsuarios (Id, FullName, Email, Department, Position, Birthday, PhotoUrl, AllowedDepartments, IsAdmin, IsDepartmentLeader, ReportsTo, Extension)
          VALUES (@id, @fullName, @email, @department, @position, @birthday, @photoUrl, @allowedDepts, @isAdmin, @isDeptLeader, @reportsTo, @extension)
        `);
      console.log(`  ✅ ${u.fullName}`);
    } catch (err) {
      console.error(`  ❌ ${u.fullName}:`, err.message);
    }
  }

  console.log('\n🎉 Seed completado.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
