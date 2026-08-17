// Vista unificada de armas del expediente: BÓVEDA (armas en Sede Central, no
// asignadas en el reporte del día) y REPORTE GLOBAL (todas las armas en una sola
// tabla tipo Excel, con vista alterna de mapa OpenStreetMap). Solo lectura.

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { exportToExcel } from "@/lib/exportUtils";
import { useArmedPersonnel } from "@/hooks/useApiHooks";
import { loadPosts } from "@/lib/postsData";
import { parseAnyCoords, resolveMapsUrl } from "@/lib/geoResolver";
import { SEDE_CENTRAL, resolveSedeCentral } from "@/lib/sedeCentral";
import {
  applyWeaponOverride, displayCaliber, displayWeaponType, postRequiresWeapon, realSerial,
} from "@/lib/expedienteHelpers";
import type {
  ExpedienteOverlayMap, GeneralExpedienteCliente, GeneralWeapon,
} from "@/lib/api";
import { Building2, Download, Loader2, MapPin, Search, Table2, Warehouse } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { expedienteOverlayApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface ArmaRow {
  serial: string;
  tipo: string;
  marca: string;
  calibre: string;
  licencia: string;
  estatus: string;
  cliente: string;
  localidad: string;
  puesto: string;
  vigilante: string;
  enBoveda: boolean;
  categoria?: string;
  propietario?: string;
  municion?: number | null;
  nota?: string;
  vigilanteCedula?: string;
  vigilanteCodigo?: number | null;
  tanda?: string;
  horas?: number | null;
}



const norm = (s: unknown) => String(s ?? "").trim();
const key = (s: unknown) => norm(s).toUpperCase().replace(/\s+/g, "");

function statusColor(c?: string | null): string {
  const s = (c || "").toLowerCase();
  if (!s) return "bg-muted text-muted-foreground";
  if (s.includes("buena") || s.includes("condicion") || s.includes("operativ")) return "bg-emerald-50 text-emerald-700";
  if (s.includes("mantenim")) return "bg-amber-50 text-amber-700";
  if (s.includes("fiscal")) return "bg-purple-50 text-purple-700";
  return "bg-red-50 text-red-700";
}

/** Construye las filas de armas asignadas (reporte del día) y las de bóveda. */
export function buildArmaRows(
  clientes: GeneralExpedienteCliente[],
  sqlWeapons: GeneralWeapon[],
  overlay: ExpedienteOverlayMap,
): { asignadas: ArmaRow[]; boveda: ArmaRow[] } {
  const asignadas: ArmaRow[] = [];
  const usados = new Set<string>();

  clientes.forEach((c) => {
    c.puestos.forEach((p) => {
      if (!postRequiresWeapon(p)) return;
      const ov = p.armaSerial ? overlay[p.armaSerial] : undefined;
      const arma = applyWeaponOverride(p.arma, ov);
      const serial = realSerial(p.armaSerial);
      if (serial && serial !== "—") usados.add(key(serial));
      asignadas.push({
        serial: serial && serial !== "—" ? serial : "",
        tipo: displayWeaponType(arma?.tipo || p.armaModelo) || "",
        marca: norm(arma?.marca),
        calibre: displayCaliber(arma?.calibre) || "",
        licencia: norm(ov?.noLicencia ?? arma?.noLicencia),
        estatus: norm(arma?.estatus),
        cliente: c.nombre,
        localidad: norm(p.localidad) || "Sede Principal",
        puesto: norm(p.puesto) || "Puesto General",
        vigilante: norm(p.vigilante),
        enBoveda: false,
        categoria: norm(arma?.categoria),
        propietario: norm(arma?.propietario),
        municion: arma?.capsulas ?? null,
        nota: norm(ov?.nota),
        vigilanteCedula: norm(p.vigilanteCedula),
        vigilanteCodigo: p.vigilanteCodigo ?? null,
        tanda: norm(p.tanda),
        horas: p.horas ?? null,
      });
    });
  });

  // La bóveda se lee de la BASE DE DATOS: Armamento.Estatus = 14 (En Boveda),
  // ya filtrado en el backend por propietario del grupo SafeOne. El overlay local
  // solo actúa como ajuste manual (marcar/desmarcar casos puntuales).
  const boveda: ArmaRow[] = (sqlWeapons || [])
    .filter((w) => {
      const s = key(w.serie);
      if (!s || usados.has(s)) return false;
      const ov = overlay[String(w.serie)]?.enBoveda;
      return ov === undefined ? w.enBovedaDb === true : ov === true;
    })
    .map((w) => {
      const ov = w.serie ? overlay[String(w.serie)] : undefined;
      return {
        serial: norm(w.serie),
        tipo: displayWeaponType(w.tipo) || "",
        marca: norm(w.marca),
        calibre: displayCaliber(w.calibre) || "",
        licencia: norm(ov?.noLicencia ?? w.noLicencia),
        estatus: norm(ov?.estatus ?? w.estatus),
        cliente: SEDE_CENTRAL.empresa,
        localidad: SEDE_CENTRAL.nombre,
        puesto: "Bóveda / Almacén",
        vigilante: "",
        enBoveda: true,
        categoria: norm(w.categoria),
        propietario: norm(w.propietario),
        municion: null,
        nota: norm(ov?.nota),
      };
    });



  return { asignadas, boveda };
}

interface Props {
  mode: "boveda" | "global";
  clientes: GeneralExpedienteCliente[];
  sqlWeapons: GeneralWeapon[];
  overlay: ExpedienteOverlayMap;
  reportDate: string;
  canEdit?: boolean;
  onOverlayChange?: () => void;
}

type MapPoint = { label: string; sub: string; pos: [number, number]; armas: number; sinLic: number; sede?: boolean };

export default function ArmasGlobalView({ mode, clientes, sqlWeapons, overlay, reportDate, canEdit, onOverlayChange }: Props) {
  const [view, setView] = useState<"tabla" | "mapa">("tabla");
  const [q, setQ] = useState("");
  const [manage, setManage] = useState(false);
  const [detail, setDetail] = useState<{ row: ArmaRow; tab: "arma" | "vigilante" } | null>(null);

  const { data: personnel } = useArmedPersonnel();


  const { asignadas, boveda } = useMemo(
    () => buildArmaRows(clientes, sqlWeapons, overlay),
    [clientes, sqlWeapons, overlay],
  );

  const rows = useMemo(() => {
    const base = mode === "boveda" ? boveda : [...asignadas, ...boveda];
    const s = q.toLowerCase().trim();
    if (!s) return base;
    return base.filter((r) =>
      `${r.serial} ${r.tipo} ${r.marca} ${r.calibre} ${r.licencia} ${r.estatus} ${r.cliente} ${r.localidad} ${r.puesto} ${r.vigilante}`
        .toLowerCase().includes(s));
  }, [mode, asignadas, boveda, q]);

  const conLic = rows.filter((r) => r.licencia).length;
  const sinLic = rows.length - conLic;

  const exportar = () => {
    exportToExcel({
      title: mode === "boveda" ? "Armas en bóveda — Sede Central" : "Reporte global de armas",
      columns: [
        { header: "Serial", key: "serial", width: 20 },
        { header: "Tipo", key: "tipo", width: 18 },
        { header: "Marca", key: "marca", width: 18 },
        { header: "Calibre", key: "calibre", width: 14 },
        { header: "No. Licencia", key: "licencia", width: 20 },
        { header: "Estatus", key: "estatus", width: 24 },
        { header: "Cliente / Empresa", key: "cliente", width: 32 },
        { header: "Localidad", key: "localidad", width: 26 },
        { header: "Puesto", key: "puesto", width: 26 },
        { header: "Vigilante / Custodio", key: "vigilante", width: 30 },
        { header: "Ubicación", key: "ubicacion", width: 18 },
      ],
      data: rows.map((r) => ({ ...r, ubicacion: r.enBoveda ? "Bóveda" : "En servicio" })) as unknown as Record<string, unknown>[],
      filename: mode === "boveda" ? "armas_boveda_sede_central" : "reporte_global_armas",
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="p-3">
          <p className="text-xl font-bold leading-none">{rows.length}</p>
          <p className="text-[11px] text-muted-foreground">{mode === "boveda" ? "Armas en bóveda" : "Armas registradas"}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xl font-bold leading-none text-emerald-700">{conLic}</p>
          <p className="text-[11px] text-muted-foreground">Con licencia</p>
        </Card>
        <Card className="p-3">
          <p className={`text-xl font-bold leading-none ${sinLic > 0 ? "text-destructive" : "text-emerald-700"}`}>{sinLic}</p>
          <p className="text-[11px] text-muted-foreground">Sin licencia registrada</p>
        </Card>
        <Card className="p-3">
          <p className="text-xl font-bold leading-none">{mode === "boveda" ? boveda.length : asignadas.length}</p>
          <p className="text-[11px] text-muted-foreground">{mode === "boveda" ? "Custodiadas en Sede Central" : "En servicio (reporte del día)"}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <Button size="sm" variant={view === "tabla" ? "default" : "ghost"} className="rounded-none" onClick={() => setView("tabla")}>
            <Table2 className="h-4 w-4 mr-1" /> Tabla
          </Button>
          <Button size="sm" variant={view === "mapa" ? "default" : "ghost"} className="rounded-none" onClick={() => setView("mapa")}>
            <MapPin className="h-4 w-4 mr-1" /> Mapa
          </Button>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar serial, licencia, cliente…" className="h-9 pl-7 w-[260px]" />
        </div>
        {mode === "boveda" && (
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Warehouse className="h-3 w-3" /> {SEDE_CENTRAL.nombre} · {SEDE_CENTRAL.empresa}
          </Badge>
        )}
        <div className="ml-auto flex gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setManage(true)}>
              <Warehouse className="h-4 w-4 mr-1" /> Gestionar bóveda
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={exportar}><Download className="h-4 w-4 mr-1" /> Exportar Excel</Button>
        </div>
      </div>

      {manage && (
        <BovedaManager
          clientes={clientes}
          sqlWeapons={sqlWeapons}
          overlay={overlay}
          onClose={() => setManage(false)}
          onSaved={() => onOverlayChange?.()}
        />
      )}


      {view === "tabla" ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="text-left">
                <th className="p-2 font-semibold">Serial</th>
                <th className="p-2 font-semibold">Arma</th>
                <th className="p-2 font-semibold">Licencia</th>
                <th className="p-2 font-semibold">Estatus</th>
                <th className="p-2 font-semibold">Ubicación</th>
                <th className="p-2 font-semibold">Vigilante / Custodio</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Sin armas que coincidan con la búsqueda.</td></tr>
              )}
              {rows.map((r, i) => (
                <tr
                  key={`${r.serial}-${r.puesto}-${i}`}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/40 cursor-pointer"
                  onClick={() => setDetail({ row: r, tab: "arma" })}
                  title="Ver ficha del arma"
                >
                  <td className="p-2 font-mono font-semibold text-primary underline-offset-2 hover:underline">{r.serial || "—"}</td>
                  <td className="p-2">{[r.tipo, r.marca, r.calibre].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="p-2">
                    {r.licencia
                      ? <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">Lic. {r.licencia}</span>
                      : <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-semibold">Sin licencia</span>}
                  </td>
                  <td className="p-2">
                    {r.estatus ? <span className={`px-1.5 py-0.5 rounded ${statusColor(r.estatus)}`}>{r.estatus}</span> : "—"}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      {r.enBoveda
                        ? <Warehouse className="h-3.5 w-3.5 text-gold shrink-0" />
                        : <Building2 className="h-3.5 w-3.5 text-gold shrink-0" />}
                      <span className="truncate">{r.cliente}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{r.localidad} · {r.puesto}</p>
                  </td>
                  <td className="p-2 truncate">
                    {r.vigilante ? (
                      <button
                        className="text-primary hover:underline"
                        onClick={(e) => { e.stopPropagation(); setDetail({ row: r, tab: "vigilante" }); }}
                        title="Ver ficha del vigilante"
                      >
                        {r.vigilante}
                      </button>
                    ) : (r.enBoveda ? "En bóveda" : "Sin asignar")}
                  </td>
                </tr>
              ))}

            </tbody>
          </table>
        </Card>
      ) : (
        <ArmasMap rows={rows} personnel={personnel || []} />
      )}

      {detail && (
        <ArmaDetailDialog
          row={detail.row}
          tab={detail.tab}
          personnel={personnel || []}
          onTab={(t) => setDetail({ row: detail.row, tab: t })}
          onClose={() => setDetail(null)}
        />
      )}

      <p className="text-[11px] text-muted-foreground">
        Reporte del día: {reportDate || "—"}. La bóveda es un registro manual: solo se contabilizan las armas marcadas explícitamente como resguardadas en {SEDE_CENTRAL.nombre}.
      </p>

    </div>
  );
}

// ─── Mapa OpenStreetMap con todas las ubicaciones de armas ───
function ArmasMap({ rows, personnel }: { rows: ArmaRow[]; personnel: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const groups = useMemo(() => {
    const m = new Map<string, { cliente: string; localidad: string; armas: number; sinLic: number; boveda: boolean }>();
    rows.forEach((r) => {
      const k = `${r.cliente.toLowerCase()}|${r.localidad.toLowerCase()}`;
      let g = m.get(k);
      if (!g) { g = { cliente: r.cliente, localidad: r.localidad, armas: 0, sinLic: 0, boveda: r.enBoveda }; m.set(k, g); }
      g.armas++;
      if (!r.licencia) g.sinLic++;
    });
    return [...m.values()];
  }, [rows]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const coordIndex: { cliente: string; loc: string; coord: string }[] = [];
      (personnel || []).forEach((p: any) => {
        if (p?.coordinates) coordIndex.push({ cliente: String(p.client || "").toLowerCase(), loc: String(p.location || "").toLowerCase(), coord: p.coordinates });
      });
      try {
        loadPosts().forEach((wp) => {
          if (wp.coordenada) coordIndex.push({ cliente: String(wp.cliente || "").toLowerCase(), loc: String(wp.nombre || "").toLowerCase(), coord: wp.coordenada });
        });
      } catch { /* opcional */ }

      const out: MapPoint[] = [];
      for (const g of groups) {
        if (g.boveda) {
          const pos = await resolveSedeCentral();
          out.push({ label: SEDE_CENTRAL.nombre, sub: SEDE_CENTRAL.empresa, pos, armas: g.armas, sinLic: g.sinLic, sede: true });
          continue;
        }
        const c = g.cliente.toLowerCase();
        const l = g.localidad.toLowerCase();
        const hit = coordIndex.find((x) => (x.cliente === c || x.cliente.includes(c) || c.includes(x.cliente)) && (x.loc === l || x.loc.includes(l) || l.includes(x.loc)))
          || coordIndex.find((x) => x.cliente === c || x.cliente.includes(c) || c.includes(x.cliente));
        if (!hit) continue;
        const pos = parseAnyCoords(hit.coord) || (await resolveMapsUrl(hit.coord));
        if (!pos) continue;
        out.push({ label: g.localidad, sub: g.cliente, pos, armas: g.armas, sinLic: g.sinLic });
      }
      if (!cancelled) { setPoints(out); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [groups, personnel]);

  useEffect(() => {
    if (loading || points.length === 0) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      const map = L.map(containerRef.current).setView(points[0].pos, 12);
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      points.forEach((pt) => {
        const color = pt.sede ? "#1f2937" : pt.sinLic > 0 ? "#dc2626" : "#059669";
        L.circleMarker(pt.pos, { radius: Math.min(9 + pt.armas, 20), color, fillColor: color, fillOpacity: 0.55, weight: 2 })
          .addTo(map)
          .bindPopup(
            `<div style="font-size:12px;min-width:190px">
              <p style="font-weight:bold;margin-bottom:2px">${pt.label}</p>
              <p style="color:#6b7280">${pt.sub}</p>
              <p><b>${pt.armas}</b> arma(s) · <span style="color:${pt.sinLic > 0 ? "#dc2626" : "#059669"}">${pt.sinLic} sin licencia</span></p>
            </div>`,
          );
      });

      if (points.length > 1) map.fitBounds(points.map((p) => p.pos) as any, { padding: [30, 30] });
      setTimeout(() => map.invalidateSize(), 120);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [loading, points]);

  if (loading) {
    return (
      <Card className="h-[460px] flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Ubicando armas en el mapa…
      </Card>
    );
  }
  if (points.length === 0) {
    return (
      <Card className="h-[460px] flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground p-6 text-center">
        <MapPin className="h-6 w-6" />
        <p>No hay coordenadas registradas para estas ubicaciones en Personal Armado ni en Puestos.</p>
      </Card>
    );
  }
  return <div ref={containerRef} className="h-[460px] rounded-xl overflow-hidden border border-border" />;
}


// ─── Registro MANUAL de armas en bóveda (Sede Central) ───
function BovedaManager({
  clientes, sqlWeapons, overlay, onClose, onSaved,
}: {
  clientes: GeneralExpedienteCliente[];
  sqlWeapons: GeneralWeapon[];
  overlay: ExpedienteOverlayMap;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [sel, setSel] = useState<Set<string>>(() => {
    const s = new Set<string>();
    (sqlWeapons || []).forEach((w) => {
      if (!w.serie) return;
      const ov = overlay[String(w.serie)]?.enBoveda;
      if (ov === undefined ? w.enBovedaDb === true : ov === true) s.add(String(w.serie));
    });
    return s;
  });

  const usados = useMemo(() => {
    const set = new Set<string>();
    clientes.forEach((c) => c.puestos.forEach((p) => {
      if (!postRequiresWeapon(p)) return;
      const serial = realSerial(p.armaSerial);
      if (serial && serial !== "—") set.add(key(serial));
    }));
    return set;
  }, [clientes]);

  const candidatos = useMemo(() => {
    const s = q.toLowerCase().trim();
    return (sqlWeapons || [])
      .filter((w) => !!norm(w.serie) && !usados.has(key(w.serie)))
      .filter((w) => !s || `${w.serie} ${w.marca} ${w.tipo} ${w.calibre} ${w.noLicencia} ${w.estatus}`.toLowerCase().includes(s));
  }, [sqlWeapons, usados, q]);

  const toggle = (serie: string) => setSel((prev) => {
    const n = new Set(prev);
    if (n.has(serie)) n.delete(serie); else n.add(serie);
    return n;
  });

  const guardar = async () => {
    setSaving(true);
    try {
      const cambios: { serie: string; enBoveda: boolean }[] = [];
      (sqlWeapons || []).forEach((w) => {
        const serie = norm(w.serie);
        if (!serie) return;
        const ovPrev = overlay[serie]?.enBoveda;
        const antes = ovPrev === undefined ? w.enBovedaDb === true : ovPrev === true;
        const ahora = sel.has(serie);
        if (antes !== ahora) cambios.push({ serie, enBoveda: ahora });
      });
      for (const c of cambios) await expedienteOverlayApi.save(c.serie, { enBoveda: c.enBoveda });
      toast({ title: "Bóveda actualizada", description: `${cambios.length} arma(s) actualizada(s).` });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: "No se pudo guardar", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Warehouse className="h-4 w-4" /> Armas resguardadas en bóveda</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Marca únicamente las armas que físicamente están en la bóveda de {SEDE_CENTRAL.nombre}. Las armas asignadas a un puesto en el reporte del día no aparecen en esta lista.
        </p>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar serial, marca, licencia…" className="h-9" />
        <div className="max-h-[50vh] overflow-y-auto border border-border rounded-md divide-y divide-border/60">
          {candidatos.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Sin armas disponibles.</p>}
          {candidatos.map((w) => {
            const serie = norm(w.serie);
            return (
              <label key={serie} className="flex items-center gap-3 p-2 text-xs hover:bg-muted/40 cursor-pointer">
                <Checkbox checked={sel.has(serie)} onCheckedChange={() => toggle(serie)} />
                <span className="font-mono font-semibold w-44 truncate">{serie}</span>
                <span className="flex-1 truncate">{[displayWeaponType(w.tipo), norm(w.marca), displayCaliber(w.calibre)].filter(Boolean).join(" · ") || "—"}</span>
                <span className="w-32 truncate">{norm(overlay[serie]?.noLicencia ?? w.noLicencia) || "Sin licencia"}</span>
                <span className="w-32 truncate text-muted-foreground">{norm(overlay[serie]?.estatus ?? w.estatus) || "—"}</span>
              </label>
            );
          })}
        </div>
        <DialogFooter className="items-center">
          <Badge variant="secondary" className="mr-auto text-[11px]">{sel.size} arma(s) en bóveda</Badge>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar bóveda"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
