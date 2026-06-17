// Fusiona el Expediente "Vivo" (GENERAL/SQL) con los datos de Operaciones
// (Personal Armado + Puestos). Las armas y puestos que existen en Operaciones
// pero faltan en GENERAL se agregan/enriquecen y se marcan con origen
// "operaciones" para que la auditoría vea TODO en un solo lugar.

import type {
  GeneralExpediente, GeneralExpedienteCliente, GeneralExpedientePuesto,
  GeneralWeaponDetail, GeneralWeapon,
} from "@/lib/api";
import type { ArmedPersonnel } from "@/lib/types";
import type { WorkPost } from "@/lib/postsData";

function nkey(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase();
}

// Normaliza un serial para comparar (sin espacios, mayúsculas, sin ceros guía).
function serialKey(s: string | null | undefined): string {
  const t = (s || "").trim().toUpperCase().replace(/\s+/g, "");
  return t.replace(/^0+/, "") || t;
}

// Construye un mapa serial→arma desde el catálogo Armamento de GENERAL (SQL).
function buildWeaponSerialMap(weapons: GeneralWeapon[]): Map<string, GeneralWeapon> {
  const m = new Map<string, GeneralWeapon>();
  (weapons || []).forEach((w) => {
    const k = serialKey(w.serie);
    if (k && !m.has(k)) m.set(k, w);
  });
  return m;
}

// Enriquece un objeto arma con los datos de SQL (marca, categoría, calibre,
// tipo, licencia, estatus, propietario) cuando falten, emparejando por serial.
function enrichArmaFromSql(
  arma: GeneralWeaponDetail | null,
  sqlMap: Map<string, GeneralWeapon>,
): GeneralWeaponDetail | null {
  if (!arma || !arma.serie) return arma;
  const w = sqlMap.get(serialKey(arma.serie));
  if (!w) return arma;
  return {
    ...arma,
    oid: arma.oid ?? (w.oid != null ? Number(w.oid) : null),
    marca: arma.marca || w.marca || null,
    tipo: arma.tipo || w.tipo || null,
    calibre: arma.calibre || w.calibre || null,
    categoria: arma.categoria || w.categoria || null,
    noLicencia: arma.noLicencia || w.noLicencia || w.registro || null,
    estatus: arma.estatus || w.estatus || null,
    propietario: arma.propietario || w.propietario || null,
  };
}

interface OpsWeapon { serial: string; tipo: string; modelo: string; vigilante: string; }
interface OpsPostInfo {
  cliente: string;
  localidad: string;
  puesto: string;
  weapons: OpsWeapon[];
  vigilantes: string[];
}

// Construye un índice de Operaciones agrupado por (cliente, puesto).
function buildOpsIndex(personnel: ArmedPersonnel[], workPosts: WorkPost[]): Map<string, OpsPostInfo> {
  const idx = new Map<string, OpsPostInfo>();
  const keyOf = (cliente: string, puesto: string) => `${nkey(cliente)}|${nkey(puesto)}`;

  const ensure = (cliente: string, puesto: string, localidad: string): OpsPostInfo => {
    const k = keyOf(cliente, puesto);
    let e = idx.get(k);
    if (!e) {
      e = { cliente: (cliente || "").trim() || "Cliente sin nombre", localidad: (localidad || "").trim() || "Sede Principal", puesto: (puesto || "").trim() || "Puesto General", weapons: [], vigilantes: [] };
      idx.set(k, e);
    } else if (!e.localidad || e.localidad === "Sede Principal") {
      if ((localidad || "").trim()) e.localidad = localidad.trim();
    }
    return e;
  };

  (personnel || []).forEach((p) => {
    if (p.status === "Inactivo") return;
    const e = ensure(p.client || "", p.location || "", p.province || "");
    const name = p.name || p.employeeCode;
    if (name && !e.vigilantes.includes(name)) e.vigilantes.push(name);
    if (p.weaponSerial || p.weaponType) {
      e.weapons.push({ serial: p.weaponSerial || "", tipo: p.weaponType || "", modelo: p.weaponType || "", vigilante: name || "" });
    }
  });

  (workPosts || []).forEach((wp) => {
    const e = ensure(wp.cliente || "", wp.nombre || "", wp.provincia || "");
    (wp.guards || []).forEach((g) => { if (g.guardName && !e.vigilantes.includes(g.guardName)) e.vigilantes.push(g.guardName); });
    (wp.weapons || []).forEach((w) => {
      const serial = w.serial || "";
      if (serial && e.weapons.some((x) => nkey(x.serial) === nkey(serial))) return;
      const guard = (w.assignedGuardIds || []).map((id) => (wp.guards || []).find((g) => g.id === id)?.guardName).filter(Boolean)[0] || "";
      e.weapons.push({ serial, tipo: w.arma || "", modelo: [w.marca, w.arma].filter(Boolean).join(" ").trim(), vigilante: guard });
    });
  });

  return idx;
}

let synthOid = -1;
function nextOid(): number { return synthOid--; }

function makeOpsPuesto(info: OpsPostInfo, w?: OpsWeapon): GeneralExpedientePuesto {
  return {
    lineaOID: nextOid(),
    puesto: info.puesto,
    localidad: info.localidad,
    puestoCodigo: null,
    vigilante: w?.vigilante || info.vigilantes[0] || "",
    vigilanteOID: null,
    vigilanteCodigo: null,
    vigilanteCedula: null,
    horas: 0,
    incentivo: 0,
    requiereArma: !!(w && (w.serial || w.tipo)),
    armaOID: null,
    armaSerial: w?.serial || null,
    armaModelo: w?.modelo || w?.tipo || null,
    arma: w && (w.serial || w.tipo)
      ? { oid: null, serie: w.serial || null, marca: null, tipo: w.tipo || null, calibre: null, categoria: null, noLicencia: null, estatus: null, propietario: null }
      : null,
    novedad: false,
    comentario: "",
    origen: "operaciones",
    armaOrigen: w ? "operaciones" : undefined,
  };
}

/**
 * Devuelve un GeneralExpediente fusionado con Operaciones. No muta el original.
 */
export function mergeOperacionesIntoExpediente(
  data: GeneralExpediente | null,
  personnel: ArmedPersonnel[],
  workPosts: WorkPost[],
  sqlWeapons: GeneralWeapon[] = [],
): GeneralExpediente {
  const base: GeneralExpediente = data
    ? { ...data, clientes: data.clientes.map((c) => ({ ...c, puestos: c.puestos.map((p) => ({ ...p })) })) }
    : { fecha: null, clientes: [], totals: {} };

  const opsIdx = buildOpsIndex(personnel || [], workPosts || []);
  const sqlMap = buildWeaponSerialMap(sqlWeapons);
  if (opsIdx.size === 0 && sqlMap.size === 0) return base;

  // Índice de respaldo por vigilante: permite enriquecer un puesto de GENERAL
  // con el arma que Operaciones tiene para ese mismo vigilante, aunque el
  // nombre del cliente o del puesto no coincida exactamente entre las fuentes.
  const opsByVigilante = new Map<string, { weapon: OpsWeapon; key: string }>();
  opsIdx.forEach((info, key) => {
    info.weapons.forEach((w) => {
      const vk = nkey(w.vigilante);
      if (vk && (w.serial || w.tipo) && !opsByVigilante.has(vk)) {
        opsByVigilante.set(vk, { weapon: w, key });
      }
    });
  });

  // Marca registros de GENERAL.
  base.clientes.forEach((c) => { c.origen = c.origen || "general"; c.puestos.forEach((p) => { p.origen = p.origen || "general"; }); });

  const clienteByKey = new Map<string, GeneralExpedienteCliente>();
  base.clientes.forEach((c) => clienteByKey.set(nkey(c.nombre), c));

  const usedOps = new Set<string>();

  // 1) Enriquecer puestos de GENERAL con armas de Operaciones.
  base.clientes.forEach((c) => {
    c.puestos.forEach((p) => {
      const k = `${nkey(c.nombre)}|${nkey(p.puesto)}`;
      const info = opsIdx.get(k);
      if (info) {
        usedOps.add(k);
        if (!p.localidad && info.localidad) p.localidad = info.localidad;
        if (!p.armaSerial && info.weapons.length > 0) {
          const w = info.weapons.find((x) => nkey(x.vigilante) === nkey(p.vigilante)) || info.weapons[0];
          p.requiereArma = true;
          p.armaSerial = w.serial || null;
          p.armaModelo = w.modelo || w.tipo || null;
          p.armaOrigen = "operaciones";
          if (!p.arma && (w.serial || w.tipo)) {
            p.arma = { oid: null, serie: w.serial || null, marca: null, tipo: w.tipo || null, calibre: null, categoria: null, noLicencia: null, estatus: null, propietario: null };
          }
        }
      }
      // Completa marca/categoría/calibre/licencia desde el catálogo SQL por serial.
      p.arma = enrichArmaFromSql(p.arma, sqlMap);
      if (p.arma) {
        p.armaModelo = p.armaModelo || p.arma.marca || p.arma.tipo || null;
      }
    });
  });

  // 2) Agregar puestos/clientes que solo existen en Operaciones.
  opsIdx.forEach((info, k) => {
    if (usedOps.has(k)) return;
    let cliente = clienteByKey.get(nkey(info.cliente));
    if (!cliente) {
      cliente = {
        oid: nextOid(), codigo: null, nombre: info.cliente, direccion: "", telefono: "",
        email: "", rnc: "", cedula: "", contacto: "", inactivo: false, puestos: [], origen: "operaciones",
      };
      clienteByKey.set(nkey(info.cliente), cliente);
      base.clientes.push(cliente);
    }
    const pushPuesto = (w?: OpsWeapon) => {
      const puesto = makeOpsPuesto(info, w);
      puesto.arma = enrichArmaFromSql(puesto.arma, sqlMap);
      if (puesto.arma) puesto.armaModelo = puesto.armaModelo || puesto.arma.marca || puesto.arma.tipo || null;
      cliente!.puestos.push(puesto);
    };
    if (info.weapons.length > 0) {
      info.weapons.forEach((w) => pushPuesto(w));
    } else {
      pushPuesto();
    }
  });

  // Recalcular totales.
  let puestosCubiertos = 0, vigilantes = 0, armas = 0, sinArma = 0, conNovedad = 0;
  const vigSet = new Set<string>();
  base.clientes.forEach((c) => {
    c.puestos.forEach((p) => {
      puestosCubiertos++;
      if (p.vigilante) vigSet.add(`${nkey(c.nombre)}|${nkey(p.vigilante)}`);
      if (p.armaSerial || p.requiereArma) armas++; else sinArma++;
      if (p.novedad) conNovedad++;
    });
  });
  vigilantes = vigSet.size;
  base.totals = { ...base.totals, clientes: base.clientes.length, puestosCubiertos, vigilantes, armas, sinArma, conNovedad };

  return base;
}
