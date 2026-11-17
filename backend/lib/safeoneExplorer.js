/**
 * Reglas puras del Explorador SafeOne (solo lectura).
 * - Solo Armando Noel, la cuenta de Tecnología y Chrisnel Fabián pueden abrirlo.
 * - Los nombres de tabla/columna solo se aceptan si existen en el catálogo de la base.
 * - Nunca se devuelven columnas binarias (imágenes, firmas) y los textos largos se recortan.
 */
const EXPLORER_EMAILS = ['anoel@safeone.com.do', 'tecnologia@safeone.com.do', 'cfabian@safeone.com.do'];
const BINARY_TYPES = new Set(['image', 'varbinary', 'binary', 'timestamp', 'rowversion', 'geography', 'geometry', 'hierarchyid']);
const MAX_TEXT = 500;

const normEmail = (e) => String(e == null ? '' : e).trim().toLowerCase();
function canExplore(user) {
  return EXPLORER_EMAILS.includes(normEmail(user && user.email));
}

/** Devuelve el nombre exacto (con su mayúscula/minúscula) si existe en la lista; si no, null. */
function resolveName(name, known) {
  const n = String(name == null ? '' : name).trim().toLowerCase();
  if (!n) return null;
  return (known || []).find((k) => String(k).toLowerCase() === n) || null;
}
const bracket = (name) => `[${String(name).replace(/]/g, ']]')}]`;

function serializeValue(v) {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v) ? null : v.toISOString();
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) return `[binario ${v.length} bytes]`;
  if (typeof v === 'string') return v.length > MAX_TEXT ? `${v.slice(0, MAX_TEXT)}…` : v;
  if (typeof v === 'bigint') return v.toString();
  return v;
}
function serializeRows(rows) {
  return (rows || []).map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) o[k] = serializeValue(v);
    return o;
  });
}

/** Tablas cuyo último número interno cambió entre la foto y ahora. */
function diffIdentities(before, now) {
  const out = [];
  const prev = before || {};
  for (const [tabla, ultimo] of Object.entries(now || {})) {
    const antes = prev[tabla] == null ? null : Number(prev[tabla]);
    const actual = ultimo == null ? null : Number(ultimo);
    if (actual == null) continue;
    if (antes == null || actual > antes) out.push({ tabla, antes, actual, nuevos: antes == null ? null : actual - antes });
  }
  return out.sort((a, b) => (b.nuevos || 0) - (a.nuevos || 0) || a.tabla.localeCompare(b.tabla));
}

module.exports = { EXPLORER_EMAILS, BINARY_TYPES, canExplore, resolveName, bracket, serializeRows, diffIdentities };
