import { useEffect, useMemo, useState } from "react";
import { generalSqlApi, type GeneralPayslip, type GeneralPayslipsResponse } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, RefreshCw, Receipt, AlertTriangle } from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString("es-DO") : "—");

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** Comprobante de pago: último pago por empleado activo con conceptos desglosados (gSafeOne). */
export default function PayslipsSql({ open, onOpenChange }: Props) {
  const [data, setData] = useState<GeneralPayslipsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<GeneralPayslip | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await generalSqlApi.payslips());
    } catch (e: any) {
      setError(e?.message || "No se pudo consultar gSafeOne");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const items = data?.items || [];
  const ingresos = data?.conceptos.ingresos || [];
  const deducciones = data?.conceptos.deducciones || [];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter(i =>
      [i.empleado, i.codigo, i.cedula, i.puesto].some(v => String(v || "").toLowerCase().includes(s))
    );
  }, [items, search]);

  const exportCSV = () => {
    const headers = ["Empleado", "Código", "Cédula", "Puesto", "Fecha Pago", "Periodo", "Mes", "Año", "Nómina",
      ...ingresos, ...deducciones, "Total Devengado", "Total Deducciones", "Neto a Recibir"];
    const rows = filtered.map(i => [
      i.empleado, i.codigo, i.cedula, i.puesto, fmtDate(i.fechaPago), i.periodo, i.mes, i.ano, i.nomina,
      ...ingresos.map(c => i.ingresos[c] ?? 0),
      ...deducciones.map(c => i.deducciones[c] ?? 0),
      i.totalDevengado, i.totalDeducciones, i.neto,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c ?? ""}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `comprobantes_pago_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-gold" />
              Comprobante de pago · último pago por empleado (GENERAL)
              <Badge variant="secondary">{filtered.length}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar empleado, código, cédula o puesto..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5" /><span>{error}</span>
            </div>
          )}

          {data && (
            <div className="grid grid-cols-3 gap-3">
              <Card><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Total devengado</p>
                <p className="text-lg font-bold text-green-600">{fmt(data.totals.devengado)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Total deducciones</p>
                <p className="text-lg font-bold text-red-600">{fmt(data.totals.deducciones)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Neto a recibir</p>
                <p className="text-lg font-bold text-gold">{fmt(data.totals.neto)}</p>
              </CardContent></Card>
            </div>
          )}

          <div className="overflow-auto flex-1 border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="min-w-[200px]">Empleado</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Puesto</TableHead>
                  <TableHead>Fecha pago</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Mes/Año</TableHead>
                  {ingresos.map(c => <TableHead key={c} className="text-right whitespace-nowrap">{c}</TableHead>)}
                  {deducciones.map(c => <TableHead key={c} className="text-right whitespace-nowrap text-red-600">{c}</TableHead>)}
                  <TableHead className="text-right">Devengado</TableHead>
                  <TableHead className="text-right">Deducciones</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Consultando gSafeOne...</TableCell></TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Sin resultados</TableCell></TableRow>
                )}
                {filtered.map((i, idx) => (
                  <TableRow key={`${i.codigo}-${idx}`} className="cursor-pointer" onClick={() => setDetail(i)}>
                    <TableCell className="font-medium">{i.empleado}</TableCell>
                    <TableCell className="font-mono text-xs">{i.codigo || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{i.cedula || "—"}</TableCell>
                    <TableCell>{i.puesto || "—"}</TableCell>
                    <TableCell>{fmtDate(i.fechaPago)}</TableCell>
                    <TableCell>{i.periodo ?? "—"}</TableCell>
                    <TableCell>{i.mes ?? "—"}/{i.ano ?? "—"}</TableCell>
                    {ingresos.map(c => <TableCell key={c} className="text-right">{(i.ingresos[c] || 0) ? fmt(i.ingresos[c]) : "—"}</TableCell>)}
                    {deducciones.map(c => <TableCell key={c} className="text-right text-red-600">{(i.deducciones[c] || 0) ? fmt(i.deducciones[c]) : "—"}</TableCell>)}
                    <TableCell className="text-right font-semibold text-green-600">{fmt(i.totalDevengado)}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">{fmt(i.totalDeducciones)}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(i.neto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comprobante individual */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Comprobante de pago</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Empleado: </span>{detail.empleado}</div>
                <div><span className="text-muted-foreground">Código: </span>{detail.codigo || "—"}</div>
                <div><span className="text-muted-foreground">Cédula: </span>{detail.cedula || "—"}</div>
                <div><span className="text-muted-foreground">Puesto: </span>{detail.puesto || "—"}</div>
                <div><span className="text-muted-foreground">Fecha: </span>{fmtDate(detail.fechaPago)}</div>
                <div><span className="text-muted-foreground">Periodo: </span>{detail.periodo ?? "—"} · {detail.mes ?? "—"}/{detail.ano ?? "—"}</div>
              </div>
              <div>
                <p className="font-semibold mb-1 text-green-600">Ingresos</p>
                {ingresos.filter(c => detail.ingresos[c]).map(c => (
                  <div key={c} className="flex justify-between border-b border-border/50 py-1">
                    <span>{c}</span><span>{fmt(detail.ingresos[c])}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold pt-1"><span>Total devengado</span><span>{fmt(detail.totalDevengado)}</span></div>
              </div>
              <div>
                <p className="font-semibold mb-1 text-red-600">Deducciones</p>
                {deducciones.filter(c => detail.deducciones[c]).map(c => (
                  <div key={c} className="flex justify-between border-b border-border/50 py-1">
                    <span>{c}</span><span>{fmt(detail.deducciones[c])}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold pt-1"><span>Total deducciones</span><span>{fmt(detail.totalDeducciones)}</span></div>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>Neto a recibir</span><span className="text-gold">{fmt(detail.neto)}</span>
              </div>
              <Button className="w-full" variant="outline" onClick={() => window.print()}>Imprimir</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
