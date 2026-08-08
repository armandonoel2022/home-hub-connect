import { useEffect, useMemo, useState } from "react";
import { generalSqlApi, type GeneralActiveEmployee } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, RefreshCw, Database, AlertTriangle } from "lucide-react";

const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString("es-DO") : "—");

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** Empleados activos leídos en vivo de gSafeOne (Empleado.Estatus = 0, GCRecord IS NULL). */
export default function ActiveEmployeesSql({ open, onOpenChange }: Props) {
  const [items, setItems] = useState<GeneralActiveEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generalSqlApi.employeesActive();
      setItems(res.items || []);
    } catch (e: any) {
      setError(e?.message || "No se pudo consultar gSafeOne");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter(e =>
      [e.nombreCompleto, e.codigo, e.cedula, e.puesto, e.departamento]
        .some(v => String(v || "").toLowerCase().includes(s))
    );
  }, [items, search]);

  const exportCSV = () => {
    const headers = ["OID", "Código", "Nombre completo", "Cédula", "Puesto", "Departamento", "Sexo", "Nacimiento", "Edad", "Nacionalidad", "Nivel educativo", "Ingreso"];
    const rows = filtered.map(e => [e.oid, e.codigo, e.nombreCompleto, e.cedula, e.puesto, e.departamento, e.sexo, fmtDate(e.fechaNacimiento), e.edad, e.nacionalidad, e.nivelEducativo, fmtDate(e.fechaIngreso)]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c ?? ""}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `empleados_activos_general_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-gold" />
            Empleados activos (GENERAL · gSafeOne)
            <Badge variant="secondary">{filtered.length}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nombre, código, cédula o puesto..." value={search} onChange={e => setSearch(e.target.value)} />
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
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-auto flex-1 border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre completo</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Sexo</TableHead>
                <TableHead>Nacimiento</TableHead>
                <TableHead className="text-right">Edad</TableHead>
                <TableHead>Nacionalidad</TableHead>
                <TableHead>Ingreso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Consultando gSafeOne...</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Sin resultados</TableCell></TableRow>
              )}
              {filtered.map(e => (
                <TableRow key={e.oid}>
                  <TableCell className="font-mono text-xs">{e.codigo || "—"}</TableCell>
                  <TableCell className="font-medium">{e.nombreCompleto}</TableCell>
                  <TableCell className="font-mono text-xs">{e.cedula || "—"}</TableCell>
                  <TableCell>{e.puesto || "—"}</TableCell>
                  <TableCell>{e.departamento || "—"}</TableCell>
                  <TableCell>{e.sexo || "—"}</TableCell>
                  <TableCell>{fmtDate(e.fechaNacimiento)}</TableCell>
                  <TableCell className="text-right">{e.edad ?? "—"}</TableCell>
                  <TableCell>{e.nacionalidad || "—"}</TableCell>
                  <TableCell>{fmtDate(e.fechaIngreso)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
