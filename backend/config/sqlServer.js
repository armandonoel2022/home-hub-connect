/**
 * Conexión opcional a SQL Server (software GENERAL).
 *
 * Se carga de forma perezosa: si el paquete `mssql` no está instalado o las
 * variables de entorno no están configuradas, el resto de la intranet sigue
 * funcionando con normalidad (almacenamiento JSON local).
 *
 * Variables de entorno (.env del backend):
 *   GENERAL_SQL_HOST=localhost
 *   GENERAL_SQL_PORT=1433
 *   GENERAL_SQL_INSTANCE=SQLEXPRESS        (opcional, instancia nombrada)
 *   GENERAL_SQL_DB=GENERAL
 *   GENERAL_SQL_USER=sa
 *   GENERAL_SQL_PASSWORD=********
 *   GENERAL_SQL_ENCRYPT=false              (true si el servidor lo exige)
 *   GENERAL_SQL_TRUST_CERT=true
 *   GENERAL_SQL_WRITE=false                (true habilita INSERT/UPDATE/DELETE)
 */

let mssql = null;
let pool = null;
let lastError = null;

function isConfigured() {
  return !!(process.env.GENERAL_SQL_HOST && process.env.GENERAL_SQL_DB);
}

function writeEnabled() {
  return String(process.env.GENERAL_SQL_WRITE || '').toLowerCase() === 'true';
}

function loadDriver() {
  if (mssql) return mssql;
  try {
    mssql = require('mssql');
  } catch (e) {
    lastError = "Paquete 'mssql' no instalado. Ejecuta: npm install mssql";
    throw new Error(lastError);
  }
  return mssql;
}

function buildConfig() {
  const sql = loadDriver();
  return {
    server: process.env.GENERAL_SQL_HOST,
    port: Number(process.env.GENERAL_SQL_PORT) || 1433,
    database: process.env.GENERAL_SQL_DB,
    user: process.env.GENERAL_SQL_USER,
    password: process.env.GENERAL_SQL_PASSWORD,
    options: {
      encrypt: String(process.env.GENERAL_SQL_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(process.env.GENERAL_SQL_TRUST_CERT || 'true').toLowerCase() === 'true',
      instanceName: process.env.GENERAL_SQL_INSTANCE || undefined,
      enableArithAbort: true,
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 8000,
    requestTimeout: 20000,
    _sql: sql,
  };
}

async function getPool() {
  if (!isConfigured()) {
    throw new Error('Conexión a GENERAL no configurada (faltan variables GENERAL_SQL_*).');
  }
  if (pool && pool.connected) return pool;
  const cfg = buildConfig();
  const sql = cfg._sql;
  delete cfg._sql;
  pool = await new sql.ConnectionPool(cfg).connect();
  lastError = null;
  return pool;
}

/**
 * Ejecuta una consulta parametrizada.
 * params: { name: value } → se enlazan como @name (previene inyección SQL).
 */
async function query(text, params = {}) {
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
    host: process.env.GENERAL_SQL_HOST || null,
    database: process.env.GENERAL_SQL_DB || null,
    instance: process.env.GENERAL_SQL_INSTANCE || null,
  };
  if (!isConfigured()) {
    return { ...base, connected: false, message: 'No configurado' };
  }
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

async function listColumns(schema, table) {
  return query(
    `SELECT COLUMN_NAME AS [name], DATA_TYPE AS [type], IS_NULLABLE AS [nullable]
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
     ORDER BY ORDINAL_POSITION`,
    { schema, table }
  );
}

/** Valida un identificador (tabla/columna) para uso seguro en SQL dinámico. */
function safeIdent(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name || ''))) {
    throw new Error(`Identificador inválido: ${name}`);
  }
  return name;
}

module.exports = {
  isConfigured,
  writeEnabled,
  getPool,
  query,
  status,
  listTables,
  listColumns,
  safeIdent,
  getLastError: () => lastError,
};
