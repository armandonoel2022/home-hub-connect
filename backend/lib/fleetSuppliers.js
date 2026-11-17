/**
 * Talleres de Flotilla — Mantenimiento ↔ Suplidores de Adonis (SafeOne, tabla Suplidor).
 * Funciones puras: comparar nombres escritos en la intranet ("La Chercha", "La Chercha SRL")
 * con el nombre oficial del suplidor ("MOTO REPUESTOS LA CHERCHA SRL").
 * SafeOne solo se lee; el vínculo taller ↔ suplidor se guarda en la intranet.
 */
const STOP = new Set([
  'la', 'el', 'los', 'las', 'de', 'del', 'y', 'e', 'en', 'srl', 'sa', 'sas', 'eirl', 'cxa', 'c', 'por', 'a',
  'inc', 'sr', 's', 'r', 'l', 'taller', 'talleres', 'servicio', 'servicios', 'caja', 'chica',
]);

/** Palabras significativas del nombre: sin acentos, puntuación, artículos ni sufijos de sociedad. */
function nameTokens(name) {
  const clean = String(name == null ? '' : name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bs\s*\.?\s*r\s*\.?\s*l\b\.?/g, ' ')
    .replace(/\bc\s*\.?\s*x\s*\.?\s*a\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ');
  const out = [];
  for (const t of clean.split(' ')) {
    if (t.length < 2 || STOP.has(t) || out.includes(t)) continue;
    out.push(t);
  }
  return out;
}
const nameKey = (name) => nameTokens(name).join(' ');
/** Palabras demasiado comunes para identificar por sí solas a un taller. */
const WEAK = new Set(['moto', 'motos', 'repuesto', 'repuestos', 'auto', 'autos', 'mecanica', 'mecanico', 'centro', 'grupo', 'motor', 'motores', 'comercial', 'importadora', 'ferreteria']);

/**
 * Busca el suplidor que corresponde a un nombre de taller.
 * Devuelve { oid, nombre, score, exacto } o null si no hay coincidencia confiable.
 * Regla: el suplidor debe contener al menos 2/3 de las palabras del taller y compartir
 * al menos una palabra distintiva de 4+ letras (no "moto", "repuestos"…).
 */
function matchSupplier(name, suppliers) {
  const toks = nameTokens(name);
  if (!toks.length) return null;
  const key = toks.join(' ');
  let best = null;
  for (const s of suppliers || []) {
    if (!s || s.oid == null) continue;
    const st = nameTokens(s.nombre);
    if (!st.length) continue;
    if (st.join(' ') === key) return { oid: Number(s.oid), nombre: s.nombre, score: 1, exacto: true };
    const inter = toks.filter((t) => st.includes(t));
    if (!inter.some((t) => t.length >= 4 && !WEAK.has(t))) continue;
    const coverage = inter.length / toks.length;
    if (coverage < 0.66) continue;
    const precision = inter.length / st.length;
    const score = Math.round((coverage * 0.8 + precision * 0.2) * 1000) / 1000;
    if (!best || score > best.score) best = { oid: Number(s.oid), nombre: s.nombre, score, exacto: false };
  }
  return best;
}

/**
 * Agrupa los talleres escritos en los gastos (sin anulados) y sugiere el suplidor oficial.
 * Cada grupo: { nombre, variantes[], cantidad, monto, tallerOid, sugerencia }.
 */
function groupTalleres(entries, suppliers, aliases) {
  const groups = new Map();
  for (const e of entries || []) {
    if (!e || e.anulado) continue;
    const nombre = String(e.taller || '').trim();
    if (!nombre) continue;
    const k = nameKey(nombre) || nombre.toLowerCase();
    const g = groups.get(k) || { clave: k, nombre, variantes: [], cantidad: 0, monto: 0, oids: new Set() };
    if (!g.variantes.includes(nombre)) g.variantes.push(nombre);
    if (e.tallerOriginal && !g.variantes.includes(e.tallerOriginal)) g.variantes.push(e.tallerOriginal);
    g.cantidad += 1;
    g.monto = Math.round((g.monto + (Number(e.costo) || 0)) * 100) / 100;
    if (e.tallerOid != null) g.oids.add(Number(e.tallerOid));
    groups.set(k, g);
  }
  const byOid = new Map((suppliers || []).map((s) => [Number(s.oid), s]));
  return [...groups.values()].map((g) => {
    const linkedOid = g.oids.size === 1 ? [...g.oids][0] : null;
    const alias = aliases && aliases[g.clave];
    let sugerencia = null;
    if (linkedOid != null && byOid.has(linkedOid)) sugerencia = { oid: linkedOid, nombre: byOid.get(linkedOid).nombre, score: 1, exacto: true };
    else if (alias && byOid.has(Number(alias.oid))) sugerencia = { oid: Number(alias.oid), nombre: byOid.get(Number(alias.oid)).nombre, score: 1, exacto: true };
    else sugerencia = matchSupplier(g.nombre, suppliers);
    return {
      clave: g.clave, nombre: g.nombre, variantes: g.variantes, cantidad: g.cantidad, monto: g.monto,
      tallerOid: linkedOid, sugerencia,
    };
  }).sort((a, b) => b.monto - a.monto);
}

module.exports = { nameTokens, nameKey, matchSupplier, groupTalleres };
