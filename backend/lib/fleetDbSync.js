/**
 * Reglas puras para llevar los gastos de Flotilla — Mantenimiento (intranet)
 * a la base SafeOne, tabla propia dbo.IntranetGastosFlotilla.
 * Sin dependencias de Express ni SQL para poder probarlas.
 *
 *  - Solo Chrisnel Fabián (OWNER_EMAIL) y las personas que ella designe pueden
 *    comparar y registrar. Solo Chrisnel puede designar.
 *  - Cada gasto se identifica en la base por su ID de la intranet (FM-xxxx),
 *    así nunca se registra dos veces.
 *  - Nada se borra en la base: lo que ya no existe en la intranet se "anula".
 */
const OWNER_EMAIL = 'cfabian@safeone.com.do';
const TABLE = 'dbo.IntranetGastosFlotilla';

const normEmail = (e) => String(e == null ? '' : e).trim().toLowerCase();
const normalizePlaca = (p) => String(p == null ? '' : p).toUpperCase().replace(/[\s\-.]/g, '');
const textKey = (n) => String(n == null ? '' : n)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\bs\.?\s*r\.?\s*l\.?\b/g, '').replace(/[^a-z0-9]/g, '');

function isOwner(user) {
  return normEmail(user && user.email) === OWNER_EMAIL;
}

function cleanDelegates(list) {
  const out = [];
  for (const e of Array.isArray(list) ? list : []) {
    const n = normEmail(e);
    if (n && n.includes('@') && n !== OWNER_EMAIL && !out.includes(n)) out.push(n);
  }
  return out;
}

function canSync(user, acl) {
  if (!user || !normEmail(user.email)) return false;
  if (isOwner(user)) return true;
  return cleanDelegates(acl && acl.delegates).includes(normEmail(user.email));
}

function toIsoDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}
const money = (v) => Math.round((Number(v) || 0) * 100) / 100;
const str = (v) => { const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return s || null; };
const intOrNull = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };

/** Campos que se comparan entre la intranet y la base. */
const FIELDS = [
  { key: 'placa', label: 'Placa', fromEntry: (e) => normalizePlaca(e.placa), fromRow: (r) => normalizePlaca(r.Placa) },
  { key: 'fecha', label: 'Fecha', fromEntry: (e) => toIsoDate(e.fecha), fromRow: (r) => toIsoDate(r.Fecha) },
  { key: 'costo', label: 'Costo', fromEntry: (e) => money(e.costo), fromRow: (r) => money(r.Costo) },
  { key: 'taller', label: 'Taller', fromEntry: (e) => str(e.taller), fromRow: (r) => str(r.Taller) },
  { key: 'tipoMant', label: 'Tipo', fromEntry: (e) => str(e.tipoMant), fromRow: (r) => str(r.TipoMantenimiento) },
  { key: 'kilometraje', label: 'Kilometraje', fromEntry: (e) => intOrNull(e.kilometraje), fromRow: (r) => intOrNull(r.Kilometraje) },
  { key: 'detalle', label: 'Detalle', fromEntry: (e) => str(e.detalle), fromRow: (r) => str(r.Detalle) },
];

function diffEntry(entry, row) {
  const diffs = [];
  for (const f of FIELDS) {
    const a = f.fromEntry(entry);
    const b = f.fromRow(row);
    if (a !== b) diffs.push({ campo: f.key, etiqueta: f.label, intranet: a, baseDatos: b });
  }
  return diffs;
}

function summarizeEntry(e) {
  return {
    id: String(e.id || ''),
    placa: normalizePlaca(e.placa),
    fecha: toIsoDate(e.fecha),
    costo: money(e.costo),
    taller: str(e.taller),
    tipoMant: str(e.tipoMant),
    kilometraje: intOrNull(e.kilometraje),
    detalle: str(e.detalle),
    unidad: str(e.unit),
  };
}
function summarizeRow(r) {
  return {
    oid: Number(r.OID),
    intranetId: str(r.IntranetId),
    placa: normalizePlaca(r.Placa),
    fecha: toIsoDate(r.Fecha),
    costo: money(r.Costo),
    taller: str(r.Taller),
    tipoMant: str(r.TipoMantenimiento),
    suplidorOid: r.SuplidorOID == null ? null : Number(r.SuplidorOID),
    anulado: !!r.Anulado,
    registradoPor: str(r.RegistradoPor),
    registradoEn: r.RegistradoEn instanceof Date ? r.RegistradoEn.toISOString() : str(r.RegistradoEn),
  };
}

/** Clave para detectar el mismo gasto digitado dos veces en la intranet. */
const duplicateKey = (e) => [normalizePlaca(e.placa), toIsoDate(e.fecha), money(e.costo).toFixed(2), textKey(e.taller)].join('|');

/**
 * Compara los gastos de la intranet con las filas de la tabla en SafeOne.
 * Estados: pendiente (solo intranet), diferente, sincronizado, anulado_bd,
 * solo_bd (está en la base pero ya no en la intranet).
 */
function compareRecords(entries, dbRows, suplidorMatcher) {
  const list = Array.isArray(entries) ? entries.filter((e) => e && e.id) : [];
  const rows = Array.isArray(dbRows) ? dbRows : [];
  const byId = new Map();
  for (const r of rows) if (r && r.IntranetId != null) byId.set(String(r.IntranetId), r);
  const dupCount = new Map();
  for (const e of list) { const k = duplicateKey(e); dupCount.set(k, (dupCount.get(k) || 0) + 1); }

  const seen = new Set();
  const items = list.map((e) => {
    const intranet = summarizeEntry(e);
    const suplidor = suplidorMatcher ? suplidorMatcher(e.taller) : null;
    const base = { intranet, suplidor, posibleDuplicado: (dupCount.get(duplicateKey(e)) || 0) > 1 };
    const row = byId.get(String(e.id));
    if (!row) return { ...base, estado: 'pendiente', baseDatos: null, diferencias: [] };
    seen.add(String(e.id));
    if (row.Anulado) return { ...base, estado: 'anulado_bd', baseDatos: summarizeRow(row), diferencias: [] };
    const diferencias = diffEntry(e, row);
    return { ...base, estado: diferencias.length ? 'diferente' : 'sincronizado', baseDatos: summarizeRow(row), diferencias };
  });
  for (const r of rows) {
    if (!r || r.Anulado || seen.has(String(r.IntranetId))) continue;
    items.push({ estado: 'solo_bd', intranet: null, baseDatos: summarizeRow(r), diferencias: [], suplidor: null, posibleDuplicado: false });
  }

  const resumen = {};
  for (const st of ['pendiente', 'diferente', 'sincronizado', 'solo_bd', 'anulado_bd']) {
    const sel = items.filter((i) => i.estado === st);
    resumen[st] = { cantidad: sel.length, monto: money(sel.reduce((s, i) => s + ((i.intranet || i.baseDatos).costo || 0), 0)) };
  }
  return { items, resumen };
}

/** Crea un buscador de suplidor oficial por nombre (sin acentos, sin SRL). */
function makeSuplidorMatcher(suplidores) {
  const map = new Map();
  for (const s of Array.isArray(suplidores) ? suplidores : []) {
    const k = textKey(s.Nombre);
    if (k && !map.has(k)) map.set(k, { oid: Number(s.OID), nombre: str(s.Nombre) });
  }
  return (taller) => map.get(textKey(taller)) || null;
}

/** Valida un gasto antes de escribirlo y devuelve los parámetros SQL. */
function toDbParams(entry, suplidor, userLabel) {
  const s = summarizeEntry(entry);
  if (!s.id) return { error: 'El gasto no tiene ID de la intranet.' };
  if (!s.placa) return { error: `${s.id}: falta la placa.` };
  if (!s.fecha) return { error: `${s.id}: la fecha no es válida.` };
  if (!(s.costo > 0)) return { error: `${s.id}: el costo debe ser mayor que cero.` };
  return {
    params: {
      IntranetId: s.id.slice(0, 30),
      Placa: s.placa.slice(0, 20),
      Unidad: s.unidad ? s.unidad.slice(0, 300) : null,
      TipoUnidad: str(entry.kind) ? str(entry.kind).slice(0, 20) : null,
      Asignacion: str(entry.asignacion) ? str(entry.asignacion).slice(0, 200) : null,
      Fecha: s.fecha,
      TipoMantenimiento: s.tipoMant ? s.tipoMant.slice(0, 60) : null,
      Taller: s.taller ? s.taller.slice(0, 200) : null,
      SuplidorOID: suplidor && Number.isFinite(suplidor.oid) ? suplidor.oid : null,
      Kilometraje: s.kilometraje,
      Costo: s.costo,
      Detalle: s.detalle ? s.detalle.slice(0, 1000) : null,
      Usuario: String(userLabel || 'Intranet').slice(0, 150),
    },
  };
}

module.exports = {
  OWNER_EMAIL, TABLE, normEmail, isOwner, canSync, cleanDelegates,
  compareRecords, diffEntry, makeSuplidorMatcher, toDbParams, toIsoDate, normalizePlaca,
};
