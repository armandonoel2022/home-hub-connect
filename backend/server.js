require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

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

// Health check
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date(),
  uptime: process.uptime(),
}));

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Error interno del servidor' });
});

// Start
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ SafeOne API corriendo en puerto ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
  });
}).catch(err => {
  console.error('❌ No se pudo conectar a SQL Server:', err.message);
  process.exit(1);
});
