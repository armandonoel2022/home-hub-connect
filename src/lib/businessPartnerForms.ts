/**
 * Expediente de Asociado de Negocio (clientes / terceros).
 *
 * Define los formularios oficiales F-ADM, la documentación requerida, las
 * verificaciones internas (georreferenciación y OFAC) y la información
 * comercial mínima que debe recopilarse por cada asociado.
 *
 * Los archivos de los formularios se sirven como assets de la intranet para
 * que Servicio al Cliente pueda descargarlos y enviarlos al asociado.
 */
import fAdm01 from "@/assets/asociados/f-adm-01.asset.json";
import fAdm02 from "@/assets/asociados/f-adm-02.asset.json";
import fAdm05 from "@/assets/asociados/f-adm-05.asset.json";
import fAdm06 from "@/assets/asociados/f-adm-06.asset.json";
import fAdm07 from "@/assets/asociados/f-adm-07.asset.json";
import fAdm08 from "@/assets/asociados/f-adm-08.asset.json";
import fAdm10 from "@/assets/asociados/f-adm-10.asset.json";
import fAdm11 from "@/assets/asociados/f-adm-11.asset.json";
import fAdm12 from "@/assets/asociados/f-adm-12.asset.json";

export type FormOrigen = "cliente" | "interno";

export interface PartnerForm {
  code: string;
  nombre: string;
  origen: FormOrigen;
  url: string;
  filename: string;
  /** Formato del archivo (para el ícono/etiqueta) */
  formato: string;
}

const asset = (a: { url: string; original_filename: string }) => ({
  url: a.url,
  filename: a.original_filename,
  formato: (a.original_filename.split(".").pop() || "").toUpperCase(),
});

export const PARTNER_FORMS: PartnerForm[] = [
  { code: "F-ADM-01", nombre: "Acuerdo de Confidencialidad a Terceros", origen: "cliente", ...asset(fAdm01) },
  { code: "F-ADM-02", nombre: "Acuerdo de Colaboración", origen: "cliente", ...asset(fAdm02) },
  { code: "F-ADM-05", nombre: "Declaración de Origen de Fondos", origen: "cliente", ...asset(fAdm05) },
  { code: "F-ADM-06", nombre: "Validación de Criterios de Seguridad", origen: "cliente", ...asset(fAdm06) },
  { code: "F-ADM-07", nombre: "Registro de Datos de Asociados de Negocios", origen: "cliente", ...asset(fAdm07) },
  { code: "F-ADM-08", nombre: "Debida Diligencia a Proveedores Tercerizados (Personas Jurídicas)", origen: "interno", ...asset(fAdm08) },
  { code: "F-ADM-10", nombre: "Criterios de Evaluación de Asociados SafeOne", origen: "interno", ...asset(fAdm10) },
  { code: "F-ADM-11", nombre: "Matriz de Revisión de Asociados de Negocios (Personas Jurídicas)", origen: "interno", ...asset(fAdm11) },
  { code: "F-ADM-12", nombre: "Evaluación de Riesgo — Criterios de Seguridad de Asociados", origen: "interno", ...asset(fAdm12) },
];

export const FORMS_CLIENTE = PARTNER_FORMS.filter((f) => f.origen === "cliente");
export const FORMS_INTERNOS = PARTNER_FORMS.filter((f) => f.origen === "interno");

export interface RequiredDoc {
  key: string;
  nombre: string;
  /** Puede marcarse como "No aplica" */
  opcional?: boolean;
}

export const REQUIRED_DOCS: RequiredDoc[] = [
  { key: "cedula", nombre: "Copia de cédula y/o pasaporte del representante legal o propietario" },
  { key: "rnc", nombre: "Copia de tarjeta de RNC o certificación de RNC (DGII)" },
  { key: "registroMercantil", nombre: "Copia del Registro Mercantil vigente" },
  { key: "referenciaBancaria", nombre: "Carta de referencia bancaria" },
  { key: "certificaciones", nombre: "Certificaciones de seguridad o calidad (BASC, OEA, C-TPAT, ISO 28000)", opcional: true },
  { key: "contrato", nombre: "Contrato de los servicios contratados" },
];

export const OFAC_URL = "https://sanctionssearch.ofac.treas.gov/";

export const TIPOS_PROVEEDOR = [
  "Cliente",
  "Proveedor de bienes",
  "Proveedor de servicios",
  "Outsourcing / Tercerizado",
  "Transportista",
  "Aliado estratégico",
];

// ─── Modelo del expediente ───

export interface FormularioEstado {
  enviado?: boolean;
  recibido?: boolean;
  firmadoSellado?: boolean;
  fecha?: string;
  nota?: string;
}

export interface DocumentoEstado {
  recibido?: boolean;
  noAplica?: boolean;
  fecha?: string;
  nota?: string;
}

export type OfacResultado = "Pendiente" | "Sin coincidencias" | "Coincidencia";

export interface OfacConsulta {
  id: string;
  nombre: string;
  tipo: "Empresa" | "Representante legal";
  fecha: string;
  resultado: OfacResultado;
  nota?: string;
}

export interface ReferenciaComercial {
  id: string;
  empresa: string;
  contacto: string;
  telefono: string;
  email: string;
  verificada?: boolean;
}

export interface PartnerDossier {
  formularios: Record<string, FormularioEstado>;
  documentos: Record<string, DocumentoEstado>;
  georreferenciacion: {
    coordenadas: string;
    mapsUrl: string;
    verificadoPor: string;
    fecha: string;
    nota: string;
  };
  ofac: OfacConsulta[];
  info: {
    inicioOperaciones: string;
    actividadEconomica: string;
    cantidadEmpleados: string;
    tipoProveedor: string;
    productosServicios: string;
  };
  referencias: ReferenciaComercial[];
  updatedAt?: string;
  updatedBy?: string | null;
}

export function emptyDossier(): PartnerDossier {
  return {
    formularios: {},
    documentos: {},
    georreferenciacion: { coordenadas: "", mapsUrl: "", verificadoPor: "", fecha: "", nota: "" },
    ofac: [],
    info: { inicioOperaciones: "", actividadEconomica: "", cantidadEmpleados: "", tipoProveedor: "", productosServicios: "" },
    referencias: [],
  };
}

export function normalizeDossier(d?: Partial<PartnerDossier> | null): PartnerDossier {
  const base = emptyDossier();
  if (!d) return base;
  return {
    formularios: d.formularios || {},
    documentos: d.documentos || {},
    georreferenciacion: { ...base.georreferenciacion, ...(d.georreferenciacion || {}) },
    ofac: Array.isArray(d.ofac) ? d.ofac : [],
    info: { ...base.info, ...(d.info || {}) },
    referencias: Array.isArray(d.referencias) ? d.referencias : [],
    updatedAt: d.updatedAt,
    updatedBy: d.updatedBy ?? null,
  };
}

export interface DossierProgress {
  total: number;
  completos: number;
  porcentaje: number;
  faltantes: string[];
  bloques: { label: string; completos: number; total: number }[];
}

export function calcularProgreso(d: PartnerDossier): DossierProgress {
  const faltantes: string[] = [];
  const bloques: DossierProgress["bloques"] = [];

  // Formularios al cliente: completos cuando están recibidos firmados y sellados
  let okCli = 0;
  FORMS_CLIENTE.forEach((f) => {
    const st = d.formularios[f.code];
    if (st?.recibido && st?.firmadoSellado) okCli += 1;
    else faltantes.push(`${f.code} firmado y sellado`);
  });
  bloques.push({ label: "Formularios del cliente", completos: okCli, total: FORMS_CLIENTE.length });

  // Formularios internos: completos cuando están marcados como recibidos (completados)
  let okInt = 0;
  FORMS_INTERNOS.forEach((f) => {
    const st = d.formularios[f.code];
    if (st?.recibido) okInt += 1;
    else faltantes.push(`${f.code} (uso interno)`);
  });
  bloques.push({ label: "Formularios internos", completos: okInt, total: FORMS_INTERNOS.length });

  // Documentación
  let okDoc = 0;
  REQUIRED_DOCS.forEach((doc) => {
    const st = d.documentos[doc.key];
    if (st?.recibido || (doc.opcional && st?.noAplica)) okDoc += 1;
    else faltantes.push(doc.nombre);
  });
  bloques.push({ label: "Documentación requerida", completos: okDoc, total: REQUIRED_DOCS.length });

  // Verificaciones
  let okVer = 0;
  const geoOk = !!(d.georreferenciacion.coordenadas || d.georreferenciacion.mapsUrl);
  if (geoOk) okVer += 1; else faltantes.push("Georreferenciación de la empresa");
  const ofacEmpresa = d.ofac.some((o) => o.tipo === "Empresa" && o.resultado !== "Pendiente");
  const ofacRep = d.ofac.some((o) => o.tipo === "Representante legal" && o.resultado !== "Pendiente");
  if (ofacEmpresa) okVer += 1; else faltantes.push("Consulta OFAC de la empresa");
  if (ofacRep) okVer += 1; else faltantes.push("Consulta OFAC del representante legal");
  bloques.push({ label: "Verificaciones", completos: okVer, total: 3 });

  // Información requerida
  const infoKeys: (keyof PartnerDossier["info"])[] = [
    "inicioOperaciones", "actividadEconomica", "cantidadEmpleados", "tipoProveedor", "productosServicios",
  ];
  const infoLabels: Record<string, string> = {
    inicioOperaciones: "Fecha de inicio de operaciones",
    actividadEconomica: "Actividad económica principal",
    cantidadEmpleados: "Cantidad de empleados",
    tipoProveedor: "Tipo de proveedor",
    productosServicios: "Productos o servicios ofrecidos",
  };
  let okInfo = 0;
  infoKeys.forEach((k) => {
    if (String(d.info[k] || "").trim()) okInfo += 1;
    else faltantes.push(infoLabels[k]);
  });
  const refsOk = d.referencias.filter((r) => r.empresa.trim()).length;
  const refsCompletas = Math.min(refsOk, 2);
  if (refsOk < 2) faltantes.push(`Referencias comerciales (${refsOk}/2)`);
  bloques.push({ label: "Información requerida", completos: okInfo + refsCompletas, total: infoKeys.length + 2 });

  const total = bloques.reduce((s, b) => s + b.total, 0);
  const completos = bloques.reduce((s, b) => s + b.completos, 0);
  return { total, completos, porcentaje: total ? Math.round((completos / total) * 100) : 0, faltantes, bloques };
}

export function dossierEstado(p: DossierProgress): { label: string; className: string } {
  if (p.porcentaje >= 100) return { label: "Expediente completo", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" };
  if (p.porcentaje >= 60) return { label: "En proceso", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" };
  if (p.porcentaje > 0) return { label: "Incompleto", className: "bg-orange-500/10 text-orange-600 border-orange-500/30" };
  return { label: "Sin iniciar", className: "bg-muted text-muted-foreground border-border" };
}

export function uidRef(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
