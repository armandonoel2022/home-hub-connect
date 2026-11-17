/**
 * Conexión de SOLO LECTURA a SQL Server, base [SafeOne] (Activo Fijo, etc.).
 *
 * Reutiliza las MISMAS credenciales que gSafeOne (mismo host y auth), pero
 * apunta a otra base. Por defecto: SAFEONE_SQL_DB=SafeOne.
 *
 * Variables (.env del backend):
 *   SAFEONE_SQL_AUTH=windows            (windows | sql) — opcional, fallback GENERAL_SQL_AUTH
 *   SAFEONE_SQL_HOST=SAFEONE-SERVER\SQL2019  — opcional, fallback GENERAL_SQL_HOST
 *   SAFEONE_SQL_DB=SafeOne
 *   SAFEONE_SQL_USER / SAFEONE_SQL_PASSWORD  (solo AUTH=sql, fallback GENERAL_*)
 *   SAFEONE_SQL_ENCRYPT=false
 *   SAFEONE_SQL_TRUST_CERT=true
 */

let driver = null;
let pool = null;

function env(k, fallback) {
  const v = process.env[k];
  return v !== undefined && v !== '' ? v : fallback;
}

function authMode() {
  return String(env('SAFEONE_SQL_AUTH', env('GENERAL_SQL_AUTH', 'windows'))).toLowerCase();
}

function host() { return env('SAFEONE_SQL_HOST', process.env.GENERAL_SQL_HOST); }
function db()   { return env('SAFEONE_SQL_DB', 'SafeOne'); }

function isConfigured() {
  return !!(host() && db());
}

function loadDriver() {
  if (driver) return driver;
  if (authMode() === 'windows') driver = require('mssql/msnodesqlv8');
  else driver = require('mssql');
  return driver;
}

function buildConfig() {
  const sql = loadDriver();
  const encrypt = String(env('SAFEONE_SQL_ENCRYPT', env('GENERAL_SQL_ENCRYPT', 'false'))).toLowerCase() === 'true';
  const trust = String(env('SAFEONE_SQL_TRUST_CERT', env('GENERAL_SQL_TRUST_CERT', 'true'))).toLowerCase() === 'true';

  if (authMode() === 'windows') {
    const connStr =
      `Driver={ODBC Driver 17 for SQL Server};Server=${host()};` +
      `Database=${db()};Trusted_Connection=Yes;` +
      `TrustServerCertificate=${trust ? 'Yes' : 'No'};`;
    return {
      connectionString: connStr,
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
      _sql: sql,
    };
  }

  return {
    server: host(),
    port: Number(env('SAFEONE_SQL_PORT', env('GENERAL_SQL_PORT', 1433))),
    database: db(),
    user: env('SAFEONE_SQL_USER', process.env.GENERAL_SQL_USER),
    password: env('SAFEONE_SQL_PASSWORD', process.env.GENERAL_SQL_PASSWORD),
    options: { encrypt, trustServerCertificate: trust, enableArithAbort: true },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 8000,
    requestTimeout: 30000,
    _sql: sql,
  };
}

async function getPool() {
  if (!isConfigured()) throw new Error('Conexión a SafeOne no configurada (faltan SAFEONE_SQL_* o GENERAL_SQL_*).');
  if (pool && pool.connected) return pool;
  const cfg = buildConfig();
  const sql = cfg._sql; delete cfg._sql;
  pool = await new sql.ConnectionPool(cfg).connect();
  return pool;
}

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
    auth: authMode(),
    host: host() || null,
    database: db() || null,
  };
  if (!isConfigured()) return { ...base, connected: false, message: 'No configurado' };
  try {
    const rows = await query('SELECT 1 AS ok');
    return { ...base, connected: rows.length > 0, message: 'Conexión exitosa' };
  } catch (e) {
    return { ...base, connected: false, message: e.message };
  }
}

/**
 * Escritura CONTROLADA: solo UPDATE sobre dbo.ActivoFijo con WHERE OID = @oid.
 * Prohibido DELETE, DROP, TRUNCATE, INSERT, MERGE, ALTER y multi-sentencia.
 */
async function updateOnly(text, params = {}) {
  const t = String(text || '').trim();
  if (/;/.test(t.replace(/;\s*$/, ''))) throw new Error('No se permiten múltiples sentencias.');
  if (!/^update\s+dbo\.ActivoFijo\s+set\b/i.test(t)) {
    throw new Error('Solo se permite UPDATE sobre dbo.ActivoFijo.');
  }
  if (!/\bwhere\s+OID\s*=\s*@oid\b/i.test(t)) {
    throw new Error('El UPDATE debe filtrar por OID.');
  }
  if (/\b(delete|drop|truncate|insert|merge|alter|exec|execute|create|grant)\b/i.test(t)) {
    throw new Error('Sentencia no permitida.');
  }
  const p = await getPool();
  const req = p.request();
  Object.entries(params).forEach(([k, v]) => req.input(k, v));
  const result = await req.query(t);
  return result.rowsAffected?.[0] || 0;
}

/* ── Flotilla — Mantenimiento: tabla propia dbo.IntranetGastosFlotilla ──
 * Solo INSERT y UPDATE ... WHERE OID = @oid sobre esa tabla. Nunca DELETE.
 */
const FLEET_TABLE_DDL = [
  `IF OBJECT_ID('dbo.IntranetGastosFlotilla', 'U') IS NULL
  CREATE TABLE dbo.IntranetGastosFlotilla (
    OID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IntranetGastosFlotilla PRIMARY KEY,
    IntranetId NVARCHAR(30) NOT NULL CONSTRAINT UQ_IntranetGastosFlotilla_IntranetId UNIQUE,
    Placa NVARCHAR(20) NOT NULL,
    Unidad NVARCHAR(300) NULL,
    TipoUnidad NVARCHAR(20) NULL,
    Asignacion NVARCHAR(200) NULL,
    Fecha DATE NOT NULL,
    TipoMantenimiento NVARCHAR(60) NULL,
    Taller NVARCHAR(200) NULL,
    SuplidorOID INT NULL,
    Kilometraje INT NULL,
    Costo DECIMAL(18,2) NOT NULL CONSTRAINT CK_IntranetGastosFlotilla_Costo CHECK (Costo > 0),
    Detalle NVARCHAR(1000) NULL,
    Anulado BIT NOT NULL CONSTRAINT DF_IntranetGastosFlotilla_Anulado DEFAULT 0,
    MotivoAnulacion NVARCHAR(500) NULL,
    RegistradoPor NVARCHAR(150) NOT NULL,
    RegistradoEn DATETIME2 NOT NULL CONSTRAINT DF_IntranetGastosFlotilla_RegistradoEn DEFAULT SYSDATETIME(),
    ActualizadoPor NVARCHAR(150) NULL,
    ActualizadoEn DATETIME2 NULL
  )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_IntranetGastosFlotilla_Placa_Fecha')
  CREATE INDEX IX_IntranetGastosFlotilla_Placa_Fecha ON dbo.IntranetGastosFlotilla (Placa, Fecha)`,
];

async function fleetTableExists() {
  const rows = await query(`SELECT CASE WHEN OBJECT_ID('dbo.IntranetGastosFlotilla', 'U') IS NULL THEN 0 ELSE 1 END AS ok`);
  return !!(rows[0] && rows[0].ok);
}

async function createFleetTable() {
  const p = await getPool();
  for (const stmt of FLEET_TABLE_DDL) await p.request().query(stmt);
  return fleetTableExists();
}

async function fleetWrite(text, params = {}) {
  const t = String(text || '').trim();
  if (/;/.test(t.replace(/;\s*$/, ''))) throw new Error('No se permiten múltiples sentencias.');
  const isInsert = /^insert\s+into\s+dbo\.IntranetGastosFlotilla\s*\(/i.test(t);
  const isUpdate = /^update\s+dbo\.IntranetGastosFlotilla\s+set\b/i.test(t) && /\bwhere\s+OID\s*=\s*@oid\s*$/i.test(t);
  if (!isInsert && !isUpdate) throw new Error('Solo se permite INSERT o UPDATE (por OID) en dbo.IntranetGastosFlotilla.');
  if (/\b(delete|drop|truncate|merge|alter|exec|execute|create|grant)\b/i.test(t)) throw new Error('Sentencia no permitida.');
  const p = await getPool();
  const req = p.request();
  Object.entries(params).forEach(([k, v]) => req.input(k, v));
  const result = await req.query(t);
  return { rowsAffected: result.rowsAffected?.[0] || 0, recordset: result.recordset || [] };
}

module.exports = {
  isConfigured, authMode, getPool, query, status, updateOnly,
  fleetTableExists, createFleetTable, fleetWrite,
};
