/**
 * Análisis de facturación de clientes (SafeOne / Adonis) — reglas puras.
 * No accede a la base: recibe filas ya leídas (solo lectura) y calcula.
 *
 * Principios (del diagnóstico solicitado por Gerencia General):
 * - La clasificación por servicio se ESTIMA por palabras del concepto; siempre queda "pendiente de validación".
 * - Una tarifa recurrente solo se sugiere si el mismo importe (±2 %) se repite en 3+ meses distintos.
 * - La frecuencia se basa en meses con facturación, no en cantidad de facturas.
 * - Clientes excluidos de monitoreo (p. ej. ANTARES DEL CARIBE / Galería 360) nunca suman a monitoreo.
 * - No se completa información faltante: lo que falta se reporta en Calidad de datos.
 */

const CATEGORIES = {
  monitoreo: { label: 'Monitoreo de alarmas', recurrente: true },
  electronica_monitoreo: { label: 'Seguridad electrónica y monitoreo', recurrente: true },
  electronica: { label: 'Seguridad electrónica', recurrente: true },
  videoportero: { label: 'VideoPortero', recurrente: true },
  video: { label: 'Videovigilancia / CCTV', recurrente: false },
  gps: { label: 'GPS / Rastreo', recurrente: true },
  acceso: { label: 'Control de acceso / asistencia', recurrente: false },
  vigilancia: { label: 'Vigilancia física', recurrente: true },
  instalacion: { label: 'Instalaciones', recurrente: false },
  mantenimiento: { label: 'Mantenimiento / servicio técnico', recurrente: false },
  adicionales: { label: 'Servicios adicionales / eventos', recurrente: false },
  equipos: { label: 'Venta de equipos', recurrente: false },
  otros: { label: 'Otros conceptos', recurrente: false },
  sin_concepto: { label: 'Sin concepto', recurrente: false },
};

// Orden = prioridad. La primera regla que coincide define la categoría.
const RULES = [
  ['instalacion', /\binstala/],
  ['equipos', /\bsistemas? de (alarma|camaras|cctv|video)|\bkit\b/],
  ['mantenimiento', /\bmanten|\breparaci|\bsoporte\b|\bvisitas? tecnicas?|\bservicios? tecnicos?|\bchequeo|\brevision tecnica|\bcambio de bateria/],
  ['adicionales', /\badicional|\bevento|\bhoras faltantes/],
  ['videoportero', /video\s*-?\s*portero|\bportero\b|\bintercom/],
  ['gps', /\bgps\b|\brastreo|\blocalizador/],
  ['monitoreo', /\bmonitore|\balarma|\bpanel\b|\bsenal(es)?\b|\bboton de panico|\bcentral de monitoreo|\brespuesta armada/],
  ['video', /\bcctv\b|\bcamara|\bvideo\s*vigil|\bdvr\b|\bnvr\b|\bvideo\b/],
  ['acceso', /control de acceso|\blectora|\bcerradura|\bbiometric|\basistencia|\breloj|\bponchador|\btorniquete/],
  ['vigilancia', /\bvigilan|\bseguridad fisica|\bguardia|\bagente|\bpuesto|\bescolta|\boficial|\bsupervisor|\bservicio de seguridad|\bhoras? extra|\bseguridad\b|\bturno/],
  ['equipos', /\bventa\b|\bequipo|\bsensor|\bdetector|\bsirena|\bteclado|\bbateria|\bcable|\bmaterial/],
];

const EXCLUDED_FROM_MONITORING = [
  { pattern: /antares del caribe|galeria\s*360/, motivo: 'Puestos de vigilancia física (Galería 360); no es monitoreo de alarmas.' },
];

function fold(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function classifyConcept(text) {
  const t = fold(text);
  if (!t) return { categoria: 'sin_concepto', palabra: null };
  for (const [cat, re] of RULES) {
    const m = t.match(re);
    if (m) return { categoria: cat, palabra: m[0].trim() };
  }
  return { categoria: 'otros', palabra: null };
}

// Conceptos que describen el servicio por sí mismos; el resto ("Factura mes de abril")
// toma la línea de negocio de la clasificación del cliente en SafeOne.
const SPECIFIC = new Set(['instalacion', 'mantenimiento', 'adicionales', 'videoportero', 'gps', 'video', 'acceso', 'equipos']);
const MONITORING = new Set(['monitoreo', 'electronica_monitoreo']);

/** Línea de negocio según Cliente.ClasificacionCliente (SafeOne). */
function categoryFromClient(clasificacion) {
  const t = fold(clasificacion);
  if (!t) return null;
  if (/vigilancia|fisica/.test(t)) return 'vigilancia';
  if (/electronic/.test(t) && /monitore/.test(t)) return 'electronica_monitoreo';
  if (/monitore|alarma/.test(t)) return 'monitoreo';
  if (/electronic/.test(t)) return 'electronica';
  return null;
}

/** Categoría final de una factura: concepto específico primero, luego la clasificación del cliente. */
function invoiceCategory(comentario, clasificacion) {
  const c = classifyConcept(comentario);
  if (SPECIFIC.has(c.categoria)) return { ...c, origen: 'concepto' };
  const byClient = categoryFromClient(clasificacion);
  if (byClient) return { categoria: byClient, palabra: null, origen: 'clasificacion' };
  return { ...c, origen: 'concepto' };
}

function exclusionFor(nombre) {
  const t = fold(nombre);
  const hit = EXCLUDED_FROM_MONITORING.find((e) => e.pattern.test(t));
  return hit ? hit.motivo : null;
}

const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function toDate(v) {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? null : d;
}
const isoDay = (d) => d.toISOString().slice(0, 10);
const monthKey = (d) => d.toISOString().slice(0, 7);

function median(values) {
  const a = values.filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function quantile(values, q) {
  const a = values.filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return null;
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

function monthsBetween(a, b) {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + 1;
}

/** recurrente / ocasional / aislada según meses con facturación. */
function frequencyOf(monthKeys) {
  const months = [...new Set(monthKeys)].sort();
  if (months.length <= 1) return 'aislada';
  const first = new Date(`${months[0]}-01T00:00:00Z`);
  const last = new Date(`${months[months.length - 1]}-01T00:00:00Z`);
  const span = monthsBetween(first, last);
  if (months.length >= 3 && months.length / span >= 0.6) return 'recurrente';
  return 'ocasional';
}

/**
 * Importes que se repiten (±2 %) en 3 o más meses distintos.
 * Devuelve candidatos ordenados por meses (desc). Siempre "estimada – pendiente de validación".
 */
function estimateTariffs(invoices, { tolerance = 0.02, minMonths = 3 } = {}) {
  const items = invoices.filter((i) => i.bruto > 0 && i.mes).sort((a, b) => a.bruto - b.bruto);
  const clusters = [];
  for (const it of items) {
    const c = clusters[clusters.length - 1];
    if (c && Math.abs(it.bruto - c.base) <= c.base * tolerance) c.items.push(it);
    else clusters.push({ base: it.bruto, items: [it] });
  }
  return clusters
    .map((c) => {
      const meses = [...new Set(c.items.map((i) => i.mes))].sort();
      const importe = median(c.items.map((i) => i.bruto));
      const cats = {};
      c.items.forEach((i) => { cats[i.categoria] = (cats[i.categoria] || 0) + 1; });
      const categoria = Object.entries(cats).sort((a, b) => b[1] - a[1])[0][0];
      return { importe: r2(importe), meses: meses.length, facturas: c.items.length, desde: meses[0], hasta: meses[meses.length - 1], categoria, estado: 'Estimada – pendiente de validación' };
    })
    .filter((c) => c.meses >= minMonths)
    .sort((a, b) => b.meses - a.meses || b.importe - a.importe);
}

function distribution(values) {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return { n: 0, min: null, p25: null, mediana: null, p75: null, max: null, promedio: null };
  return {
    n: v.length,
    min: r2(Math.min(...v)), p25: r2(quantile(v, 0.25)), mediana: r2(median(v)),
    p75: r2(quantile(v, 0.75)), max: r2(Math.max(...v)), promedio: r2(v.reduce((a, b) => a + b, 0) / v.length),
  };
}

/**
 * @param {object} p
 * @param {Array} p.facturas  { oid?, numero, ncf?, fecha, bruto, itbis, neto, cliente, comentario }
 * @param {Array} p.clientes  { oid, nombre, rnc?, codigo?, clasificacion?, inactivo? }
 * @param {Array} [p.lineas]  { factura, descripcion, cantidad, precio, monto }
 */
function analyze({ facturas = [], clientes = [], lineas = null, desde = null, hasta = null } = {}) {
  const calidad = [];
  const issue = (tipo, detalle, ref) => calidad.push({ tipo, detalle, ref: ref || null });
  const clientById = new Map(clientes.map((c) => [String(c.oid), c]));

  // ── Facturas normalizadas ──
  const seenNumero = new Map();
  const invoices = [];
  for (const f of facturas) {
    const ref = f.numero != null && f.numero !== '' ? String(f.numero) : (f.oid != null ? `OID ${f.oid}` : '—');
    const fecha = toDate(f.fecha);
    const bruto = num(f.bruto), itbis = num(f.itbis), neto = num(f.neto);
    if (!fecha) { issue('Fecha inválida', 'La factura no tiene fecha válida; no se incluyó en el análisis.', ref); continue; }
    if (bruto == null) { issue('Monto vacío', 'La factura no tiene monto bruto; no se incluyó.', ref); continue; }
    const key = `${ref}|${f.cliente}`;
    if (f.numero != null && f.numero !== '' && seenNumero.has(key)) issue('Factura duplicada', 'Número de factura repetido para el mismo cliente.', ref);
    seenNumero.set(key, true);
    if (bruto <= 0) issue('Monto cero o negativo', `Bruto RD$${r2(bruto)} (posible nota de crédito o ajuste).`, ref);
    if (itbis != null && neto != null && Math.abs(bruto + itbis - neto) > 1) {
      issue('Totales no cuadran', `Bruto ${r2(bruto)} + ITBIS ${r2(itbis)} ≠ Neto ${r2(neto)} (puede haber descuentos o retenciones).`, ref);
    }
    const cli = clientById.get(String(f.cliente));
    if (!cli) issue('Cliente no encontrado', `La factura apunta al cliente ${f.cliente ?? '—'} que no existe o está eliminado.`, ref);
    const comentario = f.comentario == null ? '' : String(f.comentario).trim();
    const { categoria, palabra, origen } = invoiceCategory(comentario, cli && cli.clasificacion);
    if (!comentario) issue('Sin concepto', 'La factura no tiene comentario/concepto para identificar el servicio.', ref);
    invoices.push({
      oid: f.oid ?? null, numero: ref, ncf: f.ncf ?? null, fecha: isoDay(fecha), mes: monthKey(fecha),
      bruto: r2(bruto), itbis: r2(itbis || 0), neto: r2(neto != null ? neto : bruto + (itbis || 0)),
      cliente: f.cliente == null ? null : String(f.cliente), comentario, categoria, palabra, origen,
    });
  }

  // RNC repetido en clientes distintos
  const byRnc = new Map();
  for (const c of clientes) {
    const rnc = String(c.rnc || '').replace(/\D/g, '');
    if (!rnc) continue;
    if (!byRnc.has(rnc)) byRnc.set(rnc, []);
    byRnc.get(rnc).push(c);
  }
  for (const [rnc, list] of byRnc) {
    if (list.length > 1) issue('Cliente duplicado', `El RNC ${rnc} está en ${list.length} clientes: ${list.map((c) => c.nombre).join(' / ')}.`, rnc);
  }

  // ── Por cliente ──
  const totalBruto = invoices.reduce((a, i) => a + i.bruto, 0);
  const groups = new Map();
  for (const i of invoices) {
    const k = i.cliente || 'sin-cliente';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  }
  const porCliente = [];
  for (const [k, list] of groups) {
    const c = clientById.get(k) || {};
    const nombre = c.nombre || (k === 'sin-cliente' ? '(Sin cliente)' : `Cliente ${k}`);
    const excluido = exclusionFor(nombre);
    const sorted = [...list].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : String(b.numero).localeCompare(String(a.numero))));
    const meses = [...new Set(list.map((i) => i.mes))].sort();
    const bruto = list.reduce((a, i) => a + i.bruto, 0);
    const categorias = {};
    for (const i of list) {
      const cat = excluido && (MONITORING.has(i.categoria) || i.categoria === 'videoportero') ? 'vigilancia' : i.categoria;
      categorias[cat] = r2((categorias[cat] || 0) + i.bruto);
    }
    const principal = Object.entries(categorias).sort((a, b) => b[1] - a[1])[0]?.[0] || 'sin_concepto';
    const span = meses.length ? monthsBetween(new Date(`${meses[0]}-01T00:00:00Z`), new Date(`${meses[meses.length - 1]}-01T00:00:00Z`)) : 0;
    porCliente.push({
      cliente: k, nombre, rnc: c.rnc || null, codigo: c.codigo || null, clasificacion: c.clasificacion || null,
      inactivo: c.inactivo == null ? null : !!c.inactivo,
      facturas: list.length, meses: meses.length,
      primera: sorted[sorted.length - 1]?.fecha || null, ultima: sorted[0]?.fecha || null,
      facturasPorMes: span ? r2(list.length / span) : null,
      frecuencia: frequencyOf(list.map((i) => i.mes)),
      bruto: r2(bruto), itbis: r2(list.reduce((a, i) => a + i.itbis, 0)), neto: r2(list.reduce((a, i) => a + i.neto, 0)),
      promedio: r2(bruto / list.length), mediana: r2(median(list.map((i) => i.bruto))),
      participacion: totalBruto ? r2((bruto / totalBruto) * 100) : 0,
      categorias, categoriaPrincipal: principal,
      excluidoMonitoreo: excluido,
      tarifas: estimateTariffs(list),
      ultimas: sorted.slice(0, 3).map(({ numero, ncf, fecha, comentario, bruto: b, itbis, neto, categoria }) => ({ numero, ncf, fecha, comentario, bruto: b, itbis, neto, categoria })),
      porMes: meses.map((m) => ({ mes: m, bruto: r2(list.filter((i) => i.mes === m).reduce((a, i) => a + i.bruto, 0)), facturas: list.filter((i) => i.mes === m).length })),
      historial: sorted.map(({ numero, ncf, fecha, comentario, bruto: b, itbis, neto, categoria }) => ({ numero, ncf, fecha, comentario, bruto: b, itbis, neto, categoria })),
    });
  }
  porCliente.sort((a, b) => b.bruto - a.bruto);
  const excluded = new Set(porCliente.filter((c) => c.excluidoMonitoreo).map((c) => c.cliente));
  const catOf = (i) => (excluded.has(i.cliente) && (MONITORING.has(i.categoria) || i.categoria === 'videoportero') ? 'vigilancia' : i.categoria);

  // Clientes de monitoreo cuya mensualidad típica es muy superior a la del resto (p. ej. RD$130k vs RD$1,653):
  // probablemente tienen puestos de vigilancia u otra línea. No suman a monitoreo hasta validarlos.
  const monthlyTypical = (c, cats) => {
    const byMonth = {};
    c.historial.filter((i) => cats.has(i.categoria)).forEach((i) => { byMonth[i.fecha.slice(0, 7)] = (byMonth[i.fecha.slice(0, 7)] || 0) + i.bruto; });
    return median(Object.values(byMonth));
  };
  const monClients = porCliente.filter((c) => !c.excluidoMonitoreo && MONITORING.has(c.categoriaPrincipal));
  monClients.forEach((c) => { c.mensualTipica = r2(monthlyTypical(c, MONITORING)); });
  const segMedian = median(monClients.map((c) => c.mensualTipica).filter((v) => v > 0)) || 0;
  const porValidar = new Set();
  monClients.forEach((c) => {
    if (segMedian && c.mensualTipica >= 20000 && c.mensualTipica > segMedian * 10) {
      c.clasificacionPorValidar = `Mensualidad típica ${'RD$'}${Math.round(c.mensualTipica).toLocaleString('en-US')} frente a ${'RD$'}${Math.round(segMedian).toLocaleString('en-US')} del resto de monitoreo; confirmar si es monitoreo o vigilancia.`;
      porValidar.add(c.cliente);
      issue('Clasificación por validar', `${c.nombre}: ${c.clasificacionPorValidar}`, c.codigo || c.cliente);
    }
  });
  const isMonitoring = (i) => MONITORING.has(catOf(i)) && !porValidar.has(i.cliente);

  // Por línea de negocio (clasificación del cliente en SafeOne).
  const lineMap = new Map();
  porCliente.forEach((c) => {
    const k = c.clasificacion ? String(c.clasificacion).trim() : '(sin clasificación)';
    const l = lineMap.get(k) || { clasificacion: k, clientes: 0, facturas: 0, bruto: 0 };
    l.clientes += 1; l.facturas += c.facturas; l.bruto += c.bruto;
    lineMap.set(k, l);
  });
  const porLinea = [...lineMap.values()].map((l) => ({ ...l, bruto: r2(l.bruto), participacion: totalBruto ? r2((l.bruto / totalBruto) * 100) : 0 }))
    .sort((a, b) => b.bruto - a.bruto);

  // ── Mensual ──
  const mesesAll = [...new Set(invoices.map((i) => i.mes))].sort();
  const mensual = mesesAll.map((m) => {
    const list = invoices.filter((i) => i.mes === m);
    const cats = {};
    list.forEach((i) => { const c = catOf(i); cats[c] = r2((cats[c] || 0) + i.bruto); });
    return { mes: m, bruto: r2(list.reduce((a, i) => a + i.bruto, 0)), neto: r2(list.reduce((a, i) => a + i.neto, 0)), facturas: list.length, clientes: new Set(list.map((i) => i.cliente)).size, ...cats };
  });
  mensual.forEach((m, idx) => {
    const prev = mensual[idx - 1];
    m.variacion = prev && prev.bruto ? r2(((m.bruto - prev.bruto) / prev.bruto) * 100) : null;
  });

  // ── Por categoría (precios observados entre clientes) ──
  const porCategoria = Object.keys(CATEGORIES).map((cat) => {
    const list = invoices.filter((i) => catOf(i) === cat);
    if (!list.length) return null;
    const clientsMap = new Map();
    list.forEach((i) => { if (!clientsMap.has(i.cliente)) clientsMap.set(i.cliente, []); clientsMap.get(i.cliente).push(i); });
    const clientesCat = [...clientsMap.entries()].map(([cid, inv]) => {
      const pc = porCliente.find((c) => c.cliente === cid);
      return {
        cliente: cid, nombre: pc?.nombre || cid, facturas: inv.length, meses: new Set(inv.map((i) => i.mes)).size,
        tipico: r2(median(inv.map((i) => i.bruto))), bruto: r2(inv.reduce((a, i) => a + i.bruto, 0)),
        ultimo: [...inv].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0]?.bruto ?? null,
      };
    }).sort((a, b) => b.tipico - a.tipico);
    return {
      categoria: cat, label: CATEGORIES[cat].label, recurrente: CATEGORIES[cat].recurrente,
      facturas: list.length, clientes: clientsMap.size, bruto: r2(list.reduce((a, i) => a + i.bruto, 0)),
      porFactura: distribution(list.map((i) => i.bruto)),
      entreClientes: distribution(clientesCat.map((c) => c.tipico)),
      detalle: clientesCat,
    };
  }).filter(Boolean).sort((a, b) => b.bruto - a.bruto);

  // ── Líneas de factura (si existen) ──
  let porDescripcion = null;
  if (Array.isArray(lineas)) {
    const invByOid = new Map(invoices.filter((i) => i.oid != null).map((i) => [String(i.oid), i]));
    const groupsD = new Map();
    for (const l of lineas) {
      const inv = invByOid.get(String(l.factura));
      if (!inv) continue;
      const desc = String(l.descripcion || '').trim();
      const key = fold(desc) || '(sin descripción)';
      const cantidad = num(l.cantidad);
      let precio = num(l.precio);
      const monto = num(l.monto);
      if (precio == null && monto != null && cantidad) precio = monto / cantidad;
      if (precio == null) continue;
      if (!groupsD.has(key)) groupsD.set(key, { descripcion: desc || '(sin descripción)', rows: [] });
      groupsD.get(key).rows.push({ cliente: inv.cliente, precio, cantidad: cantidad ?? 1, mes: inv.mes, fecha: inv.fecha });
    }
    porDescripcion = [...groupsD.values()].map((g) => {
      const byCli = new Map();
      g.rows.forEach((r) => { if (!byCli.has(r.cliente)) byCli.set(r.cliente, []); byCli.get(r.cliente).push(r); });
      const clientesD = [...byCli.entries()].map(([cid, rows]) => ({
        cliente: cid, nombre: porCliente.find((c) => c.cliente === cid)?.nombre || cid,
        precioTipico: r2(median(rows.map((r) => r.precio))), veces: rows.length,
        ultimo: r2([...rows].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0].precio),
      })).sort((a, b) => b.precioTipico - a.precioTipico);
      const { categoria } = classifyConcept(g.descripcion);
      const dist = distribution(clientesD.map((c) => c.precioTipico));
      return {
        descripcion: g.descripcion, categoria, lineas: g.rows.length, clientes: clientesD.length,
        importe: r2(g.rows.reduce((a, r) => a + r.precio * (r.cantidad || 1), 0)),
        precios: dist,
        dispersion: dist.mediana ? r2(((dist.max - dist.min) / dist.mediana) * 100) : null,
        detalle: clientesD,
      };
    }).sort((a, b) => b.importe - a.importe);
  }

  // ── Totales ──
  const brutoCat = (pred) => r2(invoices.filter(pred).reduce((a, i) => a + i.bruto, 0));
  const recurrente = brutoCat((i) => CATEGORIES[catOf(i)]?.recurrente);
  const top10 = porCliente.slice(0, 10);
  const top10Bruto = top10.reduce((a, c) => a + c.bruto, 0);
  const hhi = porCliente.reduce((a, c) => a + Math.pow(c.participacion, 2), 0);
  const freqCount = (f) => porCliente.filter((c) => c.frecuencia === f).length;

  return {
    periodo: { desde, hasta, meses: mesesAll.length },
    resumen: {
      facturas: invoices.length,
      clientes: porCliente.length,
      bruto: r2(totalBruto),
      itbis: r2(invoices.reduce((a, i) => a + i.itbis, 0)),
      neto: r2(invoices.reduce((a, i) => a + i.neto, 0)),
      promedio: invoices.length ? r2(totalBruto / invoices.length) : 0,
      mediana: r2(median(invoices.map((i) => i.bruto))),
      recurrenteEstimado: recurrente,
      extraordinarioEstimado: r2(totalBruto - recurrente),
      monitoreoEstimado: brutoCat(isMonitoring),
      clientesMonitoreo: new Set(invoices.filter(isMonitoring).map((i) => i.cliente)).size,
      mensualidadMonitoreoMediana: r2(segMedian),
      clientesPorValidar: porValidar.size,
      clientesRecurrentes: freqCount('recurrente'),
      clientesOcasionales: freqCount('ocasional'),
      clientesAislados: freqCount('aislada'),
      top10Participacion: totalBruto ? r2((top10Bruto / totalBruto) * 100) : 0,
      hhi: r2(hhi),
      problemasCalidad: calidad.length,
    },
    categorias: Object.fromEntries(Object.entries(CATEGORIES).map(([k, v]) => [k, v.label])),
    excluidos: porCliente.filter((c) => c.excluidoMonitoreo).map((c) => ({ cliente: c.cliente, nombre: c.nombre, motivo: c.excluidoMonitoreo })),
    mensual,
    porLinea,
    porCliente,
    porCategoria,
    porDescripcion,
    calidad,
  };
}

module.exports = { CATEGORIES, classifyConcept, categoryFromClient, invoiceCategory, exclusionFor, frequencyOf, estimateTariffs, distribution, median, analyze, fold };

// ── Acceso ──
// Por defecto lo ven todos los usuarios de la intranet. El super administrador
// puede activar "restringido" y dejar solo una lista de correos.
const BILLING_SUPER_EMAILS = ['tecnologia@safeone.com.do', 'anoel@safeone.com.do'];
const normEmail = (e) => String(e == null ? '' : e).trim().toLowerCase();
function isBillingSuper(user) {
  return BILLING_SUPER_EMAILS.includes(normEmail(user && user.email));
}
function canViewBilling(user, access) {
  if (!user || !normEmail(user.email)) return false;
  if (isBillingSuper(user)) return true;
  if (!access || !access.restringido) return true;
  return (access.emails || []).map(normEmail).includes(normEmail(user.email));
}
function cleanAccess(body) {
  const emails = [...new Set((Array.isArray(body && body.emails) ? body.emails : [])
    .map(normEmail).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))].sort();
  return { restringido: !!(body && body.restringido), emails };
}

/** Elige la primera columna existente (sin importar mayúsculas) de una lista de candidatas. */
function pickColumn(columns, candidates) {
  const map = new Map((columns || []).map((c) => [String(c).toLowerCase(), c]));
  for (const cand of candidates) {
    const hit = map.get(String(cand).toLowerCase());
    if (hit) return hit;
  }
  return null;
}

module.exports.BILLING_SUPER_EMAILS = BILLING_SUPER_EMAILS;
module.exports.isBillingSuper = isBillingSuper;
module.exports.canViewBilling = canViewBilling;
module.exports.cleanAccess = cleanAccess;
module.exports.pickColumn = pickColumn;
