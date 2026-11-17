import * as XLSX from "xlsx";
import type { BillingReport } from "./billingAnalysisTypes";
import { FREQ_LABEL } from "./billingAnalysisTypes";

/** Libro Excel con una hoja por sección del análisis (cifras tal como vienen de SafeOne). */
export function exportBillingWorkbook(r: BillingReport) {
  const cat = (k: string) => r.categorias[k] || k;
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Record<string, unknown>[]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nota: "Sin datos" }]), name);

  add("Resumen", [
    { Indicador: "Período", Valor: `${r.periodo.desde} a ${r.periodo.hasta}` },
    { Indicador: "Facturas", Valor: r.resumen.facturas },
    { Indicador: "Clientes facturados", Valor: r.resumen.clientes },
    { Indicador: "Facturación bruta", Valor: r.resumen.bruto },
    { Indicador: "ITBIS", Valor: r.resumen.itbis },
    { Indicador: "Total facturado", Valor: r.resumen.neto },
    { Indicador: "Promedio por factura", Valor: r.resumen.promedio },
    { Indicador: "Mediana por factura", Valor: r.resumen.mediana },
    { Indicador: "Recurrente (estimado)", Valor: r.resumen.recurrenteEstimado },
    { Indicador: "Extraordinario (estimado)", Valor: r.resumen.extraordinarioEstimado },
    { Indicador: "Monitoreo (estimado)", Valor: r.resumen.monitoreoEstimado },
    { Indicador: "Participación top 10 (%)", Valor: r.resumen.top10Participacion },
    { Indicador: "Nota", Valor: "Clasificación por palabras del concepto: pendiente de validación." },
  ]);
  add("Clientes", r.porCliente.map((c) => ({
    Cliente: c.nombre, Codigo: c.codigo, RNC: c.rnc, Clasificacion: c.clasificacion, Facturas: c.facturas, Meses: c.meses,
    Frecuencia: FREQ_LABEL[c.frecuencia], Primera: c.primera, Ultima: c.ultima, Bruto: c.bruto, ITBIS: c.itbis, Neto: c.neto,
    "Participación %": c.participacion, "Servicio principal": cat(c.categoriaPrincipal),
    "Tarifa estimada": c.tarifas[0]?.importe ?? "", "Meses con esa tarifa": c.tarifas[0]?.meses ?? "",
    "Última factura": c.ultimas[0] ? `${c.ultimas[0].numero} · ${c.ultimas[0].fecha} · ${c.ultimas[0].bruto}` : "",
    "Penúltima": c.ultimas[1] ? `${c.ultimas[1].numero} · ${c.ultimas[1].fecha} · ${c.ultimas[1].bruto}` : "",
    "Antepenúltima": c.ultimas[2] ? `${c.ultimas[2].numero} · ${c.ultimas[2].fecha} · ${c.ultimas[2].bruto}` : "",
    "Excluido de monitoreo": c.excluidoMonitoreo || "",
  })));
  add("Precios por servicio", r.porCategoria.flatMap((g) => g.detalle.map((d) => ({
    Servicio: g.label, Cliente: d.nombre, Facturas: d.facturas, Meses: d.meses, "Importe típico": d.tipico, "Último importe": d.ultimo, "Total bruto": d.bruto,
  }))));
  if (r.porDescripcion) {
    add("Precios por concepto", r.porDescripcion.flatMap((g) => g.detalle.map((d) => ({
      Concepto: g.descripcion, Servicio: cat(g.categoria), Cliente: d.nombre, "Precio típico": d.precioTipico, "Último precio": d.ultimo, Veces: d.veces,
    }))));
  }
  add("Mensual", r.mensual.map((m) => ({ Mes: m.mes, Facturas: m.facturas, Clientes: m.clientes, Bruto: m.bruto, Neto: m.neto, "Variación %": m.variacion ?? "" })));
  add("Facturas", r.porCliente.flatMap((c) => c.historial.map((i) => ({
    Cliente: c.nombre, Numero: i.numero, NCF: i.ncf, Fecha: i.fecha, Concepto: i.comentario, Servicio: cat(i.categoria), Bruto: i.bruto, ITBIS: i.itbis, Neto: i.neto,
  }))));
  add("Calidad de datos", r.calidad.map((q) => ({ Tipo: q.tipo, Referencia: q.ref, Detalle: q.detalle })));
  XLSX.writeFile(wb, `analisis-facturacion_${r.periodo.desde}_${r.periodo.hasta}.xlsx`);
}
