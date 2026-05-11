/**
 * Pestaña "Actividad Kronos" para el módulo Seguimiento Clientes Monitoreo.
 * Permite cargar archivos .htm exportados del Kronos NET (filtro Apertura y/o Cierre),
 * detectar cuentas inactivas y cruzar con el catálogo OSM para alertar discrepancias.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileUp, AlertTriangle, Phone, Download, Search, X, Activity,
  ShieldAlert, DoorOpen, DoorClosed, Trash2, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  parseKronosHtmFile, type KronosParsedReport, type KronosAccountRow, type CriticidadInactividad,
} from "@/lib/kronosHtmParser";
import type { OSMClient } from "@/lib/osmClientData";

const CRIT_LABEL: Record<CriticidadInactividad, string> = {
  baja: "Baja (1 día)",
  media: "Media (2 días)",
  alta: "Alta (3+ días / sin señal)",
};
const CRIT_COLOR: Record<CriticidadInactividad, string> = {
  baja: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  media: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  alta: "bg-red-500/20 text-red-400 border-red-500/30",
};

interface CombinedRow {
  accountCode: string;
  accountName: string;
  aperturaDays: number | null;
  cierreDays: number | null;
  worstDays: number | null;
  criticidad: CriticidadInactividad | "ok";
  lastApertura: string | null;
  lastCierre: string | null;
  estadoApertura?: string;
  estadoCierre?: string;
  // Cruce OSM
  osm?: OSMClient;
  discrepancia?: string; // explicación si hay alerta
}

function worstCriticidad(a?: CriticidadInactividad | "ok", b?: CriticidadInactividad | "ok"): CriticidadInactividad | "ok" {
  const order: Array<CriticidadInactividad | "ok"> = ["ok", "baja", "media", "alta"];
  const ai = a ? order.indexOf(a) : 0;
  const bi = b ? order.indexOf(b) : 0;
  return order[Math.max(ai, bi)];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" });
}

interface Props {
  clients: OSMClient[];
}

export default function KronosActivityTab({ clients }: Props) {
  const [aperturaReport, setAperturaReport] = useState<KronosParsedReport | null>(null);
  const [cierreReport, setCierreReport] = useState<KronosParsedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCrit, setFilterCrit] = useState<"all" | CriticidadInactividad | "discrepancia">("all");

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const parsed = await parseKronosHtmFile(file);
      if (parsed.rows.length === 0) {
        toast.error("No se detectaron cuentas en el archivo. Verifique el formato.");
        return;
      }
      if (parsed.filterType === "Apertura") {
        setAperturaReport(parsed);
        toast.success(`Reporte de Apertura cargado: ${parsed.rows.length} cuentas`);
      } else if (parsed.filterType === "Cierre") {
        setCierreReport(parsed);
        toast.success(`Reporte de Cierre cargado: ${parsed.rows.length} cuentas`);
      } else {
        // Sin filtro detectado: lo mandamos a apertura por defecto
        setAperturaReport(parsed);
        toast.warning(`Filtro no detectado; se procesó como Apertura (${parsed.rows.length} cuentas)`);
      }
    } catch (e: any) {
      toast.error(`Error al procesar archivo: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Index OSM por código
  const osmByCode = useMemo(() => {
    const m = new Map<string, OSMClient>();
    clients.forEach(c => { if (c.accountCode) m.set(c.accountCode.trim(), c); });
    return m;
  }, [clients]);

  const combined = useMemo<CombinedRow[]>(() => {
    const map = new Map<string, CombinedRow>();
    const add = (r: KronosAccountRow, kind: "apertura" | "cierre") => {
      const key = r.accountCode;
      const cur = map.get(key) || {
        accountCode: r.accountCode,
        accountName: r.accountName,
        aperturaDays: null, cierreDays: null, worstDays: null,
        criticidad: "ok" as CriticidadInactividad | "ok",
        lastApertura: null, lastCierre: null,
      };
      if (kind === "apertura") {
        cur.aperturaDays = r.daysSince;
        cur.lastApertura = r.lastSignal;
        cur.estadoApertura = r.estado;
      } else {
        cur.cierreDays = r.daysSince;
        cur.lastCierre = r.lastSignal;
        cur.estadoCierre = r.estado;
      }
      cur.worstDays = Math.max(cur.aperturaDays ?? -1, cur.cierreDays ?? -1);
      if (cur.worstDays < 0) cur.worstDays = null;
      cur.criticidad = worstCriticidad(
        cur.aperturaDays === null ? "alta" : cur.aperturaDays < 1 ? "ok" : cur.aperturaDays < 2 ? "baja" : cur.aperturaDays < 3 ? "media" : "alta",
        cur.cierreDays === null ? (kind === "cierre" || cierreReport ? "alta" : "ok") : cur.cierreDays < 1 ? "ok" : cur.cierreDays < 2 ? "baja" : cur.cierreDays < 3 ? "media" : "alta",
      );
      map.set(key, cur);
    };
    aperturaReport?.rows.forEach(r => add(r, "apertura"));
    cierreReport?.rows.forEach(r => add(r, "cierre"));

    // Cruce con OSM
    const list: CombinedRow[] = [];
    map.forEach(row => {
      const osm = osmByCode.get(row.accountCode);
      row.osm = osm;
      const alertas: string[] = [];
      if (osm) {
        if (osm.monitoringStatus === "Activo" && row.criticidad === "alta") {
          alertas.push("Marcado ACTIVO en OSM pero sin señal hace 3+ días");
        }
        if (osm.hasBilling && row.criticidad === "alta") {
          alertas.push("Cliente facturado sin actividad reciente");
        }
        if (osm.systemStatus === "Apagado" || osm.systemStatus === "Suspendido") {
          alertas.push(`Sistema ${osm.systemStatus} en OSM`);
        }
      } else {
        alertas.push("Cuenta no existe en catálogo OSM");
      }
      row.discrepancia = alertas.join(" • ") || undefined;
      list.push(row);
    });

    // Cuentas que están en OSM como Activas pero NO aparecen en ningún reporte
    if (aperturaReport || cierreReport) {
      const seen = new Set(list.map(r => r.accountCode));
      clients.forEach(c => {
        if (!c.accountCode || seen.has(c.accountCode.trim())) return;
        if (c.monitoringStatus !== "Activo") return;
        list.push({
          accountCode: c.accountCode,
          accountName: c.businessName,
          aperturaDays: null, cierreDays: null, worstDays: null,
          criticidad: "alta",
          lastApertura: null, lastCierre: null,
          osm: c,
          discrepancia: "Activo en OSM pero NO aparece en reporte Kronos",
        });
      });
    }

    return list.sort((a, b) => (b.worstDays ?? 9999) - (a.worstDays ?? 9999));
  }, [aperturaReport, cierreReport, clients, osmByCode]);

  const stats = useMemo(() => {
    const alta = combined.filter(r => r.criticidad === "alta").length;
    const media = combined.filter(r => r.criticidad === "media").length;
    const baja = combined.filter(r => r.criticidad === "baja").length;
    const ok = combined.filter(r => r.criticidad === "ok").length;
    const discrepancias = combined.filter(r => r.discrepancia).length;
    return { total: combined.length, alta, media, baja, ok, discrepancias };
  }, [combined]);

  const filtered = useMemo(() => {
    return combined.filter(r => {
      if (filterCrit === "discrepancia" && !r.discrepancia) return false;
      if (filterCrit !== "all" && filterCrit !== "discrepancia" && r.criticidad !== filterCrit) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.accountCode.toLowerCase().includes(q)
          && !r.accountName.toLowerCase().includes(q)
          && !(r.osm?.businessName || "").toLowerCase().includes(q)
          && !(r.osm?.contact || "").toLowerCase().includes(q)
          && !(r.osm?.phone || "").includes(q)
        ) return false;
      }
      return true;
    });
  }, [combined, filterCrit, search]);

  const exportCallList = () => {
    const toCall = combined.filter(r => r.criticidad === "alta" || r.criticidad === "media");
    if (toCall.length === 0) { toast.info("No hay cuentas para llamar"); return; }
    const csv = [
      ["Codigo", "Nombre", "Contacto", "Telefono", "Dias sin Apertura", "Dias sin Cierre", "Criticidad", "Discrepancia"].join(","),
      ...toCall.map(r => [
        r.accountCode,
        `"${(r.osm?.businessName || r.accountName).replace(/"/g, '""')}"`,
        `"${(r.osm?.contact || "").replace(/"/g, '""')}"`,
        r.osm?.phone || "",
        r.aperturaDays ?? "",
        r.cierreDays ?? "",
        CRIT_LABEL[r.criticidad as CriticidadInactividad] || r.criticidad,
        `"${(r.discrepancia || "").replace(/"/g, '""')}"`,
      ].join(",")),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Kronos_Llamadas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${toCall.length} cuentas exportadas`);
  };

  return (
    <div className="space-y-4">
      {/* Carga de archivos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileUp className="h-4 w-4 text-primary" /> Cargar reportes Kronos NET (.htm)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <KronosFileSlot
              label="Reporte Apertura" icon={DoorOpen} report={aperturaReport}
              onFile={handleFile} onClear={() => setAperturaReport(null)} loading={loading}
            />
            <KronosFileSlot
              label="Reporte Cierre" icon={DoorClosed} report={cierreReport}
              onFile={handleFile} onClear={() => setCierreReport(null)} loading={loading}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Exporta desde Kronos NET → "Resumen de estados de grupos de señales" con filtro Apertura y/o Cierre.
            El sistema detecta automáticamente el tipo de filtro y la fecha del reporte.
          </p>
        </CardContent>
      </Card>

      {(aperturaReport || cierreReport) && (
        <>
          {/* KPIs criticidad */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Total cuentas" value={stats.total} color="text-foreground"
              active={filterCrit === "all"} onClick={() => setFilterCrit("all")} />
            <KpiCard label="🟢 Al día" value={stats.ok} color="text-emerald-400"
              active={false} onClick={() => setFilterCrit("all")} />
            <KpiCard label="🔵 Baja (1d)" value={stats.baja} color="text-blue-400"
              active={filterCrit === "baja"} onClick={() => setFilterCrit("baja")} />
            <KpiCard label="🟡 Media (2d)" value={stats.media} color="text-amber-400"
              active={filterCrit === "media"} onClick={() => setFilterCrit("media")} />
            <KpiCard label="🔴 Alta (3+d)" value={stats.alta} color="text-red-400"
              active={filterCrit === "alta"} onClick={() => setFilterCrit("alta")} />
          </div>

          {/* Banner discrepancias */}
          {stats.discrepancias > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="pt-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  <span className="text-sm">
                    <strong>{stats.discrepancias}</strong> cuentas presentan discrepancias entre Kronos y el catálogo OSM.
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setFilterCrit("discrepancia")}>
                  Ver discrepancias
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar cuenta, nombre, contacto, teléfono..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterCrit} onValueChange={(v: any) => setFilterCrit(v)}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las criticidades</SelectItem>
                <SelectItem value="alta">🔴 Alta</SelectItem>
                <SelectItem value="media">🟡 Media</SelectItem>
                <SelectItem value="baja">🔵 Baja</SelectItem>
                <SelectItem value="discrepancia">⚠️ Solo discrepancias</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportCallList} variant="default" size="sm">
              <Download className="h-4 w-4 mr-2" /> Exportar lista de llamadas
            </Button>
          </div>

          {/* Tabla */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Teléfono</TableHead>
                    {aperturaReport && <TableHead className="text-right">Última apertura</TableHead>}
                    {cierreReport && <TableHead className="text-right">Último cierre</TableHead>}
                    <TableHead>Criticidad</TableHead>
                    <TableHead>Estado OSM</TableHead>
                    <TableHead>Alerta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Sin resultados
                    </TableCell></TableRow>
                  ) : filtered.map(r => (
                    <TableRow key={r.accountCode}>
                      <TableCell className="font-mono text-xs">{r.accountCode}</TableCell>
                      <TableCell className="font-medium text-sm">{r.osm?.businessName || r.accountName}</TableCell>
                      <TableCell className="text-xs">{r.osm?.contact || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {r.osm?.phone ? (
                          <a href={`tel:${r.osm.phone}`} className="text-primary hover:underline inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {r.osm.phone}
                          </a>
                        ) : "—"}
                      </TableCell>
                      {aperturaReport && (
                        <TableCell className="text-right text-xs">
                          <div>{fmtDate(r.lastApertura)}</div>
                          {r.aperturaDays !== null && (
                            <div className="text-muted-foreground">{r.aperturaDays}d</div>
                          )}
                        </TableCell>
                      )}
                      {cierreReport && (
                        <TableCell className="text-right text-xs">
                          <div>{fmtDate(r.lastCierre)}</div>
                          {r.cierreDays !== null && (
                            <div className="text-muted-foreground">{r.cierreDays}d</div>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {r.criticidad === "ok" ? (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Al día</Badge>
                        ) : (
                          <Badge variant="outline" className={CRIT_COLOR[r.criticidad as CriticidadInactividad]}>
                            {CRIT_LABEL[r.criticidad as CriticidadInactividad]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.osm ? (
                          <Badge variant="outline" className="text-xs">{r.osm.monitoringStatus}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-400 border-amber-500/30">No catalogado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[260px]">
                        {r.discrepancia && (
                          <div className="flex items-start gap-1 text-amber-400">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{r.discrepancia}</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground p-3 border-t">
                {filtered.length} de {combined.length} cuentas
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KronosFileSlot({ label, icon: Icon, report, onFile, onClear, loading }: {
  label: string;
  icon: any;
  report: KronosParsedReport | null;
  onFile: (f: File) => void;
  onClear: () => void;
  loading: boolean;
}) {
  return (
    <div className="border border-border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-primary" /> {label}
        </div>
        {report && (
          <Button size="sm" variant="ghost" onClick={onClear}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      {report ? (
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">{report.filterType}</Badge>
            <span className="text-muted-foreground">{report.rows.length} cuentas</span>
          </div>
          <div className="text-muted-foreground">
            Reporte del: {report.reportDate ? new Date(report.reportDate).toLocaleString("es-DO") : "—"}
          </div>
        </div>
      ) : (
        <label className="block">
          <input type="file" accept=".htm,.html" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
          />
          <Button size="sm" variant="outline" disabled={loading} asChild>
            <span className="cursor-pointer w-full">
              <FileUp className="h-3 w-3 mr-2" />
              {loading ? "Procesando..." : "Seleccionar archivo .htm"}
            </span>
          </Button>
        </label>
      )}
    </div>
  );
}

function KpiCard({ label, value, color, active, onClick }: {
  label: string; value: number; color: string; active: boolean; onClick: () => void;
}) {
  return (
    <Card className={`cursor-pointer transition ${active ? "ring-2 ring-primary" : "hover:shadow-md"}`} onClick={onClick}>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
