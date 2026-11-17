/**
 * Reglas puras para comparar los gastos de Flotilla — Mantenimiento (intranet)
 * con las facturas que contabilidad asienta en Adonis (SafeOne, tabla CargosCP).
 * SOLO LECTURA sobre SafeOne: el vínculo gasto ↔ factura se guarda en la intranet.
 *
 *  - Solo Chrisnel Fabián (OWNER_EMAIL) y las personas que ella designe pueden
 *    comparar y vincular. Solo Chrisnel puede designar.
 *  - Contabilidad escribe la placa en las Notas de la factura
 *    (ej. "Reparacion de motocicleta placa k2528728"); con eso se cruza.
 *  - Coincidencia automática: misma placa (o mismo suplidor, si el taller del gasto está
 *    vinculado a un suplidor de Adonis), monto igual al Valor o al Valor+ITBIS (±1 peso)
 *    y fecha a no más de MAX_DAYS días.
 */
const OWNER_EMAIL = 'cfabian@safeone.com.do';
const MAX_DAYS = 20;
const SUGGEST_DAYS = 45;

const normEmail = (e) => String(e == null ? '' : e).trim().toLowerCase();
const normalizePlaca = (p) => String(p == null ? '' : p).toUpperCase().replace(/[^A-Z0-9]/g, '');
const money = (v) => Math.round((Number(v) || 0) * 100) / 100;
const str = (v) => { const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return s || null; };

function isOwner(user) { return normEmail(user && user.email) === OWNER_EMAIL; }
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
const dayDiff = (a, b) => (a && b ? Math.abs((Date.parse(a) - Date.parse(b)) / 86400000) : Infinity);

/** Placas mencionadas en un texto: primero las de la flotilla, luego cualquier patrón de placa. */
function extractPlates(text, knownPlates) {
  const raw = String(text == null ? '' : text).toUpperCase();
  const compact = raw.replace(/[^A-Z0-9]/g, '');
  const found = [];
  for (const p of knownPlates || []) {
    const k = normalizePlaca(p);
    if (k.length >= 6 && compact.includes(k) && !found.includes(k)) found.push(k);
  }
  const re = /\b([A-Z]{1,3})[\s-]?(\d{5,7})\b/g;
  let m;
  while ((m = re.exec(raw))) {
    const k = m[1] + m[2];
    if (!found.includes(k) && !found.some((f) => f.includes(k) || k.includes(f))) found.push(k);
  }
  return found;
}

/** Normaliza una fila de CargosCP (con el nombre del suplidor ya unido). */
function summarizeInvoice(r, knownPlates) {
  const valor = money(r.Valor);
  const itbis = money(r.Itbis);
  return {
    oid: Number(r.OID),
    fecha: toIsoDate(r.FechaFactura) || toIsoDate(r.Fecha),
    suplidorOid: r.Suplidor == null ? null : Number(r.Suplidor),
    suplidor: str(r.SuplidorNombre),
    ncf: str(r.NCF),
    referencia: str(r.Referencia),
    valor,
    itbis,
    total: money(valor + itbis),
    notas: str(r.Notas),
    clasificacion: str(r.ClasificacionCyG),
    cajaChica: !!r.CajaChica,
    placas: extractPlates(r.Notas, knownPlates),
  };
}
function summarizeEntry(e) {
  return {
    id: String(e.id || ''),
    placa: normalizePlaca(e.placa),
    fecha: toIsoDate(e.fecha),
    costo: money(e.costo),
    taller: str(e.taller),
    tipoMant: str(e.tipoMant),
    detalle: str(e.detalle),
    adonisOid: e.adonisOid == null ? null : Number(e.adonisOid),
    tallerOid: e.tallerOid == null ? null : Number(e.tallerOid),
  };
}
/**
 * La factura corresponde al gasto si menciona su placa, o si es del mismo suplidor (taller vinculado)
 * y no menciona ninguna otra placa.
 */
const sameUnitOrSupplier = (e, i) => i.placas.includes(e.placa)
  || (i.placas.length === 0 && e.tallerOid != null && i.suplidorOid === e.tallerOid);
const amountMatches = (costo, inv) => Math.abs(costo - inv.valor) <= 1 || Math.abs(costo - inv.total) <= 1;

/**
 * Cruza gastos de la intranet con facturas de Adonis.
 * Estados: vinculado (confirmado a mano o automático), solo_intranet (con sugerencias),
 * solo_adonis (factura que menciona una placa de la flotilla y no tiene gasto en la intranet).
 */
function compareWithAdonis(entries, invoiceRows, knownPlates) {
  const plates = [...new Set([...(knownPlates || []), ...(entries || []).map((e) => e && e.placa)].map(normalizePlaca).filter(Boolean))];
  const invoices = (invoiceRows || []).map((r) => summarizeInvoice(r, plates));
  const byOid = new Map(invoices.map((i) => [i.oid, i]));
  const used = new Set();
  const list = (entries || []).filter((e) => e && e.id).map(summarizeEntry);
  const items = [];

  // 1) Vínculos confirmados a mano
  const pending = [];
  for (const e of list) {
    const inv = e.adonisOid != null ? byOid.get(e.adonisOid) : null;
    if (inv && !used.has(inv.oid)) { used.add(inv.oid); items.push({ estado: 'vinculado', modo: 'confirmado', intranet: e, adonis: inv, sugerencias: [] }); }
    else pending.push(e);
  }
  // 2) Automáticos: misma placa, mismo monto, fecha cercana (el más cercano primero)
  const rest = [];
  for (const e of pending) {
    const cands = invoices
      .filter((i) => !used.has(i.oid) && sameUnitOrSupplier(e, i) && amountMatches(e.costo, i) && dayDiff(i.fecha, e.fecha) <= MAX_DAYS)
      .sort((a, b) => dayDiff(a.fecha, e.fecha) - dayDiff(b.fecha, e.fecha));
    if (cands.length) { used.add(cands[0].oid); items.push({ estado: 'vinculado', modo: 'automatico', intranet: e, adonis: cands[0], sugerencias: [] }); }
    else rest.push(e);
  }
  // 3) Sin factura: sugerir facturas de la misma placa en fechas cercanas
  for (const e of rest) {
    const sugerencias = invoices
      .filter((i) => !used.has(i.oid) && sameUnitOrSupplier(e, i) && dayDiff(i.fecha, e.fecha) <= SUGGEST_DAYS)
      .sort((a, b) => dayDiff(a.fecha, e.fecha) - dayDiff(b.fecha, e.fecha))
      .slice(0, 3);
    items.push({ estado: 'solo_intranet', modo: null, intranet: e, adonis: null, sugerencias });
  }
  // 4) Facturas que mencionan una placa de la flotilla y nadie reclamó
  const fleetSet = new Set(plates);
  for (const i of invoices) {
    if (used.has(i.oid) || !i.placas.some((p) => fleetSet.has(p))) continue;
    items.push({ estado: 'solo_adonis', modo: null, intranet: null, adonis: i, sugerencias: [] });
  }

  const resumen = {};
  for (const st of ['vinculado', 'solo_intranet', 'solo_adonis']) {
    const sel = items.filter((x) => x.estado === st);
    resumen[st] = {
      cantidad: sel.length,
      monto: money(sel.reduce((s, x) => s + (x.intranet ? x.intranet.costo : x.adonis.total), 0)),
    };
  }
  return { items, resumen };
}

module.exports = {
  OWNER_EMAIL, MAX_DAYS, normEmail, isOwner, canSync, cleanDelegates,
  compareWithAdonis, extractPlates, summarizeInvoice, toIsoDate, normalizePlaca,
};
