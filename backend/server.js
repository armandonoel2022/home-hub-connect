require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureDirs } = require('./config/fileStorage');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directories exist
ensureDirs();

// Run one-time migrations
try {
  require('./migrations/forcePasswordReset').run();
} catch (e) {
  console.warn(`⚠️  Migración forcePasswordReset falló: ${e.message}`);
}

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));

// Serve photo source folders (default: C:\intranet-nueva\FOTOS y C:\intranet-nueva\dist\fotos_empleados)
try {
  const { PHOTO_SOURCES } = require('./routes/photo-sync');
  (PHOTO_SOURCES || []).forEach((src) => {
    app.use(src.base, express.static(src.dir, { fallthrough: true, maxAge: '7d' }));
    console.log(`📷 Fotos servidas desde ${src.dir} en ${src.base}`);
  });
} catch (e) {
  console.warn(`⚠️  No se pudo montar carpetas de fotos: ${e.message}`);
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/phones', require('./routes/phones'));
app.use('/api/armed-personnel', require('./routes/armed-personnel'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/purchase-requests', require('./routes/purchase-requests'));
app.use('/api/hiring-requests', require('./routes/hiring-requests'));
app.use('/api/minor-purchases', require('./routes/minor-purchases'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/department-folders', require('./routes/department-folders'));
app.use('/api/kpis', require('./routes/kpis'));
app.use('/api/department-processes', require('./routes/department-processes'));
app.use('/api/audit-log', require('./routes/audit-log'));
app.use('/api/fleet-maintenance', require('./routes/fleet-maintenance'));
app.use('/api/keys', require('./routes/keys'));
app.use('/api/petty-cash', require('./routes/petty-cash'));
app.use('/api/corporate-cards', require('./routes/corporate-cards'));
app.use('/api/training', require('./routes/training'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/benefits', require('./routes/benefits'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/payroll-extras', require('./routes/payroll-extras'));
app.use('/api/geo', require('./routes/geo'));
app.use('/api/monitoring-reports', require('./routes/monitoring-reports'));
app.use('/api/monitoring-account-settings', require('./routes/monitoring-account-settings'));
app.use('/api/monitoring-punch-rules', require('./routes/monitoring-punch-rules'));
app.use('/api/monitoring-snapshots', require('./routes/monitoring-snapshots'));
app.use('/api/billing-clients', require('./routes/billing-clients'));
app.use('/api/uniform-items', require('./routes/uniform-items'));
app.use('/api/uniform-assignments', require('./routes/uniform-assignments'));
app.use('/api/flashlights', require('./routes/flashlights'));
app.use('/api/photo-sync', require('./routes/photo-sync'));
app.use('/api/folder-acl', require('./routes/folder-acl'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/calendar-events', require('./routes/calendar-events'));
app.use('/api/hr-requests', require('./routes/hr-requests'));
app.use('/api/general-sql', require('./routes/general-sql'));
app.use('/api/fixed-assets-sql', require('./routes/fixed-assets-sql'));
app.use('/api/ops-clients', require('./routes/ops-clients'));
app.use('/api/ops-locations', require('./routes/ops-locations'));
app.use('/api/ops-posts', require('./routes/ops-posts'));
app.use('/api/ops-daily-reports', require('./routes/ops-daily-reports'));
app.use('/api/vault-movements', require('./routes/vault-movements'));
app.use('/api/expediente-overlay', require('./routes/expediente-overlay'));
app.use('/api/holidays', require('./routes/holidays'));
app.use('/api/surveys', require('./routes/surveys'));
app.use('/api/vacations', require('./routes/vacations'));

// Health check
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  storage: 'file-based (JSON)',
  dataDir: path.join(__dirname, 'data'),
  timestamp: new Date(),
  uptime: process.uptime(),
}));

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Error interno del servidor' });
});

// Start — no database connection needed!
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SafeOne API corriendo en puerto ${PORT}`);
  console.log(`   Almacenamiento: JSON files en ${path.join(__dirname, 'data')}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});
