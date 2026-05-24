import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  loadMatrix,
  createRecord,
  updateRecord,
  deleteRecord,
  MATRIX_SUMMARY,
  type MaintenanceMatrixRecord,
} from "@/lib/maintenanceMatrixData";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  Plus,
  Trash2,
  Edit2,
  MapPin,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileWarning,
  Filter as FilterIcon,
  Download,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  "En buenas condiciones": "hsl(142 70% 45%)",
  "Falta de mantenimiento": "hsl(38 92% 50%)",
  "Arma no apta": "hsl(0 75% 55%)",
  "Sin estatus": "hsl(0 0% 55%)",
};

const TYPE_COLORS: Record<string, string> = {
  Escopeta: "hsl(220 70% 50%)",
  Pistola: "hsl(280 60% 55%)",
  Revolver: "hsl(20 80% 55%)",
  Otra: "hsl(0 0% 55%)",
};

type FilterKey =
  | "estatus"
  | "arma"
  | "marca"
  | "provincia"
  | "cliente"
  | "vigilante"
  | "capsulasBucket"
  | "serialVisible"
  | "tieneVigilante"
  | "tieneCoordenada";

interface FilterState {
  estatus: string;
  arma: string;
  marca: string;
  provincia: string;
  cliente: string;
  vigilante: string;
  capsulasBucket: string; // "0-2" | "3-4" | "5-6" | "7-8"
  serialVisible: string; // "si" | "no"
  tieneVigilante: string;
  tieneCoordenada: string;
  search: string;
}

const EMPTY_FILTERS: FilterState = {
  estatus: "",
  arma: "",
  marca: "",
  provincia: "",
  cliente: "",
  vigilante: "",
  capsulasBucket: "",
  serialVisible: "",
  tieneVigilante: "",
  tieneCoordenada: "",
  search: "",
};

const ESTATUS_OPTS = ["En buenas condiciones", "Falta de mantenimiento", "Arma no apta", "Sin estatus"];

function isInvisibleSerial(s: string): boolean {
  const t = (s || "").trim().toLowerCase();
  return !t || t.includes("no visible") || t.includes("borros");
}
function bucketCapsulas(n: number | null): string {
  if (n == null) return "Sin dato";
  if (n <= 2) return "0-2";
  if (n <= 4) return "3-4";
  if (n <= 6) return "5-6";
  return "7-8";
}

export default function OperationsMaintenanceMatrix() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<MaintenanceMatrixRecord[]>([]);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [editing, setEditing] = useState<MaintenanceMatrixRecord | null>(null);
  const [showForm, setShowForm] = useState(false);

  const canEdit =
    user?.department === "Operaciones" ||
    user?.role === "admin" ||
    user?.department === "Gerencia General" ||
    user?.department === "Calidad";

  useEffect(() => {
    setRecords(loadMatrix());
  }, []);

  // ── Derived filter options ──
  const opts = useMemo(() => {
    const u = <K extends keyof MaintenanceMatrixRecord>(k: K) =>
      Array.from(new Set(records.map((r) => String(r[k] ?? "")).filter(Boolean))).sort();
    return {
      arma: u("arma"),
      marca: u("marca"),
      provincia: u("provincia"),
      cliente: u("cliente"),
      vigilante: u("vigilante"),
    };
  }, [records]);

  // ── Apply filters ──
  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filters.estatus) {
        const est = r.estatus || "Sin estatus";
        if (est !== filters.estatus) return false;
      }
      if (filters.arma && r.arma !== filters.arma) return false;
      if (filters.marca && r.marca !== filters.marca) return false;
      if (filters.provincia && r.provincia !== filters.provincia) return false;
      if (filters.cliente && r.cliente !== filters.cliente) return false;
      if (filters.vigilante && r.vigilante !== filters.vigilante) return false;
      if (filters.capsulasBucket) {
        if (bucketCapsulas(r.capsulas) !== filters.capsulasBucket) return false;
      }
      if (filters.serialVisible === "si" && isInvisibleSerial(r.serial)) return false;
      if (filters.serialVisible === "no" && !isInvisibleSerial(r.serial)) return false;
      if (filters.tieneVigilante === "si" && !r.vigilante.trim()) return false;
      if (filters.tieneVigilante === "no" && r.vigilante.trim()) return false;
      if (filters.tieneCoordenada === "si" && !r.coordenada.trim()) return false;
      if (filters.tieneCoordenada === "no" && r.coordenada.trim()) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = [r.cliente, r.puesto, r.serial, r.vigilante, r.marca, r.provincia, r.arma]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, filters]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const t = filtered.length;
    const buen = filtered.filter((r) => r.estatus === "En buenas condiciones").length;
    const mant = filtered.filter((r) => r.estatus === "Falta de mantenimiento").length;
    const noApta = filtered.filter((r) => r.estatus === "Arma no apta").length;
    const sinSerial = filtered.filter((r) => isInvisibleSerial(r.serial)).length;
    const sinVig = filtered.filter((r) => !r.vigilante.trim()).length;
    const sinCoord = filtered.filter((r) => !r.coordenada.trim()).length;
    return { t, buen, mant, noApta, sinSerial, sinVig, sinCoord };
  }, [filtered]);

  // ── Chart data ──
  const byEstatus = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => {
      const k = r.estatus || "Sin estatus";
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const byTipo = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => m.set(r.arma, (m.get(r.arma) || 0) + 1));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const byProvincia = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => m.set(r.provincia || "Sin provincia", (m.get(r.provincia || "Sin provincia") || 0) + 1));
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const byMarca = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => m.set(r.marca || "Sin marca", (m.get(r.marca || "Sin marca") || 0) + 1));
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered]);

  const topClientesIrregulares = useMemo(() => {
    const m = new Map<string, number>();
    filtered
      .filter((r) => r.estatus === "Falta de mantenimiento" || r.estatus === "Arma no apta")
      .forEach((r) => m.set(r.cliente, (m.get(r.cliente) || 0) + 1));
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filtered]);

  // ── Helpers ──
  const setFilter = (k: keyof FilterState, v: string) =>
    setFilters((f) => ({ ...f, [k]: v === f[k] ? "" : v }));

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const handleSave = (data: Partial<MaintenanceMatrixRecord>) => {
    if (editing) {
      const upd = updateRecord(editing.id, data);
      if (upd) {
        setRecords(loadMatrix());
        toast({ title: "Registro actualizado" });
      }
    } else {
      createRecord(data);
      setRecords(loadMatrix());
      toast({ title: "Registro creado" });
    }
    setEditing(null);
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm("¿Eliminar este registro de la matriz?")) return;
    deleteRecord(id);
    setRecords(loadMatrix());
    toast({ title: "Registro eliminado" });
  };

  const exportCSV = () => {
    const headers = [
      "Cliente", "Puesto", "Provincia", "Arma", "Marca", "Serial",
      "Tipo", "Capsulas", "Estatus", "Vigilante", "Coordenada",
    ];
    const rows = filtered.map((r) => [
      r.cliente, r.puesto, r.provincia, r.arma, r.marca, r.serial,
      r.tipo, r.capsulas ?? "", r.estatus, r.vigilante, r.coordenada,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matriz-mantenimiento-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-7 w-7 text-primary" />
              Matriz de Levantamiento
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Estado de mantenimiento, documentación y trazabilidad de armas
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV} className="gap-2">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
            {canEdit && (
              <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Agregar arma
              </Button>
            )}
          </div>
        </div>

        {/* Documentación oficial */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{MATRIX_SUMMARY.certificadasMIP.label}</p>
              <p className="text-3xl font-heading font-bold mt-2">
                {MATRIX_SUMMARY.certificadasMIP.actual}<span className="text-muted-foreground text-lg">/{MATRIX_SUMMARY.certificadasMIP.total}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Certificadas por MIP</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{MATRIX_SUMMARY.licenciasFisicas.label}</p>
              <p className="text-3xl font-heading font-bold mt-2">
                {MATRIX_SUMMARY.licenciasFisicas.actual}<span className="text-muted-foreground text-lg">/{MATRIX_SUMMARY.licenciasFisicas.total}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Según inventario físico</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-destructive">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{MATRIX_SUMMARY.sinDocumentacion.label}</p>
              <p className="text-3xl font-heading font-bold mt-2 text-destructive">
                {MATRIX_SUMMARY.sinDocumentacion.actual}<span className="text-muted-foreground text-lg">/{MATRIX_SUMMARY.sinDocumentacion.total}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Riesgo de cumplimiento</p>
            </CardContent>
          </Card>
        </div>

        {/* KPI mini cards (clicables) */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <button
            onClick={clearFilters}
            className={`p-3 rounded-lg border text-left transition hover:shadow-md ${Object.values(filters).every((v) => !v) ? "border-primary bg-primary/10" : "border-border bg-card"}`}
          >
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-heading font-bold">{kpis.t}</p>
          </button>
          <button
            onClick={() => setFilter("estatus", "En buenas condiciones")}
            className={`p-3 rounded-lg border text-left transition hover:shadow-md ${filters.estatus === "En buenas condiciones" ? "border-green-500 bg-green-500/10" : "border-border bg-card"}`}
          >
            <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" />En buen estado</p>
            <p className="text-2xl font-heading font-bold text-green-600">{kpis.buen}</p>
          </button>
          <button
            onClick={() => setFilter("estatus", "Falta de mantenimiento")}
            className={`p-3 rounded-lg border text-left transition hover:shadow-md ${filters.estatus === "Falta de mantenimiento" ? "border-amber-500 bg-amber-500/10" : "border-border bg-card"}`}
          >
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" />Falta mant.</p>
            <p className="text-2xl font-heading font-bold text-amber-600">{kpis.mant}</p>
          </button>
          <button
            onClick={() => setFilter("estatus", "Arma no apta")}
            className={`p-3 rounded-lg border text-left transition hover:shadow-md ${filters.estatus === "Arma no apta" ? "border-red-500 bg-red-500/10" : "border-border bg-card"}`}
          >
            <p className="text-xs text-muted-foreground flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" />No apta</p>
            <p className="text-2xl font-heading font-bold text-red-600">{kpis.noApta}</p>
          </button>
          <button
            onClick={() => setFilter("serialVisible", "no")}
            className={`p-3 rounded-lg border text-left transition hover:shadow-md ${filters.serialVisible === "no" ? "border-orange-500 bg-orange-500/10" : "border-border bg-card"}`}
          >
            <p className="text-xs text-muted-foreground flex items-center gap-1"><FileWarning className="h-3 w-3 text-orange-500" />Sin serial</p>
            <p className="text-2xl font-heading font-bold text-orange-600">{kpis.sinSerial}</p>
          </button>
          <button
            onClick={() => setFilter("tieneVigilante", "no")}
            className={`p-3 rounded-lg border text-left transition hover:shadow-md ${filters.tieneVigilante === "no" ? "border-violet-500 bg-violet-500/10" : "border-border bg-card"}`}
          >
            <p className="text-xs text-muted-foreground">Sin vigilante</p>
            <p className="text-2xl font-heading font-bold text-violet-600">{kpis.sinVig}</p>
          </button>
          <button
            onClick={() => setFilter("tieneCoordenada", "no")}
            className={`p-3 rounded-lg border text-left transition hover:shadow-md ${filters.tieneCoordenada === "no" ? "border-blue-500 bg-blue-500/10" : "border-border bg-card"}`}
          >
            <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Sin ubicación</p>
            <p className="text-2xl font-heading font-bold text-blue-600">{kpis.sinCoord}</p>
          </button>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FilterIcon className="h-4 w-4" /> Filtros
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>Limpiar</Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Input
              placeholder="Buscar..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
            <SelectFilter label="Arma" value={filters.arma} options={opts.arma} onChange={(v) => setFilter("arma", v)} />
            <SelectFilter label="Marca" value={filters.marca} options={opts.marca} onChange={(v) => setFilter("marca", v)} />
            <SelectFilter label="Provincia" value={filters.provincia} options={opts.provincia} onChange={(v) => setFilter("provincia", v)} />
            <SelectFilter label="Cliente" value={filters.cliente} options={opts.cliente} onChange={(v) => setFilter("cliente", v)} />
            <SelectFilter label="Vigilante" value={filters.vigilante} options={opts.vigilante} onChange={(v) => setFilter("vigilante", v)} />
            <SelectFilter label="Estatus" value={filters.estatus} options={ESTATUS_OPTS} onChange={(v) => setFilter("estatus", v)} />
            <SelectFilter label="Cápsulas" value={filters.capsulasBucket} options={["0-2", "3-4", "5-6", "7-8", "Sin dato"]} onChange={(v) => setFilter("capsulasBucket", v)} />
            <SelectFilter label="Serial visible" value={filters.serialVisible} options={["si", "no"]} onChange={(v) => setFilter("serialVisible", v)} />
            <SelectFilter label="Tiene coordenada" value={filters.tieneCoordenada} options={["si", "no"]} onChange={(v) => setFilter("tieneCoordenada", v)} />
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Por estatus operativo</CardTitle></CardHeader>
            <CardContent style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byEstatus} dataKey="value" nameKey="name" outerRadius={90} label
                    onClick={(d: any) => setFilter("estatus", d.name)} cursor="pointer">
                    {byEstatus.map((e, i) => (
                      <Cell key={i} fill={STATUS_COLORS[e.name] || "hsl(var(--muted-foreground))"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Por tipo de arma</CardTitle></CardHeader>
            <CardContent style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byTipo} dataKey="value" nameKey="name" outerRadius={90} label
                    onClick={(d: any) => setFilter("arma", d.name)} cursor="pointer">
                    {byTipo.map((e, i) => (
                      <Cell key={i} fill={TYPE_COLORS[e.name] || "hsl(var(--muted-foreground))"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Por provincia</CardTitle></CardHeader>
            <CardContent style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byProvincia} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" cursor="pointer" onClick={(d: any) => setFilter("provincia", d.name)} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Top 10 marcas</CardTitle></CardHeader>
            <CardContent style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMarca}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(38 92% 50%)" cursor="pointer" onClick={(d: any) => setFilter("marca", d.name)} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {topClientesIrregulares.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Top clientes con armas irregulares
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topClientesIrregulares.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setFilter("cliente", c.name)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted transition text-left"
                  >
                    <span className="font-medium text-sm">{c.name}</span>
                    <Badge variant="destructive">{c.value} armas</Badge>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabla */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalle ({filtered.length} de {records.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-2">Cliente</th>
                  <th className="py-2 pr-2">Puesto</th>
                  <th className="py-2 pr-2">Provincia</th>
                  <th className="py-2 pr-2">Arma</th>
                  <th className="py-2 pr-2">Marca</th>
                  <th className="py-2 pr-2">Serial</th>
                  <th className="py-2 pr-2">Cáps.</th>
                  <th className="py-2 pr-2">Estatus</th>
                  <th className="py-2 pr-2">Vigilante</th>
                  <th className="py-2 pr-2">Ubicación</th>
                  {canEdit && <th className="py-2 pr-2"></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const est = r.estatus || "Sin estatus";
                  return (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-2 font-medium">{r.cliente}</td>
                      <td className="py-2 pr-2">{r.puesto}</td>
                      <td className="py-2 pr-2 text-xs">{r.provincia}</td>
                      <td className="py-2 pr-2">
                        <Badge variant="outline" style={{ borderColor: TYPE_COLORS[r.arma] }}>{r.arma}</Badge>
                      </td>
                      <td className="py-2 pr-2">{r.marca}</td>
                      <td className="py-2 pr-2 font-mono text-xs">
                        {isInvisibleSerial(r.serial) ? (
                          <span className="text-orange-600">{r.serial || "—"}</span>
                        ) : r.serial}
                      </td>
                      <td className="py-2 pr-2 text-center">{r.capsulas ?? "—"}</td>
                      <td className="py-2 pr-2">
                        <Badge
                          style={{
                            backgroundColor: STATUS_COLORS[est] || "hsl(var(--muted))",
                            color: "white",
                          }}
                        >
                          {est}
                        </Badge>
                      </td>
                      <td className="py-2 pr-2">{r.vigilante || <span className="text-muted-foreground italic">Sin asignar</span>}</td>
                      <td className="py-2 pr-2">
                        {r.coordenada ? (
                          <a href={r.coordenada} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Ver
                          </a>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      {canEdit && (
                        <td className="py-2 pr-2">
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setShowForm(true); }}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={canEdit ? 11 : 10} className="py-8 text-center text-muted-foreground">
                    No hay registros con los filtros aplicados
                  </td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {showForm && canEdit && (
        <RecordFormModal
          record={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </AppLayout>
  );
}

// ── Sub-componentes ──
function SelectFilter({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value || "__all__"} onValueChange={(v) => onChange(v === "__all__" ? "" : v)}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function RecordFormModal({
  record, onClose, onSave,
}: { record: MaintenanceMatrixRecord | null; onClose: () => void; onSave: (d: Partial<MaintenanceMatrixRecord>) => void }) {
  const [form, setForm] = useState<Partial<MaintenanceMatrixRecord>>(
    record || { arma: "Escopeta", tipo: "Letal", estatus: "Falta de mantenimiento" }
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl my-8">
        <CardHeader>
          <CardTitle>{record ? "Editar registro" : "Nuevo registro"}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field label="Cliente"><Input value={form.cliente || ""} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></Field>
          <Field label="Puesto"><Input value={form.puesto || ""} onChange={(e) => setForm({ ...form, puesto: e.target.value })} /></Field>
          <Field label="Provincia"><Input value={form.provincia || ""} onChange={(e) => setForm({ ...form, provincia: e.target.value })} /></Field>
          <Field label="Arma">
            <Select value={form.arma || "Escopeta"} onValueChange={(v) => setForm({ ...form, arma: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Escopeta", "Pistola", "Revolver", "Otra"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Marca"><Input value={form.marca || ""} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></Field>
          <Field label="Serial"><Input value={form.serial || ""} onChange={(e) => setForm({ ...form, serial: e.target.value })} /></Field>
          <Field label="Tipo"><Input value={form.tipo || ""} onChange={(e) => setForm({ ...form, tipo: e.target.value })} /></Field>
          <Field label="Cápsulas">
            <Input
              type="number"
              value={form.capsulas ?? ""}
              onChange={(e) => setForm({ ...form, capsulas: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </Field>
          <Field label="Estatus">
            <Select value={form.estatus || ""} onValueChange={(v) => setForm({ ...form, estatus: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {ESTATUS_OPTS.filter(o => o !== "Sin estatus").map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Vigilante"><Input value={form.vigilante || ""} onChange={(e) => setForm({ ...form, vigilante: e.target.value })} /></Field>
          <Field label="Coordenada / link Maps" full>
            <Input value={form.coordenada || ""} onChange={(e) => setForm({ ...form, coordenada: e.target.value })} placeholder="https://maps.app.goo.gl/..." />
          </Field>
          <Field label="Observaciones" full>
            <Input value={form.observaciones || ""} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
          </Field>
        </CardContent>
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(form)}>{record ? "Guardar" : "Crear"}</Button>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
