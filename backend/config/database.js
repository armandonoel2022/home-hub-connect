const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool;

async function connectDB() {
  try {
    pool = await sql.connect(config);
    console.log('✅ Conectado a SQL Server:', process.env.DB_NAME);
    return pool;
  } catch (err) {
    console.error('❌ Error de conexión a BD:', err.message);
    throw err;
  }
}

function getPool() {
  if (!pool) throw new Error('Base de datos no conectada');
  return pool;
}

module.exports = { connectDB, getPool, sql };
