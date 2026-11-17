// Tipos del análisis de facturación (calculado en el servidor por backend/lib/billingAnalysis.js).
export interface Distribution { n: number; min: number | null; p25: number | null; mediana: number | null; p75: number | null; max: number | null; promedio: number | null }
export interface BillingInvoice { numero: string; ncf: string | null; fecha: string; comentario: string; bruto: number; itbis: number; neto: number; categoria: string }
export interface BillingTariff { importe: number; meses: number; facturas: number; desde: string; hasta: string; categoria: string; estado: string }
export type BillingFrequency = "recurrente" | "ocasional" | "aislada";
export interface BillingClient {
  cliente: string; nombre: string; rnc: string | null; codigo: string | null; clasificacion: string | null; inactivo: boolean | null;
  facturas: number; meses: number; primera: string | null; ultima: string | null; facturasPorMes: number | null;
  frecuencia: BillingFrequency; bruto: number; itbis: number; neto: number; promedio: number; mediana: number; participacion: number;
  categorias: Record<string, number>; categoriaPrincipal: string; excluidoMonitoreo: string | null;
  mensualTipica?: number; clasificacionPorValidar?: string;
  tarifas: BillingTariff[]; ultimas: BillingInvoice[]; porMes: { mes: string; bruto: number; facturas: number }[]; historial: BillingInvoice[];
}
export interface BillingCategory {
  categoria: string; label: string; recurrente: boolean; facturas: number; clientes: number; bruto: number;
  porFactura: Distribution; entreClientes: Distribution;
  detalle: { cliente: string; nombre: string; facturas: number; meses: number; tipico: number; bruto: number; ultimo: number | null }[];
}
export interface BillingLineGroup {
  descripcion: string; categoria: string; lineas: number; clientes: number; importe: number; precios: Distribution; dispersion: number | null;
  detalle: { cliente: string; nombre: string; precioTipico: number; veces: number; ultimo: number }[];
}
export interface BillingReport {
  periodo: { desde: string; hasta: string; meses: number };
  resumen: {
    facturas: number; clientes: number; bruto: number; itbis: number; neto: number; promedio: number; mediana: number;
    recurrenteEstimado: number; extraordinarioEstimado: number; monitoreoEstimado: number; clientesMonitoreo: number;
    mensualidadMonitoreoMediana?: number; clientesPorValidar?: number;
    clientesRecurrentes: number; clientesOcasionales: number; clientesAislados: number; top10Participacion: number; hhi: number; problemasCalidad: number;
  };
  categorias: Record<string, string>;
  excluidos: { cliente: string; nombre: string; motivo: string }[];
  mensual: ({ mes: string; bruto: number; neto: number; facturas: number; clientes: number; variacion: number | null } & Record<string, number | string | null>)[];
  porLinea?: { clasificacion: string; clientes: number; facturas: number; bruto: number; participacion: number }[];
  porCliente: BillingClient[];
  porCategoria: BillingCategory[];
  porDescripcion: BillingLineGroup[] | null;
  calidad: { tipo: string; detalle: string; ref: string | null }[];
  fuente?: { base: string; tablas: string[]; lineas: { tabla: string; filas: number; recortado: boolean } | null; leidoEn: string };
  cache?: boolean;
}
export interface BillingAccess { restringido: boolean; emails: string[]; puedeEditar: boolean }

export const CATEGORY_ORDER = ["monitoreo", "electronica_monitoreo", "electronica", "videoportero", "video", "gps", "acceso", "vigilancia", "instalacion", "mantenimiento", "adicionales", "equipos", "otros", "sin_concepto"];
export const categoryColor = (cat: string) => `hsl(var(--chart-${Math.min(CATEGORY_ORDER.indexOf(cat) + 1 || 14, 14)}))`;
export const FREQ_LABEL: Record<BillingFrequency, string> = { recurrente: "Recurrente", ocasional: "Ocasional", aislada: "Aislada" };
export const money = (n: number | null | undefined) =>
  n == null ? "—" : `RD$${Number(n).toLocaleString("es-DO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
export const pct = (n: number | null | undefined) => (n == null ? "—" : `${Number(n).toLocaleString("es-DO", { maximumFractionDigits: 1 })}%`);
export const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("es-DO", { month: "short", year: "2-digit", timeZone: "UTC" });
};
