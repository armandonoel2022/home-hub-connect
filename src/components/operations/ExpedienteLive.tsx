import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { generalSqlApi, type GeneralExpediente, type GeneralExpedienteCliente } from "@/lib/api";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import {
  Building2, MapPin, Crosshair, Users, ChevronDown, ChevronRight, RefreshCw,
  AlertTriangle, FileText, Phone, Mail, ExternalLink, ShieldCheck, ShieldOff, ListChecks, Download,
} from "lucide-react";

type FilterKey = "todos" | "armas" | "sinArma" | "novedad";

function mapsHref(addr: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(addr)}`;
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent?: string }) {
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${accent || "bg-primary/10 text-primary"}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      </div>
    </Card>
  );
}

const ExpedienteLive = ({ onUnavailable }: { onUnavailable?: () => void }) => {
  const { toast } = useToast();
  const [data, setData] = useState<GeneralExpediente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todos");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generalSqlApi.expediente();
      setData(res);
    } catch (e) {
      const msg = (e as Error)?.message || "No se pudo conectar con GENERAL";
      setError(msg);
      onUnavailable?.();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo<GeneralExpedienteCliente[]>(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    return data.clientes
      .map((c) => {
        let puestos = c.puestos;
        if (filter === "armas") puestos = puestos.filter((p) => p.requiereArma);
        else if (filter === "sinArma") puestos = puestos.filter((p) => !p.requiereArma);
        else if (filter === "novedad") puestos = puestos.filter((p) => p.novedad);
        return { ...c, puestos };
      })
      .filter((c) => c.puestos.length > 0)
      .filter((c) => !q || c.nombre.toLowerCase().includes(q) || String(c.codigo ?? "").includes(q));
  }, [data, search, filter]);

  const t = data?.totals || {};

  const exportSchema = async () => {
    try {
      toast({ title: "Consultando esquema…" });
      const keys = await generalSqlApi.schemaKeys();
      exportToExcel({
        title: "Esquema de llaves (PK/FK) — gSafeOne",
        columns: [
          { header: "Tabla", key: "tabla", width: 28 },
          { header: "Tipo", key: "tipo", width: 16 },
          { header: "Columna", key: "columna", width: 28 },
          { header: "Restricción", key: "restriccion", width: 36 },
        ],
        data: keys as unknown as Record<string, unknown>[],
        filename: "esquema_llaves_gsafeone",
      });
      toast({ title: "Esquema exportado" });
    } catch (e) {
      toast({ title: "No se pudo exportar el esquema", description: String((e as Error)?.message || e), variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" /> Cargando expediente vivo desde GENERAL…
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" /> GENERAL no disponible
        </div>
        <p className="text-xs text-muted-foreground">{error}</p>
        <p className="text-xs text-muted-foreground">
          El modo vivo lee del último reporte diario de la base de datos gSafeOne. Verifica la conexión o usa el modo Manual.
        </p>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Reintentar</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI 360° */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <KpiCard icon={<Building2 className="h-4 w-4" />} label="Clientes con cobertura" value={t.clientes ?? 0} />
        <KpiCard icon={<ListChecks className="h-4 w-4" />} label="Puestos cubiertos" value={t.puestosCubiertos ?? 0} />
        <KpiCard icon={<Users className="h-4 w-4" />} label="Vigilantes en servicio" value={t.vigilantes ?? 0} />
        <KpiCard icon={<Crosshair className="h-4 w-4" />} label="Armas en uso" value={t.armas ?? 0} accent="bg-gold/15 text-gold" />
        <KpiCard icon={<ShieldOff className="h-4 w-4" />} label="Puestos sin arma" value={t.sinArma ?? 0} />
        <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Con novedad" value={t.conNovedad ?? 0} accent="bg-destructive/10 text-destructive" />
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mr-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Reporte: <span className="font-medium">{data?.fecha ? new Date(data.fecha).toLocaleDateString("es-DO") : "—"}</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {([
            ["todos", "Todos"],
            ["armas", "Con armas"],
            ["sinArma", "Sin arma"],
            ["novedad", "Con novedad"],
          ] as [FilterKey, string][]).map(([k, lbl]) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
              {lbl}
            </Button>
          ))}
        </div>
        <Input placeholder="Buscar cliente o código…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-9" />
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportSchema}><Download className="h-4 w-4 mr-1" /> Exportar esquema</Button>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Recargar</Button>
        </div>
      </div>

      {/* Lista de clientes (colapsados) */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            No hay clientes que coincidan con el filtro seleccionado.
          </Card>
        )}
        {filtered.map((c) => <LiveClientCard key={c.oid} client={c} reportDate={data?.fecha || ""} />)}
      </div>
    </div>
  );
};

function LiveClientCard({ client, reportDate }: { client: GeneralExpedienteCliente; reportDate: string }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const armas = client.puestos.filter((p) => p.requiereArma).length;
  const vigilantes = new Set(client.puestos.map((p) => p.vigilanteCodigo).filter((x) => x != null)).size;

  const printExpediente = () => {
    try {
      exportToPDF({
        title: `Expediente — ${client.nombre}`,
        subtitle: `${client.direccion || "Sin dirección"}  ·  Reporte: ${reportDate ? new Date(reportDate).toLocaleDateString("es-DO") : "—"}  ·  ${client.rnc ? `RNC ${client.rnc}` : client.cedula ? `Céd. ${client.cedula}` : ""}`,
        columns: [
          { header: "Puesto", key: "puesto", width: 50 },
          { header: "Vigilante", key: "vigilante", width: 55 },
          { header: "Horas", key: "horas", width: 18 },
          { header: "Arma", key: "arma", width: 45 },
          { header: "Novedad / Comentario", key: "comentario", width: 60 },
        ],
        data: client.puestos.map((p) => ({
          puesto: p.puesto,
          vigilante: p.vigilante,
          horas: p.horas,
          arma: p.requiereArma ? [p.armaModelo, p.armaSerial].filter(Boolean).join(" · ") || "Armado" : "—",
          comentario: p.comentario || (p.novedad ? "Con novedad" : ""),
        })),
        filename: `expediente_${(client.codigo ?? client.nombre).toString().replace(/\W+/g, "_")}`,
      });
    } catch (e) {
      toast({ title: "No se pudo generar el expediente", description: String((e as Error)?.message || e), variant: "destructive" });
    }
  };

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 p-3 text-left bg-secondary text-secondary-foreground">
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <Building2 className="h-5 w-5 text-gold shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold text-sm truncate">{client.nombre}</p>
          <p className="text-xs opacity-80 truncate">
            {client.codigo ? `#${client.codigo} · ` : ""}{client.puestos.length} puesto(s) · {vigilantes} vigilante(s) · {armas} armado(s)
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {armas > 0 && <Badge className="text-[10px] gap-1"><Crosshair className="h-3 w-3" /> {armas}</Badge>}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); printExpediente(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); printExpediente(); } }}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-white/10"
            title="Imprimir expediente"
          >
            <FileText className="h-4 w-4" />
          </span>
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Datos del cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            {client.direccion && (
              <a href={mapsHref(client.direccion)} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 text-primary hover:underline">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span className="truncate">{client.direccion}</span> <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            )}
            {client.telefono && <span className="inline-flex items-center gap-1 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {client.telefono}</span>}
            {client.email && <span className="inline-flex items-center gap-1 text-muted-foreground truncate"><Mail className="h-3.5 w-3.5" /> {client.email}</span>}
            {(client.rnc || client.cedula) && <span className="text-muted-foreground">{client.rnc ? `RNC ${client.rnc}` : `Céd. ${client.cedula}`}</span>}
            {client.contacto && <span className="text-muted-foreground">Contacto: {client.contacto}</span>}
          </div>

          {/* Puestos del último reporte */}
          <div className="space-y-1.5">
            {client.puestos.map((p) => (
              <div key={p.lineaOID} className="flex items-center gap-2 text-xs border border-border rounded-md px-2.5 py-1.5">
                {p.requiereArma
                  ? <Crosshair className="h-3.5 w-3.5 text-gold shrink-0" />
                  : <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                <span className="font-medium w-40 truncate shrink-0">{p.puesto}</span>
                <span className="flex-1 truncate">{p.vigilante}</span>
                <span className="text-muted-foreground shrink-0">{p.horas}h</span>
                {p.requiereArma && (
                  <span className="text-muted-foreground shrink-0 max-w-[150px] truncate">
                    {[p.armaModelo, p.armaSerial].filter(Boolean).join(" · ") || "Armado"}
                  </span>
                )}
                {p.novedad && <Badge variant="destructive" className="text-[10px] shrink-0">Novedad</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default ExpedienteLive;
