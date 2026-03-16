/**
 * Seed script: Crea el archivo users.json con los usuarios iniciales.
 * Ejecutar: node seed.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { readData, writeData } = require('./config/database');

const DEPARTMENTS = [
  "Administración", "Gerencia General", "Gerencia Comercial",
  "Recursos Humanos", "Operaciones", "Servicio al Cliente",
  "Calidad", "Cuentas por Cobrar", "Contabilidad",
  "Tecnología y Monitoreo", "Seguridad Electrónica",
];

async function seed() {
  console.log('🌱 Generando usuarios iniciales...');

  const defaultHash = await bcrypt.hash('safeone', 10);

  const users = [
    {
      id: 'USR-001', fullName: 'Administrador SafeOne', email: 'tecnologia@safeone.com.do',
      department: 'Tecnología y Monitoreo', position: 'Administrador IT', birthday: '03-05',
      photoUrl: '', allowedDepartments: DEPARTMENTS, isAdmin: true, extension: '',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-100', fullName: 'Aurelio Pérez', email: 'aperez@safeone.com.do',
      department: 'Gerencia General', position: 'Gerente General', birthday: '',
      photoUrl: '', allowedDepartments: DEPARTMENTS, isAdmin: true, isDepartmentLeader: true,
      reportsTo: '', extension: '201', passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-002', fullName: 'Armando Noel', email: 'anoel@safeone.com.do',
      department: 'Tecnología y Monitoreo', position: 'Encargado de Tecnología y Monitoreo',
      birthday: '07-15', photoUrl: '', allowedDepartments: DEPARTMENTS,
      isAdmin: true, isDepartmentLeader: true, reportsTo: 'USR-110',
      fleetPhone: '+1 809-555-0020', extension: '216', passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-101', fullName: 'Chrisnel Fabian', email: 'cfabiancxc@safeone.com.do',
      department: 'Administración', position: 'Gerente Administrativo', birthday: '',
      photoUrl: '', allowedDepartments: ['Administración', 'Cuentas por Cobrar', 'Contabilidad', 'Calidad'],
      isAdmin: false, isDepartmentLeader: true, reportsTo: 'USR-100', extension: '204',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-102', fullName: 'Xuxa Lugo', email: 'contabilidad@safeone.com.do',
      department: 'Contabilidad', position: 'Contadora', birthday: '', photoUrl: '',
      allowedDepartments: ['Contabilidad'], isAdmin: false, isDepartmentLeader: true,
      reportsTo: 'USR-101', extension: '206', passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-103', fullName: 'Christy Fernández', email: 'cxc@safeone.com.do',
      department: 'Cuentas por Cobrar', position: 'Encargada de Cuentas por Cobrar',
      birthday: '', photoUrl: '', allowedDepartments: ['Cuentas por Cobrar'],
      isAdmin: false, isDepartmentLeader: true, reportsTo: 'USR-101', extension: '203',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-104', fullName: 'Bilianny Fernández', email: 'bfernandez@safeone.com.do',
      department: 'Calidad', position: 'Encargada de Calidad, Cumplimiento y Mejora Continua',
      birthday: '', photoUrl: '', allowedDepartments: ['Calidad'],
      isAdmin: false, isDepartmentLeader: true, reportsTo: 'USR-101', extension: '217',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-110', fullName: 'Samuel A. Pérez', email: 'sperez@safeone.com.do',
      department: 'Gerencia Comercial', position: 'Gerente Comercial', birthday: '', photoUrl: '',
      allowedDepartments: ['Gerencia Comercial', 'Servicio al Cliente', 'Tecnología y Monitoreo', 'Seguridad Electrónica'],
      isAdmin: false, isDepartmentLeader: true, reportsTo: 'USR-100', extension: '215',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-111', fullName: 'Luis Ovalles', email: 'lovalles@safeone.com.do',
      department: 'Seguridad Electrónica', position: 'Encargado de Seguridad Electrónica',
      birthday: '', photoUrl: '', allowedDepartments: ['Seguridad Electrónica'],
      isAdmin: false, isDepartmentLeader: true, reportsTo: 'USR-110', extension: '202',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-112', fullName: 'Perla González', email: 'serviciocliente@safeone.com.do',
      department: 'Servicio al Cliente', position: 'Encargada de Servicio al Cliente',
      birthday: '', photoUrl: '', allowedDepartments: ['Servicio al Cliente'],
      isAdmin: false, isDepartmentLeader: true, reportsTo: 'USR-110', extension: '200',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-113', fullName: 'Leonela Báez', email: 'lbaez@safeone.com.do',
      department: 'Gerencia Comercial', position: 'Departamento Comercial',
      birthday: '', photoUrl: '', allowedDepartments: ['Gerencia Comercial'],
      isAdmin: false, reportsTo: 'USR-110', extension: '212',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-006', fullName: 'Dilia Aguasvivas', email: 'daguasvivas@safeone.com.do',
      department: 'Recursos Humanos', position: 'Gerente de RRHH',
      birthday: '', photoUrl: '', allowedDepartments: ['Recursos Humanos'],
      isAdmin: false, isDepartmentLeader: true, reportsTo: 'USR-100', extension: '211',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-007', fullName: 'Alexandra Lira', email: 'alira@safeone.com.do',
      department: 'Recursos Humanos', position: 'Relaciones Laborales',
      birthday: '', photoUrl: '', allowedDepartments: ['Recursos Humanos'],
      isAdmin: false, reportsTo: 'USR-006', extension: '219',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-150', fullName: 'Noemi Pérez', email: 'nperez@safeone.com.do',
      department: 'Recursos Humanos', position: 'Reclutamiento y Selección',
      birthday: '', photoUrl: '', allowedDepartments: ['Recursos Humanos'],
      isAdmin: false, reportsTo: 'USR-006', extension: '218',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-151', fullName: 'Paula Félix', email: 'rrhh2@safeone.com.do',
      department: 'Recursos Humanos', position: 'Auxiliar de RRHH',
      birthday: '', photoUrl: '', allowedDepartments: ['Recursos Humanos'],
      isAdmin: false, reportsTo: 'USR-006', extension: '213',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-005', fullName: 'Remit López', email: 'rlopez@safeone.com.do',
      department: 'Operaciones', position: 'Gerente de Operaciones',
      birthday: '01-10', photoUrl: '', allowedDepartments: ['Operaciones'],
      isAdmin: false, isDepartmentLeader: true, reportsTo: 'USR-100', extension: '220',
      fleetPhone: '+1 809-555-0010', passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-120', fullName: 'Brandon Díaz', email: 'monitoreo@safeone.com.do',
      department: 'Tecnología y Monitoreo', position: 'Operador de Monitoreo',
      birthday: '', photoUrl: '', allowedDepartments: ['Tecnología y Monitoreo'],
      isAdmin: false, reportsTo: 'USR-002', extension: '207', shift: 'Turno día', team: 'Sede Central',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-160', fullName: 'Carmen Sosa', email: '',
      department: 'Administración', position: 'Cocina',
      birthday: '', photoUrl: '', allowedDepartments: ['Administración'],
      isAdmin: false, reportsTo: 'USR-101', extension: '205',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
    {
      id: 'USR-161', fullName: 'Jefferson Constanza', email: '',
      department: 'Administración', position: 'Recepción',
      birthday: '', photoUrl: '', allowedDepartments: ['Administración'],
      isAdmin: false, reportsTo: 'USR-101', extension: '208',
      passwordHash: defaultHash, employeeStatus: 'Activo',
    },
  ];

  // Add timestamps
  const now = new Date().toISOString();
  users.forEach(u => {
    u.createdAt = now;
    u.updatedAt = now;
  });

  writeData('users.json', users);
  console.log(`✅ ${users.length} usuarios creados en data/users.json`);
  console.log('   Contraseña por defecto: safeone');
  console.log('\n🎉 Seed completado.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
