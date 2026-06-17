import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  generalSqlApi, expedienteOverlayApi,
  type GeneralExpediente, type ExpedienteOverlayMap, type ExpedienteMovement,
} from "@/lib/api";
import { exportToExcel } from "@/lib/exportUtils";
import { Crosshair, RefreshCw, Search, MapPin, ShieldCheck, Warehouse, ArrowRightLeft, Download, AlertTriangle } from "lucide-react";

interface VaultWeapon {
  oid: number | null;
  serie: string | null;
  marca: string | null;
  tipo: string | null;
  calibre: string | null;
  noLicencia: string | null;
  estatus: string | null;
  propietario: string | null;
}

function statusColor(c?: string | null): string {
  const s = (c || "").toLowerCase();
  if (!s) return "bg-muted text-muted-foreground";
  if (s.includes("buena") || s.includes("condicion") || s.includes("operativ")) return "bg-emerald-50 text-emerald-700";
  if (s.includes("mantenim")) return "bg-amber-50 text-amber-700";
  if (s.includes("fiscal")) return "bg-purple-50 text-purple-700";
  return "bg-red-50 text-red-700";
}

const VaultView = () => {
  const { toast } = useToast();
  const [weapons, setWeapons] = useState<VaultWeapon[]>([]);
  const [exp, setExp] = useState<GeneralExpediente | null>(null);
  const [overlay, setOverlay] = useState<ExpedienteOverlayMap>({});
  const [movs, setMovs] = useState<ExpedienteMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, e, ov, m] = await Promise.all([
        generalSqlApi.weapons(),
        generalSqlApi.expediente().catch(() => null),
        expedienteOverlayApi.list().catch(() => ({} as ExpedienteOverlayMap)),
        expedienteOverlayApi.movements({ tipo: "arma" }).catch(() => [] as ExpedienteMovement[]),
      ]);
      setWeapons(w as unknown as VaultWeapon[]);
      setExp(e);
      setOverlay(ov || {});
      setMovs(m);
    } catch (err) {
      setError((err as Error)?.message || "No se pudo cargar la bóveda");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // serie → ubicación/custodio según el último reporte
  const locBySerie = useMemo(() => {
    const map = new Map<string, { cliente: string; puesto: string; custodio: string }>();
    exp?.clientes.forEach((c) => c.puestos.forEach((p) => {
      if (p.armaSerial) map.set(p.armaSerial, { cliente: c.nombre, puesto: p.puesto, custodio: p.vigilante });
    }));
    return map;
  }, [exp]);

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return weapons
      .map((w) => {
        const serie = w.serie || "";
        const ov = serie ? overlay[serie] : undefined;
        const loc = serie ? locBySerie.get(serie) : undefined;
        return {
          ...w,
          estatus: ov?.estatus ?? w.estatus,
          noLicencia: ov?.noLicencia ?? w.noLicencia,
          ubicacion: loc ? `${loc.cliente} · ${loc.puesto}` : "Bóveda / sin asignar",
          custodio: loc?.custodio || "—",
          enUso: !!loc,
          fotos: ov?.fotosArma?.length || 0,
        };
      })
      .filter((w) =>
        !q ||
        `${w.serie ?? ""} ${w.marca ?? ""} ${w.tipo ?? ""} ${w.noLicencia ?? ""} ${w.ubicacion} ${w.custodio}`.toLowerCase().includes(q),
      );
  }, [weapons, overlay, locBySerie, search]);

  const enUso = rows.filter((r) => r.enUso).length;
  const enBoveda = rows.length - enUso;

  const exportExcel = () => {
    exportToExcel({
      title: "Bóveda de armas — SafeOne",
      columns: [
        { header: "Serial", key: "serie", width: 18 },
        { header: "Tipo", key: "tipo", width: 18 },
        { header: "Marca", key: "marca", width: 16 },
        { header: "Calibre", key: "calibre", width: 14 },
        { header: "No. Licencia", key: "noLicencia", width: 18 },
        { header: "Estatus", key: "estatus", width: 22 },
        { header: "Ubicación", key: "ubicacion", width: 40 },
        { header: "Custodio", key: "custodio", width: 30 },
      ],
      data: rows.map((r) => ({
        serie: r.serie, tipo: r.tipo, marca: r.marca, calibre: r.calibre,
        noLicencia: r.noLicencia, estatus: r.estatus, ubicacion: r.ubicacion, custodio: r.custodio,
      })) as unknown as Record<string, unknown>[],
      filename: "boveda_armas",
    });
    toast({ title: "Bóveda exportada" });
  };

  if (loading) {
    return <Card className="p-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Cargando bóveda…</Card>;
  }
  if (error) {
    return (
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Bóveda no disponible</div>
        <p className="text-xs text-muted-foreground">{error}</p>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Reintentar</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-md bg-gold/15 text-gold flex items-center justify-center"><Crosshair className="h-4 w-4" /></div><div><p className="text-xl font-bold leading-none">{rows.length}</p><p className="text-[11px] text-muted-foreground">Armas registradas</p></div></Card>
        <Card className="p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center"><ShieldCheck className="h-4 w-4" /></div><div><p className="text-xl font-bold leading-none">{enUso}</p><p className="text-[11px] text-muted-foreground">En uso (puestos)</p></div></Card>
        <Card className="p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Warehouse className="h-4 w-4" /></div><div><p className="text-xl font-bold leading-none">{enBoveda}</p><p className="text-[11px] text-muted-foreground">En bóveda / sin asignar</p></div></Card>
        <Card className="p-3 flex items-center gap-3"><div className="h-9 w-9 rounded-md bg-secondary text-secondary-foreground flex items-center justify-center"><ArrowRightLeft className="h-4 w-4" /></div><div><p className="text-xl font-bold leading-none">{movs.length}</p><p className="text-[11px] text-muted-foreground">Movimientos registrados</p></div></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Buscar serial, marca, licencia, ubicación…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> Exportar</Button>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Recargar</Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-secondary text-secondary-foreground">
            <tr className="text-left">
              <th className="p-2">Serial</th><th className="p-2">Tipo / Marca</th><th className="p-2">Calibre</th>
              <th className="p-2">No. Licencia</th><th className="p-2">Estatus</th><th className="p-2">Ubicación</th><th className="p-2">Custodio</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No hay armas que coincidan.</td></tr>
            )}
            {rows.map((w, i) => (
              <tr key={`${w.serie}-${i}`} className="border-t border-border hover:bg-muted/40">
                <td className="p-2 font-mono font-medium">{w.serie || "—"} {w.fotos > 0 && <span className="text-[9px]">{w.fotos}📷</span>}</td>
                <td className="p-2">{[w.tipo, w.marca].filter(Boolean).join(" · ") || "—"}</td>
                <td className="p-2">{w.calibre || "—"}</td>
                <td className="p-2">{w.noLicencia || "—"}</td>
                <td className="p-2">{w.estatus ? <span className={`px-1.5 py-0.5 rounded ${statusColor(w.estatus)}`}>{w.estatus}</span> : "—"}</td>
                <td className="p-2">
                  <span className="inline-flex items-center gap-1">
                    {w.enUso ? <MapPin className="h-3 w-3 text-emerald-600" /> : <Warehouse className="h-3 w-3 text-muted-foreground" />}
                    {w.ubicacion}
                  </span>
                </td>
                <td className="p-2">{w.custodio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {movs.length > 0 && (
        <Card className="p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1"><ArrowRightLeft className="h-3.5 w-3.5" /> Movimientos recientes de armas (FROM → TO)</p>
          <div className="space-y-1">
            {movs.slice(0, 30).map((m) => (
              <div key={m.id} className="text-[11px] border border-border rounded px-2 py-1 flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground shrink-0">{m.fecha ? new Date(m.fecha).toLocaleDateString("es-DO") : ""}</span>
                <Badge variant="outline" className="text-[9px]">{m.serie}</Badge>
                <span className="font-medium truncate">{m.desde || "—"}</span>
                <ArrowRightLeft className="h-3 w-3 shrink-0 text-gold" />
                <span className="font-medium truncate">{m.hacia || "—"}</span>
                {m.motivo && <span className="text-muted-foreground truncate">· {m.motivo}</span>}
                <span className="ml-auto text-muted-foreground">{m.registradoPor}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default VaultView;
