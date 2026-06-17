/**
 * Conexión de SOLO LECTURA a SQL Server (base gSafeOne del software GENERAL).
 *
 * Servidor: SAFEONE-SERVER\SQL2019 — Autenticación de Windows (por defecto).
 *
 * Carga perezosa: si el driver no está instalado o las variables no están
 * configuradas, el resto de la intranet sigue funcionando con JSON local.
 *
 * Variables de entorno (.env del backend):
 *   GENERAL_SQL_AUTH=windows            (windows | sql)
 *   GENERAL_SQL_HOST=SAFEONE-SERVER\SQL2019
 *   GENERAL_SQL_DB=gSafeOne
 *   GENERAL_SQL_USER=sa                 (solo si AUTH=sql)
 *   GENERAL_SQL_PASSWORD=********       (solo si AUTH=sql)
 *   GENERAL_SQL_ENCRYPT=false
 *   GENERAL_SQL_TRUST_CERT=true
 *
 * Windows Auth requiere el driver nativo:  npm install msnodesqlv8 mssql
 * SQL Login usa solo:                       npm install mssql
 */

let driver = null;
let pool = null;
let lastError = null;

function authMode() {
  return String(process.env.GENERAL_SQL_AUTH || 'windows').toLowerCase();
}

function isConfigured() {
  return !!(process.env.GENERAL_SQL_HOST && process.env.GENERAL_SQL_DB);
}

// Escritura DESHABILITADA por defecto. Para habilitarla se requiere, de forma
// explícita, la variable de entorno GENERAL_SQL_WRITE=true.
function writeEnabled() {
  return String(process.env.GENERAL_SQL_WRITE || 'false').toLowerCase() === 'true';
}

function loadDriver() {
  if (driver) return driver;
  try {
    if (authMode() === 'windows') {
      driver = require('mssql/msnodesqlv8');
    } else {
      driver = require('mssql');
    }
  } catch (e) {
    lastError =
      authMode() === 'windows'
        ? "Drivers no instalados. Ejecuta en /backend: npm install mssql msnodesqlv8"
        : "Paquete 'mssql' no instalado. Ejecuta en /backend: npm install mssql";
    throw new Error(lastError);
  }
  return driver;
}

function buildConfig() {
  const sql = loadDriver();
  const encrypt = String(process.env.GENERAL_SQL_ENCRYPT || 'false').toLowerCase() === 'true';
  const trust = String(process.env.GENERAL_SQL_TRUST_CERT || 'true').toLowerCase() === 'true';

  if (authMode() === 'windows') {
    // Driver nativo msnodesqlv8 con Trusted Connection (Autenticación de Windows)
    const connStr =
      `Driver={ODBC Driver 17 for SQL Server};Server=${process.env.GENERAL_SQL_HOST};` +
      `Database=${process.env.GENERAL_SQL_DB};Trusted_Connection=Yes;` +
      `TrustServerCertificate=${trust ? 'Yes' : 'No'};`;
    return {
      connectionString: connStr,
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
      _sql: sql,
    };
  }

  // Autenticación SQL (usuario/contraseña)
  return {
    server: process.env.GENERAL_SQL_HOST,
    port: Number(process.env.GENERAL_SQL_PORT) || 1433,
    database: process.env.GENERAL_SQL_DB,
    user: process.env.GENERAL_SQL_USER,
    password: process.env.GENERAL_SQL_PASSWORD,
    options: { encrypt, trustServerCertificate: trust, enableArithAbort: true },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 8000,
    requestTimeout: 30000,
    _sql: sql,
  };
}

async function getPool() {
  if (!isConfigured()) {
    throw new Error('Conexión a gSafeOne no configurada (faltan variables GENERAL_SQL_*).');
  }
  if (pool && pool.connected) return pool;
  const cfg = buildConfig();
  const sql = cfg._sql;
  delete cfg._sql;
  pool = await new sql.ConnectionPool(cfg).connect();
  lastError = null;
  return pool;
}

/** Consulta parametrizada (params: { name: value } → @name). SOLO SELECT. */
async function query(text, params = {}) {
  if (!/^\s*(select|with)\b/i.test(text)) {
    throw new Error('Solo se permiten consultas de lectura (SELECT).');
  }
  const p = await getPool();
  const req = p.request();
  Object.entries(params).forEach(([k, v]) => req.input(k, v));
  const result = await req.query(text);
  return result.recordset || [];
}

async function status() {
  const base = {
    configured: isConfigured(),
    writeEnabled: writeEnabled(),
    auth: authMode(),
    host: process.env.GENERAL_SQL_HOST || null,
    database: process.env.GENERAL_SQL_DB || null,
  };
  if (!isConfigured()) return { ...base, connected: false, message: 'No configurado' };
  try {
    const rows = await query('SELECT 1 AS ok');
    return { ...base, connected: rows.length > 0, message: 'Conexión exitosa' };
  } catch (e) {
    return { ...base, connected: false, message: e.message };
  }
}

async function listTables() {
  return query(
    `SELECT TABLE_SCHEMA AS [schema], TABLE_NAME AS [name]
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_SCHEMA, TABLE_NAME`
  );
}

async function listColumns(table) {
  return query(
    `SELECT COLUMN_NAME AS [name], DATA_TYPE AS [type], IS_NULLABLE AS [nullable]
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = @table
     ORDER BY ORDINAL_POSITION`,
    { table }
  );
}

module.exports = {
  isConfigured,
  writeEnabled,
  authMode,
  getPool,
  query,
  status,
  listTables,
  listColumns,
  getLastError: () => lastError,
};
