require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureDirs } = require('./config/fileStorage');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directories exist
ensureDirs();

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
app.use('/api/geo', require('./routes/geo'));
app.use('/api/monitoring-reports', require('./routes/monitoring-reports'));
app.use('/api/monitoring-account-settings', require('./routes/monitoring-account-settings'));
app.use('/api/monitoring-punch-rules', require('./routes/monitoring-punch-rules'));

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
