/**
 * Expediente CONTRACTUAL del Cliente (gSafeOne, solo lectura).
 * Jerarquía: Cliente → ClienteLocalidad → ClientePuestoServicio →
 * ClientePuestoHorario → ClientePuestoHorarioD.
 */
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generalSqlApi, type GeneralContrato, type GeneralContratoCliente } from "@/lib/api";
import { displayCaliber, weaponCategoryLabel } from "@/lib/expedienteHelpers";
import {
  Building2, MapPin, Crosshair, ChevronDown, ChevronRight, RefreshCw, Clock, Users, ExternalLink,
} from "lucide-react";

const money = (n: number) =>
  n.toLocaleString("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 2 });

function mapsHref(geo?: string | null): string | null {
  if (!geo) return null;
  const v = String(geo).trim();
  if (!v) return null;
  return v.startsWith("http") ? v : `https://www.google.com/maps?q=${encodeURIComponent(v)}`;
}

const Kpi = ({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) => (
  <Card className="p-3 flex items-center gap-3">
    <div className="rounded-lg bg-primary/10 p-2"><Icon className="h-4 w-4 text-primary" /></div>
    <div className="min-w-0">
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground truncate">{label}</p>
    </div>
  </Card>
);

function ClienteCard({ cliente }: { cliente: GeneralContratoCliente }) {
  const [open, setOpen] = useState(false);
  const [openLoc, setOpenLoc] = useState<Record<string, boolean>>({});
  const puestos = cliente.localidades.reduce((a, l) => a + l.puestos.length, 0);

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <Building2 className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{cliente.nombre}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            RNC: {cliente.rnc || cliente.cedula || "—"}
            {cliente.codigo != null ? ` · Código ${cliente.codigo}` : ""}
          </p>
        </div>
        <Badge variant="secondary">{cliente.localidades.length} loc.</Badge>
        <Badge variant="outline">{puestos} puestos</Badge>
        {cliente.inactivo && <Badge variant="destructive">Inactivo</Badge>}
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border">
          {cliente.localidades.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Sin localidades registradas.</p>
          )}
          {cliente.localidades.map((loc, li) => {
            const key = `${loc.oid ?? li}`;
            const isOpen = !!openLoc[key];
            const href = mapsHref(loc.geo);
            return (
              <div key={key}>
                <div className="flex items-center gap-2 p-3 pl-8 bg-muted/30">
                  <button className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    onClick={() => setOpenLoc((s) => ({ ...s, [key]: !isOpen }))}>
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-medium truncate">{loc.nombre}</span>
                    {loc.zona && <Badge variant="outline" className="text-[10px]">{loc.zona}</Badge>}
                    {loc.subZona && <Badge variant="outline" className="text-[10px]">{loc.subZona}</Badge>}
                  </button>
                  {href && (
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-primary inline-flex items-center gap-1">
                      Mapa <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {isOpen && (
                  <div className="pl-12 pr-3 py-2 space-y-3">
                    {loc.puestos.length === 0 && (
                      <p className="text-xs text-muted-foreground">Sin puestos de servicio.</p>
                    )}
                    {loc.puestos.map((p, pi) => (
                      <div key={p.oid ?? pi} className="rounded-lg border border-border p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{p.referencia}</span>
                          {p.requiereArma ? (
                            <Badge className="gap-1"><Crosshair className="h-3 w-3" />
                              {p.armaSerial || "Arma asignada"}
                              {p.arma ? ` · ${weaponCategoryLabel(p.arma)} · ${displayCaliber(p.arma.calibre)}` : ""}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Sin arma</Badge>
                          )}
                        </div>

                        {p.horarios.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sin horario contratado.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="text-muted-foreground">
                                <tr className="text-left">
                                  <th className="py-1 pr-3 font-medium">Día</th>
                                  <th className="py-1 pr-3 font-medium">Tanda</th>
                                  <th className="py-1 pr-3 font-medium">Horario</th>
                                  <th className="py-1 pr-3 font-medium">Horas</th>
                                  <th className="py-1 pr-3 font-medium">Vigilante</th>
                                  <th className="py-1 pr-3 font-medium text-right">Incentivo</th>
                                  <th className="py-1 font-medium text-right">Precio</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.horarios.flatMap((h, hi) =>
                                  (h.detalles.length ? h.detalles : [null]).map((d, di) => (
                                    <tr key={`${h.oid ?? hi}-${di}`} className="border-t border-border/60">
                                      <td className="py-1 pr-3">{di === 0 ? (h.dia || "—") : ""}</td>
                                      <td className="py-1 pr-3">{d?.tanda || "—"}</td>
                                      <td className="py-1 pr-3">
                                        {d?.horaDesde || d?.horaHasta ? `${d?.horaDesde || "—"} – ${d?.horaHasta || "—"}` : "—"}
                                      </td>
                                      <td className="py-1 pr-3">{d ? d.horas || h.regularHoras : h.regularHoras}</td>
                                      <td className="py-1 pr-3">{d?.vigilante || "—"}</td>
                                      <td className="py-1 pr-3 text-right">{d?.incentivo ? money(d.incentivo) : "—"}</td>
                                      <td className="py-1 text-right">{d?.precio ? money(d.precio) : "—"}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function ExpedienteContrato() {
  const [data, setData] = useState<GeneralContrato | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [todos, setTodos] = useState(false);

  const load = async (all = todos) => {
    setLoading(true); setError(null);
    try {
      setData(await generalSqlApi.contrato(all));
    } catch (e: any) {
      setError(e?.message || "No se pudo leer el contrato desde gSafeOne");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [todos]);

  const clientes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !data) return data?.clientes || [];
    return data.clientes.filter((c) => {
      if (c.nombre.toLowerCase().includes(q) || (c.rnc || "").toLowerCase().includes(q)) return true;
      return c.localidades.some(
        (l) =>
          l.nombre.toLowerCase().includes(q) ||
          (l.zona || "").toLowerCase().includes(q) ||
          (l.subZona || "").toLowerCase().includes(q) ||
          l.puestos.some(
            (p) =>
              p.referencia.toLowerCase().includes(q) ||
              (p.armaSerial || "").toLowerCase().includes(q) ||
              p.horarios.some((h) => h.detalles.some((d) => (d.vigilante || "").toLowerCase().includes(q))),
          ),
      );
    });
  }, [data, search]);

  const t = data?.totals;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-sm" placeholder="Buscar cliente, localidad, puesto, vigilante o serial…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </Button>
        <Button variant={todos ? "default" : "ghost"} size="sm" onClick={() => setTodos((v) => !v)}>
          {todos ? "Todos los clientes" : "Solo con contrato"}
        </Button>
        {data && (
          <Badge variant="outline">
            Fuente: {data.fuente === "contrato" ? "ClienteLocalidad / PuestoServicio" : "HoraContratada (respaldo)"}
          </Badge>
        )}
      </div>

      {error && (
        <Card className="p-4 text-sm text-destructive">{error}</Card>
      )}

      {t && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <Kpi label="Clientes" value={t.clientes} icon={Building2} />
          <Kpi label="Localidades" value={t.localidades} icon={MapPin} />
          <Kpi label="Puestos de servicio" value={t.puestos} icon={Building2} />
          <Kpi label="Puestos con arma" value={t.armas} icon={Crosshair} />
          <Kpi label="Vigilantes asignados" value={t.vigilantes} icon={Users} />
          <Kpi label="Horas contratadas" value={t.horasSemana} icon={Clock} />
        </div>
      )}

      {loading && !data && <Card className="p-6 text-sm text-muted-foreground">Cargando contrato…</Card>}

      <div className="space-y-2">
        {clientes.map((c) => <ClienteCard key={c.oid} cliente={c} />)}
        {!loading && clientes.length === 0 && !error && (
          <Card className="p-6 text-sm text-muted-foreground">
            No hay clientes con estructura contractual registrada en gSafeOne.
          </Card>
        )}
      </div>
    </div>
  );
}
