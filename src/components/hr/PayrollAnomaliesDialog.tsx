import { useEffect, useMemo, useState } from "react";
import {
  generalSqlApi,
  type GeneralPayrollAnomalies,
  type GeneralPayrollAnomalyItem,
} from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Download, RefreshCw, Search, Siren } from "lucide-react";
import { payDateLabel, periodLabel } from "@/lib/generalPayslipPdf";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 2 }).format(n || 0);

type Grupo = "todas" | "reales" | "deducciones_suben" | "nuevas" | "duplicidad" | "eliminadas" | "ingresos" | "reclasificaciones";

const GRUPOS: Array<{ value: Grupo; label: string }> = [
  { value: "reales", label: "Solo anomalías reales (sin reclasificaciones)" },
  { value: "todas", label: "Todas las anomalías" },
  { value: "deducciones_suben", label: "Deducciones que aumentan" },
  { value: "nuevas", label: "Conceptos nuevos (antes no se cobraba)" },
  { value: "duplicidad", label: "Duplicidades reales (mismo pago)" },
  { value: "eliminadas", label: "Conceptos que desaparecieron" },
  { value: "ingresos", label: "Variaciones de ingresos" },
  { value: "reclasificaciones", label: "Reclasificaciones (mismo total devengado)" },
];

function matchGrupo(i: GeneralPayrollAnomalyItem, g: Grupo) {
  switch (g) {
    case "reales": return i.anomalia !== "Reclasificación de concepto";
    case "deducciones_suben": return i.anomalia === "Aumento de deducción";
    case "nuevas": return i.anomalia === "Deducción nueva" || i.anomalia === "Ingreso nuevo";
    case "duplicidad": return i.anomalia === "Duplicidad de concepto";
    case "eliminadas": return i.anomalia.includes("eliminad");
    case "ingresos": return i.tipo === "Ingreso" && i.anomalia !== "Reclasificación de concepto";
    case "reclasificaciones": return i.anomalia === "Reclasificación de concepto";
    default: return true;
  }
}


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Período seleccionado en el panel; si no se pasa se usa la última nómina. */
  period?: { ano: number; mes: number; periodo: number } | null;
}

/** Detección masiva de anomalías de nómina: quincena actual vs quincena anterior. */
export default function PayrollAnomaliesDialog({ open, onOpenChange, period }: Props) {
  const [data, setData] = useState<GeneralPayrollAnomalies | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [grupo, setGrupo] = useState<Grupo>("todas");

  const load = async () => {
    setLoading(true); setError(null);
    try {
      setData(await generalSqlApi.payrollAnomalies(period || undefined));
    } catch (e: any) {
      setError(e?.message || "No se pudo analizar la nómina");
      setData(null);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, period?.ano, period?.mes, period?.periodo]);

  const items = data?.items || [];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter(i =>
      matchGrupo(i, grupo) &&
      (!s || [i.empleado, i.codigo, i.cedula, i.concepto, i.anomalia].some(v => String(v || "").toLowerCase().includes(s)))
    );
  }, [items, grupo, search]);

  const exportCSV = () => {
    const headers = ["Código", "Empleado", "Cédula", "Concepto", "Tipo", "Anomalía", "Severidad",
      "Monto actual", "Monto anterior", "Diferencia", "Variación %", "Nota"];
    const rows = filtered.map(i => [
      i.codigo, i.empleado, i.cedula, i.concepto, i.tipo, i.anomalia, i.severidad,
      i.actual, i.anterior, i.diferencia, i.variacion ?? "", i.nota,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const p = data?.actual;
    a.download = `anomalias_nomina_${p ? `${p.ano}-${String(p.mes).padStart(2, "0")}-Q${p.periodo}` : "actual"}.csv`;
    a.click();
  };

  const r = data?.resumen || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-destructive" /> Anomalías de nómina
          </DialogTitle>
        </DialogHeader>

        {data?.actual && data?.anterior && (
          <p className="text-sm text-muted-foreground">
            Comparando <strong>{periodLabel(data.actual.periodo, data.actual.mes, data.actual.ano)}</strong>{" "}
            (pago {payDateLabel(data.actual.periodo, data.actual.mes, data.actual.ano)}) contra{" "}
            <strong>{periodLabel(data.anterior.periodo, data.anterior.mes, data.anterior.ano)}</strong>.
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5" /><span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Anomalías</p>
            <p className="text-xl font-bold">{r.total ?? 0}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Empleados afectados</p>
            <p className="text-xl font-bold">{r.empleados ?? 0}</p>
          </CardContent></Card>
          <Card className="border-destructive/40"><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Duplicidades</p>
            <p className="text-xl font-bold text-destructive">{r.duplicidades ?? 0}</p>
          </CardContent></Card>
          <Card className="border-amber-400/60"><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Deducciones nuevas</p>
            <p className="text-xl font-bold text-amber-600">{r.deduccionesNuevas ?? 0}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Impacto en deducciones</p>
            <p className="text-xl font-bold text-red-600">{fmt(r.impactoDeducciones ?? 0)}</p>
          </CardContent></Card>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar empleado, cédula o concepto..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={grupo} onValueChange={(v: Grupo) => setGrupo(v)}>
            <SelectTrigger className="w-[290px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {GRUPOS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Analizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>

        <div className="border rounded-md overflow-auto max-h-[50vh]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead className="min-w-[200px]">Empleado</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Anomalía</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Anterior</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead className="text-right">Var.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Analizando nómina completa...</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin anomalías para este filtro</TableCell></TableRow>
              )}
              {filtered.map((i, k) => (
                <TableRow key={`${i.codigo}-${i.concepto}-${i.anomalia}-${k}`} className={i.severidad === "alta" ? "bg-destructive/5" : ""}>
                  <TableCell className="font-mono text-xs">{i.codigo || "—"}</TableCell>
                  <TableCell className="font-medium">{i.empleado}</TableCell>
                  <TableCell>{i.concepto}</TableCell>
                  <TableCell>
                    <Badge variant={i.severidad === "alta" ? "destructive" : "secondary"}>{i.anomalia}</Badge>
                    {i.nota && <p className="text-[11px] text-muted-foreground mt-1">{i.nota}</p>}
                  </TableCell>
                  <TableCell className="text-right">{fmt(i.actual)}</TableCell>
                  <TableCell className="text-right">{fmt(i.anterior)}</TableCell>
                  <TableCell className={`text-right font-semibold ${i.diferencia >= 0 ? "text-red-600" : "text-green-600"}`}>
                    {fmt(i.diferencia)}
                  </TableCell>
                  <TableCell className="text-right">{i.variacion == null ? "—" : `${i.variacion}%`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          {filtered.length} de {items.length} anomalías. Las deducciones que aumentan pueden revisarse por separado con el filtro correspondiente.
        </p>
      </DialogContent>
    </Dialog>
  );
}
