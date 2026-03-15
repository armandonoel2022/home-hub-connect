/**
 * Instala el API como servicio de Windows.
 * Ejecutar: npm install -g node-windows && node install-service.js
 */
const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'SafeOne Intranet API',
  description: 'API REST para la intranet SafeOne - Express + SQL Server',
  script: path.join(__dirname, 'server.js'),
  env: [
    { name: 'NODE_ENV', value: 'production' },
  ],
});

svc.on('install', () => {
  svc.start();
  console.log('✅ Servicio instalado e iniciado.');
});

svc.on('alreadyinstalled', () => {
  console.log('ℹ️  El servicio ya está instalado.');
});

svc.on('error', (err) => {
  console.error('❌ Error:', err);
});

svc.install();
