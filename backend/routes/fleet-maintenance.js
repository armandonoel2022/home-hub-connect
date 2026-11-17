/**
 * Flotilla SafeOne - Reparación y Mantenimiento
 * Almacena: fleet (unidades), maintenance (registros de gasto), talleres (catálogo)
 * en data/fleet-maintenance.json (sembrado desde public/data/fleet_maintenance_seed.json).
 * Las reglas replican src/lib/fleetMaintenanceRules.ts:
 *  - Un gasto solo se acepta si la placa existe en la Flotilla (o en Flotilla Vehicular).
 *  - El taller se estandariza contra el catálogo.
 *  - El mes se deriva siempre de la fecha.
 *  - El taller puede vincularse a un suplidor de Adonis (SafeOne.dbo.Suplidor, SOLO LECTURA):
 *    se guarda tallerOid y el nombre oficial; el nombre escrito antes queda en tallerOriginal.
 *  - Nada se borra: un gasto eliminado queda anulado con motivo, usuario y fecha.
 *  - Antes de cualquier cambio masivo se guarda un respaldo en data/backups/.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { readData, writeData, generateId, DATA_DIR } = require('../config/database');
const auth = require('../middleware/auth');
const safeoneSql = require('../config/sqlServerSafeOne');
const suppliersLib = require('../lib/fleetSuppliers');

const router = express.Router();
const FILENAME = 'fleet-maintenance.json';
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const PLACA_REGEX = /^[A-Z]{1,3}\d{5,7}$/;
const DEFAULT_TALLERES = [
  'La Chercha, SRL', 'Moto Servic Campe', 'Motocentro La Friusa, SRL', 'Motores del Sur',
  'Grupo Cometa', 'Movilidad Inteligente Marti', 'Taller ambulante (caja chica)',
];
const DATE_FIXES = [{ placa: 'K2546252', from: '2016-03-30', to: '2026-03-30' }];

// ── Respaldo: copia íntegra del archivo antes de cambios automáticos o masivos ──
function backupFile(reason) {
  try {
    const src = path.join(DATA_DIR, FILENAME);
    if (!fs.existsSync(src)) return null;
    const dir = path.join(DATA_DIR, 'backups', 'fleet-maintenance');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(dir, `fleet-maintenance-${stamp}-${String(reason || 'cambio').replace(/[^a-z0-9-]/gi, '')}.json`);
    fs.copyFileSync(src, dest);
    return path.basename(dest);
  } catch (err) {
    console.error('[fleet-maintenance] No se pudo crear el respaldo:', err.message);
    return null;
  }
}

// ── Suplidores de Adonis (SafeOne.dbo.Suplidor) — SOLO LECTURA, en caché 10 min ──
const SUPPLIER_TTL_MS = 10 * 60 * 1000;
let supplierCache = { at: 0, items: null, message: null };
async function loadSuppliers(force) {
  if (!force && supplierCache.items && Date.now() - supplierCache.at < SUPPLIER_TTL_MS) return supplierCache;
  if (!safeoneSql.isConfigured()) {
    supplierCache = { at: Date.now(), items: null, message: 'La conexión a SafeOne no está configurada en el servidor.' };
    return supplierCache;
  }
  try {
    const cols = (await safeoneSql.query(
      `SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Suplidor'`,
    )).map(r => String(r.c));
    const has = c => cols.some(x => x.toLowerCase() === c.toLowerCase());
    if (!has('OID') || !has('Nombre')) throw new Error('La tabla Suplidor no tiene las columnas OID y Nombre.');
    const idCol = ['RNC', 'Rnc', 'Cedula', 'TaxId'].find(has);
    const rows = await safeoneSql.query(
      `SELECT OID, Nombre${idCol ? `, ${idCol} AS Documento` : ''} FROM dbo.Suplidor` +
      `${has('GCRecord') ? ' WHERE GCRecord IS NULL' : ''} ORDER BY Nombre`,
    );
    const items = rows
      .filter(r => r.OID != null && String(r.Nombre || '').trim())
      .map(r => ({ oid: Number(r.OID), nombre: String(r.Nombre).replace(/\s+/g, ' ').trim(), documento: r.Documento == null ? null : String(r.Documento).trim() || null }));
    supplierCache = { at: Date.now(), items, message: null };
  } catch (err) {
    supplierCache = { at: Date.now() - SUPPLIER_TTL_MS + 60 * 1000, items: supplierCache.items, message: err.message };
  }
  return supplierCache;
}
const activeEntries = data => (data.maintenance || []).filter(e => !e.anulado);

// ── Reglas ──
const normalizePlaca = p => String(p == null ? '' : p).toUpperCase().replace(/[\s\-.]/g, '');
const tallerKey = n => String(n == null ? '' : n)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\bs\.?\s*r\.?\s*l\.?\b/g, '').replace(/[^a-z0-9]/g, '');
function canonicalTaller(name, catalog) {
  const clean = String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const key = tallerKey(clean);
  return [...(catalog || []), ...DEFAULT_TALLERES].find(t => tallerKey(t) === key) || clean;
}
function normalizeTipoMant(t) {
  const clean = String(t == null ? '' : t).trim();
  if (!clean) return null;
  const k = tallerKey(clean);
  if (k.startsWith('mant')) return 'Mantenimiento';
  if (k.startsWith('repar')) return 'Reparación';
  if (k.includes('pieza')) return 'Compra de piezas';
  return clean;
}
function parseFecha(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}
function normalizeEntry(e, catalog) {
  const placa = normalizePlaca(e.placa);
  let fecha = parseFecha(e.fecha) || String(e.fecha == null ? '' : e.fecha).trim();
  const fix = DATE_FIXES.find(f => f.placa === placa && f.from === fecha);
  if (fix) fecha = fix.to;
  const idx = Number(String(parseFecha(fecha) || '').slice(5, 7)) - 1;
  const rawTaller = String(e.taller == null ? '' : e.taller).replace(/\s+/g, ' ').trim();
  const taller = e.tallerOid != null ? (rawTaller || null) : canonicalTaller(e.taller, catalog);
  return {
    ...e,
    placa,
    fecha,
    mes: MONTHS[idx] || e.mes || null,
    // El nombre que se escribió originalmente nunca se pierde
    tallerOriginal: e.tallerOriginal || (rawTaller && taller && rawTaller !== taller ? rawTaller : undefined),
    taller,
    tipoMant: normalizeTipoMant(e.tipoMant),
    costo: Number(e.costo) || 0,
  };
}
function buildCatalog(stored, used) {
  const out = [];
  const seen = new Set();
  for (const raw of [...DEFAULT_TALLERES, ...(stored || []), ...(used || [])]) {
    const name = canonicalTaller(raw, out);
    const key = tallerKey(name);
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b, 'es'));
}

/** Vehículos activos del módulo Flotilla Vehicular (también cuentan como placas registradas). */
function registryUnits() {
  const items = readData('fleet-vehicles.json');
  if (!Array.isArray(items)) return [];
  return items
    .filter(v => v.activo !== false && normalizePlaca(v.placa))
    .map(v => ({
      placa: normalizePlaca(v.placa),
      tipo: v.tipo || v.clase || 'VEHÍCULO',
      marca: v.marca || '', modelo: v.modelo || '',
      anio: v.anio || v.año || '', color: v.color || '',
      chasis: v.vin || v.chasis || '',
      fuente: 'Flotilla Vehicular',
    }));
}
/**
 * Trazabilidad: refleja cada gasto en la ficha de Flotilla Vehicular
 * (último mantenimiento, kilometraje e historial de movimientos).
 */
function touchVehicle(entry, usuario, accion) {
  try {
    const items = readData('fleet-vehicles.json');
    if (!Array.isArray(items)) return null;
    const idx = items.findIndex(v => v.activo !== false && normalizePlaca(v.placa) === normalizePlaca(entry.placa));
    if (idx === -1) return null;
    const v = items[idx];
    const fecha = parseFecha(entry.fecha);
    if (accion !== 'eliminado') {
      if (fecha && (!v.ultimoMantenimiento || String(v.ultimoMantenimiento) < fecha)) v.ultimoMantenimiento = fecha;
      const km = Number(entry.kilometraje) || 0;
      if (km > (Number(v.kilometraje) || 0)) v.kilometraje = km;
    }
    const monto = `RD$ ${(Number(entry.costo) || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
    const partes = [entry.tipoMant || 'Gasto', entry.taller ? `en ${entry.taller}` : '', `— ${monto}`, fecha ? `(${fecha})` : ''];
    v.historial = [
      ...(v.historial || []),
      {
        id: `H-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fecha: new Date().toISOString(),
        tipo: 'mantenimiento',
        descripcion: `Gasto ${entry.id || ''} ${accion}: ${partes.filter(Boolean).join(' ')}`.replace(/\s+/g, ' ').trim(),
        usuario: usuario || 'Sistema',
      },
    ];
    v.actualizadoEn = new Date().toISOString();
    items[idx] = v;
    writeData('fleet-vehicles.json', items);
    return v.id;
  } catch (err) {
    console.error('[fleet-maintenance] No se pudo actualizar Flotilla Vehicular:', err.message);
    return null;
  }
}

function allRegisteredUnits(data) {
  const out = [...(data.fleet || [])];
  for (const r of registryUnits()) {
    if (!out.some(u => normalizePlaca(u.placa) === r.placa)) out.push(r);
  }
  return out;
}
const findUnit = (units, placa) => units.find(u => normalizePlaca(u.placa) === normalizePlaca(placa));
const unitKind = u => (String(u.tipo || '').toUpperCase().includes('MOTO') ? 'motocicleta' : 'vehiculo');
function unitDescription(u) {
  let d = [u.tipo, u.marca, u.modelo].map(s => String(s == null ? '' : s).trim()).filter(Boolean).join(' ');
  if (u.color) d += `, color ${String(u.color).trim().toLowerCase()}`;
  if (u.anio) d += `, año ${u.anio}`;
  if (u.chasis) d += `. Chasis ${String(u.chasis).trim()}`;
  return d;
}

/** Limpia datos ya guardados (placas en minúscula, talleres con variantes, fechas mal digitadas). */
function migrate(data) {
  const before = JSON.stringify(data);
  data.fleet = data.fleet || [];
  data.maintenance = data.maintenance || [];
  data.talleres = buildCatalog(data.talleres, data.maintenance.map(e => e.taller));
  data.maintenance = data.maintenance.map(e => normalizeEntry(e, data.talleres));
  data.fleet = data.fleet.map(u => ({ ...u, placa: normalizePlaca(u.placa) || u.placa }));
  if (JSON.stringify(data) !== before) { backupFile('auto-limpieza'); writeData(FILENAME, data); }
  return data;
}

function ensureSeed() {
  const existing = readData(FILENAME);
  if (existing && (existing.fleet?.length || existing.maintenance?.length)) return migrate(existing);

  const candidates = [
    path.join(__dirname, '..', '..', 'public', 'data', 'fleet_maintenance_seed.json'),
    path.join(__dirname, '..', 'data', 'seeds', 'fleet_maintenance_seed.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const seed = JSON.parse(fs.readFileSync(p, 'utf8'));
        const maintenance = (seed.maintenance || []).map((e, i) => ({
          id: `FM-${String(i + 1).padStart(4, '0')}`,
          ...e,
        }));
        const data = {
          generatedFrom: seed.generatedFrom,
          generatedAt: seed.generatedAt,
          fleet: seed.fleet || [],
          maintenance,
          annualCost: seed.annualCost || [],
          talleres: [],
        };
        writeData(FILENAME, data);
        return migrate(data);
      }
    } catch (err) {
      console.error('Error sembrando flotilla:', err.message);
    }
  }
  const empty = { fleet: [], maintenance: [], annualCost: [], talleres: [...DEFAULT_TALLERES] };
  writeData(FILENAME, empty);
  return empty;
}

/** Valida y completa un gasto. Devuelve { error } o { entry }. */
function prepareEntry(data, body, prev, suppliers) {
  const merged = { ...(prev || {}), ...body };
  // Taller elegido de la lista de suplidores de Adonis → nombre oficial y OID
  const oid = merged.tallerOid == null || merged.tallerOid === '' ? null : Number(merged.tallerOid);
  if (oid != null) {
    if (!Number.isFinite(oid)) return { error: 'El suplidor seleccionado no es válido.' };
    if (Array.isArray(suppliers)) {
      const sup = suppliers.find(x => x.oid === oid);
      if (!sup) return { error: `El suplidor ${oid} no existe en Adonis. Actualice la lista e intente de nuevo.` };
      merged.taller = sup.nombre;
    }
    merged.tallerOid = oid;
  } else {
    const alias = data.tallerAliases && data.tallerAliases[suppliersLib.nameKey(merged.taller)];
    if (alias) { merged.tallerOid = Number(alias.oid); merged.taller = alias.nombre; }
    else merged.tallerOid = null;
  }
  const units = allRegisteredUnits(data);
  const placa = normalizePlaca(merged.placa);
  if (!placa) return { error: 'Debe seleccionar la placa de una unidad registrada.' };
  const unit = findUnit(units, placa);
  // Al editar un registro antiguo se permite conservar su placa original.
  const keepsOldPlaca = prev && normalizePlaca(prev.placa) === placa;
  if (!unit && !keepsOldPlaca) {
    return { error: `La placa ${placa} no está registrada en la Flotilla. Regístrela primero en la pestaña Flotilla.` };
  }
  if (!parseFecha(merged.fecha)) return { error: 'La fecha no es válida.' };
  if (!(Number(merged.costo) > 0)) return { error: 'El costo debe ser mayor que cero.' };
  if (!String(merged.taller || '').trim()) return { error: 'Debe seleccionar el taller.' };

  const entry = normalizeEntry(merged, data.talleres);
  if (entry.tallerOid != null) entry.taller = merged.taller; // nombre oficial de Adonis, sin cambios
  if (unit) {
    entry.placa = normalizePlaca(unit.placa);
    entry.kind = unitKind(unit);
    entry.unit = unitDescription(unit);
  }
  if (!data.talleres.some(t => tallerKey(t) === tallerKey(entry.taller))) {
    data.talleres = buildCatalog(data.talleres, [entry.taller]);
  }
  return { entry };
}

// GET full dataset (+ unidades de Flotilla Vehicular para validar placas)
router.get('/', auth, (req, res) => {
  const data = ensureSeed();
  const own = new Set((data.fleet || []).map(u => normalizePlaca(u.placa)));
  const anulados = (data.maintenance || []).filter(e => e.anulado).length;
  res.json({ ...data, maintenance: activeEntries(data), anulados, registryUnits: registryUnits().filter(r => !own.has(r.placa)) });
});

// POST new maintenance entry
router.post('/maintenance', auth, async (req, res) => {
  const { items: suppliers } = await loadSuppliers();
  const data = ensureSeed();
  const { error, entry } = prepareEntry(data, req.body, null, suppliers);
  if (error) return res.status(400).json({ message: error });
  entry.id = req.body.id || generateId('FM', data.maintenance);
  entry.createdAt = new Date().toISOString();
  entry.createdBy = req.user?.name || req.user?.email || undefined;
  const vehId = touchVehicle(entry, entry.createdBy, 'registrado');
  if (vehId) entry.vehiculoId = vehId;
  data.maintenance.unshift(entry);
  writeData(FILENAME, data);
  res.status(201).json(entry);
});

// PUT update maintenance entry
router.put('/maintenance/:id', auth, async (req, res) => {
  const { items: suppliers } = await loadSuppliers();
  const data = ensureSeed();
  const idx = data.maintenance.findIndex(e => e.id === req.params.id && !e.anulado);
  if (idx === -1) return res.status(404).json({ message: 'Registro no encontrado' });
  const prev = data.maintenance[idx];
  const { error, entry } = prepareEntry(data, req.body, prev, suppliers);
  if (error) return res.status(400).json({ message: error });
  data.maintenance[idx] = { ...entry, id: prev.id, updatedAt: new Date().toISOString(), updatedBy: req.user?.name || req.user?.email || undefined };
  const vehId = touchVehicle(data.maintenance[idx], req.user?.name || req.user?.email, 'actualizado');
  if (vehId) data.maintenance[idx].vehiculoId = vehId;
  writeData(FILENAME, data);
  res.json(data.maintenance[idx]);
});

// DELETE maintenance entry → se ANULA (no se borra) con motivo obligatorio
router.delete('/maintenance/:id', auth, (req, res) => {
  const motivo = String(req.body?.motivo || '').trim();
  if (motivo.length < 5) return res.status(400).json({ message: 'Escriba el motivo de la eliminación (mínimo 5 caracteres).' });
  const data = ensureSeed();
  const idx = data.maintenance.findIndex(e => e.id === req.params.id && !e.anulado);
  if (idx === -1) return res.status(404).json({ message: 'Registro no encontrado' });
  const who = req.user?.name || req.user?.email || 'Intranet';
  data.maintenance[idx] = { ...data.maintenance[idx], anulado: true, anuladoMotivo: motivo, anuladoPor: who, anuladoEn: new Date().toISOString() };
  writeData(FILENAME, data);
  touchVehicle(data.maintenance[idx], who, `anulado (${motivo})`);
  res.status(204).send();
});

// ── Suplidores de Adonis para elegir el taller (solo lectura) ──
router.get('/suplidores', auth, async (req, res) => {
  const r = await loadSuppliers(req.query.refresh === '1');
  res.json({ connected: Array.isArray(r.items), items: r.items || [], message: r.message, actualizado: r.at ? new Date(r.at).toISOString() : null });
});

// ── Unificar talleres escritos de distintas formas en un mismo suplidor ──
router.get('/talleres/unificacion', auth, async (req, res) => {
  const r = await loadSuppliers();
  const data = ensureSeed();
  res.json({
    connected: Array.isArray(r.items),
    message: r.message,
    grupos: suppliersLib.groupTalleres(activeEntries(data), r.items || [], data.tallerAliases || {}),
  });
});

router.post('/talleres/unificar', auth, async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ message: 'No hay talleres para unificar.' });
  const r = await loadSuppliers();
  if (!Array.isArray(r.items)) return res.status(503).json({ message: `No se pudo leer la lista de suplidores de SafeOne. ${r.message || ''}`.trim() });
  const byOid = new Map(r.items.map(x => [x.oid, x]));
  const data = ensureSeed();
  const respaldo = backupFile('unificar-talleres');
  const who = req.user?.name || req.user?.email || 'Intranet';
  data.tallerAliases = data.tallerAliases || {};
  data.tallerUnificaciones = Array.isArray(data.tallerUnificaciones) ? data.tallerUnificaciones : [];
  let cambiados = 0;
  const detalle = [];
  for (const it of items) {
    const sup = byOid.get(Number(it.oid));
    const variantes = (Array.isArray(it.variantes) ? it.variantes : [it.nombre]).map(v => String(v || '').trim()).filter(Boolean);
    if (!sup || !variantes.length) continue;
    const keys = new Set(variantes.map(v => suppliersLib.nameKey(v) || v.toLowerCase()));
    let n = 0;
    for (const e of data.maintenance) {
      if (e.anulado) continue;
      const k = suppliersLib.nameKey(e.taller) || String(e.taller || '').toLowerCase();
      if (!keys.has(k)) continue;
      if (e.tallerOid === sup.oid && e.taller === sup.nombre) continue;
      if (!e.tallerOriginal && e.taller !== sup.nombre) e.tallerOriginal = e.taller;
      e.taller = sup.nombre;
      e.tallerOid = sup.oid;
      n++;
    }
    for (const k of keys) data.tallerAliases[k] = { oid: sup.oid, nombre: sup.nombre };
    data.talleres = buildCatalog(data.talleres, [sup.nombre]);
    cambiados += n;
    detalle.push({ variantes, oid: sup.oid, nombre: sup.nombre, gastos: n });
  }
  data.tallerUnificaciones.unshift({ at: new Date().toISOString(), by: who, respaldo, detalle });
  data.tallerUnificaciones = data.tallerUnificaciones.slice(0, 500);
  writeData(FILENAME, data);
  res.json({ cambiados, respaldo, detalle });
});

// POST new fleet unit (placa con formato válido y sin duplicados)
router.post('/fleet', auth, (req, res) => {
  const data = ensureSeed();
  const placa = normalizePlaca(req.body.placa);
  if (!placa) return res.status(400).json({ message: 'La placa es obligatoria.' });
  if (!PLACA_REGEX.test(placa)) return res.status(400).json({ message: `La placa ${placa} no tiene un formato válido (ej. K2546292, L504477).` });
  if (findUnit(data.fleet, placa)) return res.status(409).json({ message: `Ya existe una unidad con la placa ${placa}.` });
  const nextNo = (data.fleet.reduce((m, u) => Math.max(m, Number(u.no) || 0), 0) || 0) + 1;
  const unit = { no: nextNo, ...req.body, placa };
  data.fleet.push(unit);
  writeData(FILENAME, data);
  res.status(201).json(unit);
});

// PUT update fleet unit (by placa; la placa no se cambia)
router.put('/fleet/:placa', auth, (req, res) => {
  const data = ensureSeed();
  const idx = data.fleet.findIndex(u => normalizePlaca(u.placa) === normalizePlaca(req.params.placa));
  if (idx === -1) return res.status(404).json({ message: 'Unidad no encontrada' });
  data.fleet[idx] = { ...data.fleet[idx], ...req.body, placa: data.fleet[idx].placa };
  writeData(FILENAME, data);
  res.json(data.fleet[idx]);
});

// DELETE fleet unit
router.delete('/fleet/:placa', auth, (req, res) => {
  const data = ensureSeed();
  const idx = data.fleet.findIndex(u => normalizePlaca(u.placa) === normalizePlaca(req.params.placa));
  if (idx === -1) return res.status(404).json({ message: 'Unidad no encontrada' });
  data.fleet.splice(idx, 1);
  writeData(FILENAME, data);
  res.status(204).send();
});

// POST add taller to catalog
router.post('/talleres', auth, (req, res) => {
  const data = ensureSeed();
  const name = canonicalTaller(req.body.nombre, data.talleres);
  if (!name) return res.status(400).json({ message: 'El nombre del taller es obligatorio.' });
  data.talleres = buildCatalog(data.talleres, [name]);
  writeData(FILENAME, data);
  res.status(201).json({ nombre: name, talleres: data.talleres });
});

// POST normalize talleres (compatibilidad; la limpieza ahora es automática al leer)
router.post('/normalize-talleres', auth, (req, res) => {
  ensureSeed();
  res.json({ changed: 0 });
});

module.exports = router;
