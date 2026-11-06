/**
 * Catálogo de Servicios — Centro de Monitoreo (Fase 1).
 * Persistencia local (localStorage) mientras se define el endpoint del backend.
 *
 * Fase 2 (documentado, no implementado): entidad ServicioContratado que cruza
 * cliente (gSafeOne Cliente.OID) + ítem del catálogo, para control de lo
 * ofrecido vs. lo facturado.
 */
export type CatalogType = "paquete" | "servicio";
export type CatalogStatus = "activo" | "inactivo" | "validacion";
export type CatalogCategory = "monitoreo" | "fisica" | "video" | "acceso" | "especiales" | "alarmas" | "personal";

export interface AuditStamp { by: string; at: string }

export interface CatalogItem {
  id: string;
  codigo: string;
  nombre: string;
  tipo: CatalogType;
  categoria: CatalogCategory;
  descripcion: string;
  alcances: string[];
  cobertura: string;
  funcionalidades: string[];
  estado: CatalogStatus;
  precio: number | null; // null = pendiente de definición
  condiciones: string;
  nota?: string;
  serviciosIncluidos: string[]; // ids (solo paquetes) — relación N:M
  creado: AuditStamp;
  modificado: AuditStamp;
}

/** Fase 2 — estructura preparada. */
export interface ServicioContratado {
  id: string;
  cliente_id: string;
  servicio_id: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: "activo" | "suspendido" | "finalizado";
  precio_aplicado: number;
  factura_ref?: string;
}

export const PRICE_PENDING = "Precio pendiente de definición por Dirección Comercial";
export const STATUS_LABEL: Record<CatalogStatus, string> = { activo: "Activo", inactivo: "Inactivo", validacion: "En validación" };
export const CATEGORY_LABEL: Record<CatalogCategory, string> = {
  monitoreo: "Monitoreo", fisica: "Seguridad física", video: "Video", acceso: "Control de acceso",
  especiales: "Especiales", alarmas: "Alarmas", personal: "Protección personal",
};

const KEY = "safeone_service_catalog_v1";
const now = () => new Date().toISOString();
const sys: AuditStamp = { by: "Sistema (carga inicial)", at: "2026-11-06T12:00:00.000Z" };

const s = (p: Omit<CatalogItem, "creado" | "modificado" | "precio" | "condiciones" | "serviciosIncluidos"> & Partial<CatalogItem>): CatalogItem => ({
  precio: null, condiciones: "", serviciosIncluidos: [], creado: sys, modificado: sys, ...p,
});

export const SEED: CatalogItem[] = [
  s({ id: "srv-monitoreo", codigo: "SRV-01", nombre: "Monitoreo de alarmas", tipo: "servicio", categoria: "monitoreo", estado: "activo",
    descripcion: "Supervisión 24/7 de sistemas de alarma desde el Centro de Monitoreo, con despacho de respuesta armada.",
    alcances: ["Recepción y verificación de eventos", "Despacho de respuesta armada", "Reporte de incidencias"],
    cobertura: "24/7 · Nacional", funcionalidades: ["App móvil", "Rastreo GPS", "Respuesta armada"] }),
  s({ id: "srv-fisica", codigo: "SRV-02", nombre: "Seguridad física", tipo: "servicio", categoria: "fisica", estado: "activo",
    descripcion: "Personal de seguridad entrenado y certificado para protección de instalaciones y personas.",
    alcances: ["Vigilantes", "Oficiales", "Escoltas", "Rondas"], cobertura: "Por turno · Según contrato",
    funcionalidades: ["Supervisión de turnos", "Reporte diario", "Personal armado"] }),
  s({ id: "srv-cctv", codigo: "SRV-03", nombre: "Videovigilancia y CCTV", tipo: "servicio", categoria: "video", estado: "validacion",
    descripcion: "Instalación de cámaras y monitoreo remoto por cámara desde el Centro de Monitoreo.",
    alcances: ["Instalación de cámaras", "Monitoreo por cámara"], cobertura: "24/7 · Remoto",
    funcionalidades: ["Grabación", "Visualización remota"], nota: "Requiere validación operativa." }),
  s({ id: "srv-acceso", codigo: "SRV-04", nombre: "Control de acceso", tipo: "servicio", categoria: "acceso", estado: "activo",
    descripcion: "Soluciones para controlar y registrar el ingreso a áreas restringidas.",
    alcances: ["Lectoras", "Cerraduras", "Instalación"], cobertura: "Instalación en sitio",
    funcionalidades: ["Registro de entradas", "Gestión de credenciales"] }),
  s({ id: "srv-videoportero", codigo: "SRV-05", nombre: "VideoPortero", tipo: "servicio", categoria: "acceso", estado: "activo",
    descripcion: "Atención remota de visitantes por video, con verificación y apertura controlada.",
    alcances: ["Atención de visitantes", "Verificación por video", "Apertura remota"], cobertura: "24/7 · Remoto",
    funcionalidades: ["Intercomunicador con video", "Registro de visitas"] }),
  s({ id: "srv-panico", codigo: "SRV-06", nombre: "Botón de pánico", tipo: "servicio", categoria: "personal", estado: "activo",
    descripcion: "Activación inmediata de alerta al Centro de Monitoreo ante amenaza o emergencia médica.",
    alcances: ["Alerta silenciosa", "Despacho de respuesta", "Notificación a contactos"], cobertura: "24/7",
    funcionalidades: ["Botón físico o en app", "Geolocalización"] }),
  s({ id: "srv-palabra", codigo: "SRV-07", nombre: "Palabra de seguridad", tipo: "servicio", categoria: "personal", estado: "activo",
    descripcion: "Protocolo de verificación verbal para confirmar identidad y detectar situaciones de coacción.",
    alcances: ["Palabra clave", "Palabra de coacción", "Protocolo de verificación"], cobertura: "24/7",
    funcionalidades: ["Verificación telefónica", "Escalamiento automático"] }),
  s({ id: "srv-activetrack", codigo: "SRV-08", nombre: "Active Track", tipo: "servicio", categoria: "especiales", estado: "activo",
    descripcion: "Seguimiento de rondas y puntos de control del personal en tiempo real.",
    alcances: ["Puntos de control", "Reporte de rondas"], cobertura: "Por puesto", funcionalidades: ["Marcaciones", "Alertas de omisión"] }),
  s({ id: "srv-patrullas", codigo: "SRV-09", nombre: "Patrullas", tipo: "servicio", categoria: "especiales", estado: "activo",
    descripcion: "Recorridos motorizados preventivos y de respuesta.", alcances: ["Rondas preventivas", "Respuesta a eventos"],
    cobertura: "Zonas de cobertura", funcionalidades: ["GPS", "Bitácora"] }),
  s({ id: "srv-solar", codigo: "SRV-10", nombre: "Respaldo solar y fallo de energía", tipo: "servicio", categoria: "especiales", estado: "activo",
    descripcion: "Continuidad de los equipos de seguridad ante apagones, con alerta de fallo eléctrico.",
    alcances: ["Paneles y baterías", "Alerta de fallo de energía"], cobertura: "En sitio", funcionalidades: ["Autonomía extendida", "Notificación de corte"] }),
  s({ id: "pkg-alarmas", codigo: "PKG-01", nombre: "Planes de alarma", tipo: "paquete", categoria: "alarmas", estado: "activo",
    descripcion: "Plan integral: instalación del sistema de alarma, accesorios y mantenimiento, enlazado al monitoreo 24/7.",
    alcances: ["Instalación", "Accesorios", "Mantenimiento"], cobertura: "24/7 · Nacional",
    funcionalidades: ["Monitoreo incluido", "Botón de pánico"], serviciosIncluidos: ["srv-monitoreo", "srv-panico", "srv-palabra"] }),
  s({ id: "pkg-especiales", codigo: "PKG-02", nombre: "Servicios especiales", tipo: "paquete", categoria: "especiales", estado: "activo",
    descripcion: "Agrupación de servicios complementarios para operaciones exigentes.",
    alcances: ["Active Track", "Patrullas", "Respaldo solar"], cobertura: "Según contrato",
    funcionalidades: ["Configurable"], serviciosIncluidos: ["srv-activetrack", "srv-patrullas", "srv-solar"] }),
];

export function loadCatalog(): CatalogItem[] {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* ignore */ }
  return SEED;
}
export function saveCatalog(items: CatalogItem[]) { localStorage.setItem(KEY, JSON.stringify(items)); }

export function stamp(user: string): AuditStamp { return { by: user, at: now() }; }

export function nextCode(items: CatalogItem[], tipo: CatalogType) {
  const pre = tipo === "paquete" ? "PKG" : "SRV";
  const n = items.filter((i) => i.codigo.startsWith(pre)).map((i) => parseInt(i.codigo.split("-")[1]) || 0);
  return `${pre}-${String((n.length ? Math.max(...n) : 0) + 1).padStart(2, "0")}`;
}

export function validateItem(i: Partial<CatalogItem>): string | null {
  if (!i.nombre?.trim()) return "El nombre es obligatorio.";
  if (!i.tipo) return "El tipo es obligatorio.";
  if (!i.descripcion?.trim()) return "La descripción es obligatoria.";
  if (i.precio != null && (isNaN(i.precio) || i.precio < 0)) return "El precio debe ser un número positivo.";
  return null;
}

export const formatPrice = (p: number | null) =>
  p == null ? null : new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(p);
