import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { BillingClient } from "@/lib/billingAnalysisTypes";
import { FREQ_LABEL, categoryColor, money, monthLabel, pct } from "@/lib/billingAnalysisTypes";

export default function BillingClientSheet({ client, labels, onClose }: { client: BillingClient | null; labels: Record<string, string>; onClose: () => void }) {
  const c = client;
  const maxMes = c ? Math.max(...c.porMes.map((m) => m.bruto), 1) : 1;
  return (
    <Sheet open={!!c} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {c && (
          <>
            <SheetHeader>
              <SheetTitle className="font-heading text-xl">{c.nombre}</SheetTitle>
              <SheetDescription>
                {[c.codigo && `Código ${c.codigo}`, c.rnc && `RNC ${c.rnc}`, c.clasificacion].filter(Boolean).join(" · ") || "Sin datos de identificación"}
                {c.inactivo ? " · Inactivo en SafeOne" : ""}
              </SheetDescription>
            </SheetHeader>

            {c.excluidoMonitoreo && (
              <div className="mt-4 flex gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-primary" /> Excluido de la cartera de monitoreo: {c.excluidoMonitoreo}
              </div>
            )}

            {c.clasificacionPorValidar && (
              <div className="mt-3 flex gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-primary" /> Clasificación por validar: {c.clasificacionPorValidar} No suma a monitoreo hasta confirmarlo.
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Bruto", money(c.bruto)], ["Facturas", c.facturas], ["Meses", c.meses], ["Participación", pct(c.participacion)],
                ["Promedio", money(c.promedio)], ["Mediana", money(c.mediana)], ["Frecuencia", FREQ_LABEL[c.frecuencia]], ["Facturas/mes", c.facturasPorMes ?? "—"],
              ].map(([l, v]) => (
                <div key={String(l)} className="rounded-xl border bg-muted/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
                  <div className="font-heading text-sm font-bold">{v}</div>
                </div>
              ))}
            </div>

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Posible tarifa recurrente</h3>
            {c.tarifas.length ? (
              <div className="mt-2 space-y-2">
                {c.tarifas.slice(0, 3).map((t) => (
                  <div key={t.importe} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                    <div>
                      <div className="font-heading text-lg font-black">{money(t.importe)}</div>
                      <div className="text-xs text-muted-foreground">{t.meses} meses · {t.facturas} facturas · {monthLabel(t.desde)} – {monthLabel(t.hasta)} · {labels[t.categoria] || t.categoria}</div>
                    </div>
                    <Badge variant="outline">{t.estado}</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="mt-2 text-sm text-muted-foreground">No hay un mismo importe repetido en 3 o más meses.</p>}

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Últimas tres facturas</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {["Última", "Penúltima", "Antepenúltima"].map((l, i) => {
                const f = c.ultimas[i];
                return (
                  <div key={l} className="rounded-xl border p-3 text-xs">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
                    {f ? (
                      <>
                        <div className="mt-1 font-heading text-base font-bold">{money(f.bruto)}</div>
                        <div className="text-muted-foreground">#{f.numero} · {f.fecha}</div>
                        <div>ITBIS {money(f.itbis)} · Total {money(f.neto)}</div>
                        <div className="mt-1 line-clamp-3">{f.comentario || <em className="text-muted-foreground">Sin concepto</em>}</div>
                      </>
                    ) : <div className="mt-1 text-muted-foreground">—</div>}
                  </div>
                );
              })}
            </div>

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Por servicio (estimado)</h3>
            <div className="mt-2 space-y-1.5">
              {Object.entries(c.categorias).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: categoryColor(k) }} />
                  <span className="flex-1">{labels[k] || k}</span>
                  <span className="font-semibold">{money(v)}</span>
                </div>
              ))}
            </div>

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Facturación por mes</h3>
            <div className="mt-2 space-y-1">
              {c.porMes.map((m) => (
                <div key={m.mes} className="flex items-center gap-2 text-xs">
                  <span className="w-14 text-muted-foreground">{monthLabel(m.mes)}</span>
                  <div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(m.bruto / maxMes) * 100}%` }} /></div>
                  <span className="w-28 text-right font-medium">{money(m.bruto)}</span>
                  <span className="w-8 text-right text-muted-foreground">{m.facturas}</span>
                </div>
              ))}
            </div>

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Todas las facturas del período ({c.historial.length})</h3>
            <div className="mt-2 max-h-80 overflow-auto rounded-xl border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted text-left"><tr><th className="p-2">Fecha</th><th className="p-2">Número</th><th className="p-2">Concepto</th><th className="p-2 text-right">Bruto</th></tr></thead>
                <tbody>
                  {c.historial.map((f, i) => (
                    <tr key={`${f.numero}-${i}`} className="border-t align-top">
                      <td className="whitespace-nowrap p-2">{f.fecha}</td>
                      <td className="p-2">{f.numero}</td>
                      <td className="p-2"><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: categoryColor(f.categoria) }} />{f.comentario || "—"}</td>
                      <td className="whitespace-nowrap p-2 text-right">{money(f.bruto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
