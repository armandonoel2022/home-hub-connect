import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Camera, Car, CarFront, ClipboardList, ExternalLink, Gauge, History, Link2, Loader2, Package, Plus, Unlink, UserCheck, Wrench,
} from "lucide-react";
import VehicleAvatar from "./VehicleAvatar";
import type { FleetUnit, MaintenanceEntry } from "@/lib/fleetMaintenanceTypes";
import type { VehicleMatch } from "@/lib/fleetVehicleLink";
import { maintenanceSummary, toVehicleType, vehicleAssignee } from "@/lib/fleetVehicleLink";
import { normalizePlaca, parseFecha } from "@/lib/fleetMaintenanceRules";
import { formatRD } from "@/lib/fleetMaintenanceData";
import { DOCUMENT_FIELDS } from "@/lib/vehicleTypes";
import type { Vehiculo } from "@/lib/vehicleTypes";
import { getAssetsByPlaca, type LinkedAsset } from "@/lib/fleetAssetLink";

interface Props {
  placa: string | null;
  onOpenChange: (o: boolean) => void;
  unit?: FleetUnit;
  match: VehicleMatch | null;
  entries: MaintenanceEntry[];
  canManageVehicles: boolean;
  onRegisterInFleet: (u: FleetUnit) => Promise<void>;
  onPhotoSelected: (v: Vehiculo, file: File) => Promise<void>;
  onNewExpense: (placa: string) => void;
  onViewLog: (placa: string) => void;
  onOpenFleet: (placa: string) => void;
}

type TimelineItem = { key: string; fecha: string; kind: "gasto" | "movimiento"; title: string; detail?: string; amount?: number; who?: string };

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-3 py-1.5 border-b border-border/60 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{value || "—"}</span>
  </div>
);

export default function VehicleMaintenanceDossier({
  placa, onOpenChange, unit, match, entries, canManageVehicles,
  onRegisterInFleet, onPhotoSelected, onNewExpense, onViewLog, onOpenFleet,
}: Props) {
  const vehicle = match?.vehicle;
  const [assets, setAssets] = useState<LinkedAsset[] | null>(null);
  const [busy, setBusy] = useState<"register" | "photo" | null>(null);
  const [preview, setPreview] = useState<{ src: string; label: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAssets(null);
    if (!placa) return;
    let alive = true;
    getAssetsByPlaca(placa).then((r) => alive && setAssets(r)).catch(() => alive && setAssets([]));
    return () => { alive = false; };
  }, [placa]);

  const key = normalizePlaca(placa);
  const own = useMemo(() => entries.filter((e) => normalizePlaca(e.placa) === key), [entries, key]);
  const summary = useMemo(() => maintenanceSummary(entries, key), [entries, key]);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = own.map((e: any, i) => ({
      key: `g-${e.id || i}`,
      fecha: parseFecha(e.fecha) || e.fecha,
      kind: "gasto",
      title: `${e.tipoMant || "Gasto"}${e.taller ? ` · ${e.taller}` : ""}`,
      detail: [e.detalle, e.kilometraje ? `${Number(e.kilometraje).toLocaleString("es-DO")} km` : ""].filter(Boolean).join(" · "),
      amount: Number(e.costo) || 0,
      who: e.createdBy,
    }));
    for (const h of vehicle?.historial || []) {
      if (h.tipo === "mantenimiento") continue; // ya se muestra como gasto
      items.push({ key: `h-${h.id}`, fecha: h.fecha, kind: "movimiento", title: h.descripcion, who: h.usuario });
    }
    return items.sort((a, b) => (String(a.fecha) < String(b.fecha) ? 1 : -1));
  }, [own, vehicle]);

  if (!placa) return null;
  const title = vehicle ? `${vehicle.marca} ${vehicle.modelo}` : unit ? `${unit.marca} ${unit.modelo}` : "Unidad";
  const tipo = vehicle?.tipo || toVehicleType(unit?.tipo);
  const photo = vehicle?.documentos?.fotoVehiculo;
  const docs = vehicle ? DOCUMENT_FIELDS.filter((d) => d.key !== "fotoVehiculo" && vehicle.documentos?.[d.key]) : [];
  const assignee = vehicleAssignee(vehicle);

  const register = async () => {
    if (!unit) return;
    setBusy("register");
    try { await onRegisterInFleet(unit); } finally { setBusy(null); }
  };
  const pickPhoto = async (file?: File) => {
    if (!file || !vehicle) return;
    setBusy("photo");
    try { await onPhotoSelected(vehicle, file); } finally { setBusy(null); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <Dialog open={!!placa} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
        <div className="grid md:grid-cols-[300px_1fr]">
          {/* Foto y vínculo */}
          <aside className="bg-muted/40 border-b md:border-b-0 md:border-r border-border p-5 space-y-4">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-border bg-card flex items-center justify-center">
              {photo ? (
                <button type="button" className="w-full h-full" onClick={() => setPreview({ src: photo, label: "Foto del vehículo" })}>
                  <img src={photo} alt={`Foto de ${title} ${key}`} className="w-full h-full object-cover" />
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground text-xs text-center px-4">
                  <VehicleAvatar tipo={tipo} size="lg" />
                  {vehicle ? "Sin foto en Flotilla Vehicular" : "Unidad sin ficha en Flotilla Vehicular"}
                </div>
              )}
            </div>
            {vehicle && canManageVehicles && (
              <>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Subir foto del vehículo"
                  onChange={(e) => pickPhoto(e.target.files?.[0])} />
                <Button variant="outline" size="sm" className="w-full gap-2" disabled={busy === "photo"} onClick={() => fileRef.current?.click()}>
                  {busy === "photo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {photo ? "Cambiar foto" : "Agregar foto"}
                </Button>
              </>
            )}

            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Vínculos</p>
              {vehicle ? (
                <div className="flex items-start gap-2 text-xs">
                  <Link2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Flotilla Vehicular · {vehicle.id}</p>
                    <p className="text-muted-foreground">Coincide por {match?.matchedBy === "vin" ? "chasis/VIN" : "placa"}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-xs text-destructive">
                    <Unlink className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>No está registrada en Flotilla Vehicular: no hay foto, asignación ni documentos.</p>
                  </div>
                  {unit && canManageVehicles && (
                    <Button size="sm" className="w-full gap-2" onClick={register} disabled={busy === "register"}>
                      {busy === "register" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Registrar en Flotilla Vehicular
                    </Button>
                  )}
                </div>
              )}
              <div className="flex items-start gap-2 text-xs">
                <Package className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                {assets === null ? (
                  <p className="text-muted-foreground">Buscando activo fijo…</p>
                ) : assets.length === 0 ? (
                  <p className="text-muted-foreground">Sin activo fijo vinculado{vehicle?.numeroActivoFijo ? ` (ficha indica ${vehicle.numeroActivoFijo})` : ""}.</p>
                ) : (
                  <div className="space-y-1">
                    {assets.map(({ asset }) => (
                      <p key={asset.id}><span className="font-mono font-semibold">{asset.id}</span> · {asset.estado} · {asset.ubicacion}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {docs.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Documentos</p>
                <div className="grid grid-cols-3 gap-2">
                  {docs.map((d) => (
                    <button key={d.key} type="button" title={d.label}
                      onClick={() => setPreview({ src: vehicle!.documentos[d.key]!, label: d.label })}
                      className="rounded-md border border-border overflow-hidden hover:border-primary">
                      <img src={vehicle!.documentos[d.key]} alt={d.label} className="h-14 w-full object-cover" />
                      <p className="text-[10px] truncate px-1 py-0.5">{d.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Datos y trazabilidad */}
          <section className="p-5 space-y-5 min-w-0">
            <DialogHeader className="text-left">
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <span>{title}</span>
                <Badge variant="outline" className="font-mono">{key}</Badge>
                {vehicle && <Badge variant="secondary">{vehicle.estado}</Badge>}
              </DialogTitle>
              <DialogDescription>Ficha de mantenimiento y trazabilidad de la unidad</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: Wrench, label: "Gastado", value: formatRD(summary.total) },
                { icon: ClipboardList, label: "Registros", value: String(summary.count) },
                { icon: History, label: "Último servicio", value: summary.lastFecha || "—" },
                { icon: Gauge, label: "Kilometraje", value: (vehicle?.kilometraje || summary.lastKm) ? `${Number(vehicle?.kilometraje || summary.lastKm).toLocaleString("es-DO")} km` : "—" },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border border-border p-3 bg-card">
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1"><k.icon className="h-3.5 w-3.5" /> {k.label}</p>
                  <p className="text-sm font-bold mt-1 tabular-nums">{k.value}</p>
                </div>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-x-6">
              <div>
                <Field label="Tipo" value={vehicle?.tipo || unit?.tipo} />
                <Field label="Año / color" value={[vehicle?.anio || unit?.anio, vehicle?.color || unit?.color].filter(Boolean).join(" · ")} />
                <Field label="Chasis / VIN" value={<span className="font-mono">{vehicle?.vin || unit?.chasis}</span>} />
                <Field label="Matrícula" value={vehicle?.matricula} />
              </div>
              <div>
                <Field label="Asignado a" value={assignee ? <span className="inline-flex items-center gap-1"><UserCheck className="h-3.5 w-3.5" />{assignee}</span> : vehicle ? "Disponible" : null} />
                <Field label="Seguro" value={vehicle?.seguro?.compania || unit?.aseguradora} />
                <Field label="Marbete" value={vehicle?.marbete ? `${vehicle.marbete.estado}${vehicle.marbete.fechaVencimiento ? ` · ${vehicle.marbete.fechaVencimiento}` : ""}` : null} />
                <Field label="Próximo mantenimiento" value={vehicle?.proximoMantenimiento} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-1" onClick={() => onNewExpense(key)}><Plus className="h-4 w-4" /> Nuevo gasto</Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onViewLog(key)}><ClipboardList className="h-4 w-4" /> Ver gastos</Button>
              {vehicle && (
                <Button size="sm" variant="outline" className="gap-1" onClick={() => onOpenFleet(key)}>
                  <ExternalLink className="h-4 w-4" /> Abrir en Flotilla Vehicular
                </Button>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><History className="h-4 w-4" /> Trazabilidad</h4>
              {timeline.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin gastos ni movimientos registrados.</p>
              ) : (
                <ol className="relative border-l-2 border-border ml-2 space-y-3 max-h-[320px] overflow-y-auto pr-2">
                  {timeline.map((t) => (
                    <li key={t.key} className="pl-4 relative">
                      <span className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-background flex items-center justify-center ${t.kind === "gasto" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {t.kind === "gasto" ? <Wrench className="h-2.5 w-2.5" /> : tipo === "Motocicleta" ? <Car className="h-2.5 w-2.5" /> : <CarFront className="h-2.5 w-2.5" />}
                      </span>
                      <div className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-medium">{t.title}</p>
                          {t.detail && <p className="text-muted-foreground">{t.detail}</p>}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {t.kind === "gasto" ? t.fecha : new Date(t.fecha).toLocaleString("es-DO")}
                            {t.who ? ` · ${t.who}` : ""}
                            {t.kind === "movimiento" ? " · Flotilla Vehicular" : ""}
                          </p>
                        </div>
                        {t.amount !== undefined && <span className="font-semibold tabular-nums shrink-0">{formatRD(t.amount)}</span>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>

        <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader><DialogTitle>{preview?.label}</DialogTitle></DialogHeader>
            {preview && <img src={preview.src} alt={preview.label} className="w-full max-h-[75vh] object-contain rounded" />}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
