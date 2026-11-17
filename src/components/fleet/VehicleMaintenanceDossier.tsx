import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Camera, Car, CarFront, ClipboardList, ExternalLink, Gauge, History, Link2, Loader2, Package, Plus, Unlink, UserCheck, Users, Wrench, X,
} from "lucide-react";
import VehicleAvatar from "./VehicleAvatar";
import type { FleetUnit, MaintenanceEntry } from "@/lib/fleetMaintenanceTypes";
import type { VehicleMatch } from "@/lib/fleetVehicleLink";
import { maintenanceSummary, toVehicleType, vehicleDrivers } from "@/lib/fleetVehicleLink";
import { normalizePlaca, parseFecha, filterByPeriod, periodLabel, monthKeyOf, MONTH_SHORT, MONTH_KEYS } from "@/lib/fleetMaintenanceRules";
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
  onEditDrivers?: (v: Vehiculo) => void;
  /** Período con el que se abre la ficha (p. ej. el elegido en el tablero). */
  initialYear?: number | null;
  initialMonth?: number | null;
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
  onRegisterInFleet, onPhotoSelected, onNewExpense, onViewLog, onOpenFleet, onEditDrivers,
  initialYear = null, initialMonth = null,
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
  const [year, setYear] = useState<number | null>(initialYear);
  const [month, setMonth] = useState<number | null>(initialMonth);
  useEffect(() => { setYear(initialYear); setMonth(initialMonth); }, [placa, initialYear, initialMonth]);

  const allOwn = useMemo(() => entries.filter((e) => normalizePlaca(e.placa) === key), [entries, key]);
  const own = useMemo(() => filterByPeriod(allOwn, year, month), [allOwn, year, month]);
  const lifetime = useMemo(() => maintenanceSummary(allOwn, key), [allOwn, key]);
  const summary = useMemo(() => maintenanceSummary(own, key), [own, key]);
  const filtered = year != null || month != null;

  // Gasto por año (todo el historial) y por mes del año elegido
  const byYear = useMemo(() => {
    const m = new Map<number, { total: number; count: number }>();
    for (const e of allOwn) {
      const k = monthKeyOf(e.fecha);
      if (!k) continue;
      const y = Number(k.slice(0, 4));
      const cur = m.get(y) || { total: 0, count: 0 };
      cur.total += Number(e.costo) || 0; cur.count += 1;
      m.set(y, cur);
    }
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [allOwn]);
  const byMonth = useMemo(() => {
    if (year == null) return null;
    const arr = MONTH_KEYS.map(() => ({ total: 0, count: 0 }));
    for (const e of filterByPeriod(allOwn, year, null)) {
      const k = monthKeyOf(e.fecha);
      if (!k) continue;
      const i = Number(k.slice(5, 7)) - 1;
      arr[i].total += Number(e.costo) || 0; arr[i].count += 1;
    }
    return arr;
  }, [allOwn, year]);
  const monthMax = byMonth ? Math.max(1, ...byMonth.map((x) => x.total)) : 1;

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
    const movs = filterByPeriod((vehicle?.historial || []).filter((h) => h.tipo !== "mantenimiento"), year, month); // gastos ya se muestran arriba
    for (const h of movs) {
      items.push({ key: `h-${h.id}`, fecha: h.fecha, kind: "movimiento", title: h.descripcion, who: h.usuario });
    }
    return items.sort((a, b) => (String(a.fecha) < String(b.fecha) ? 1 : -1));
  }, [own, vehicle, year, month]);

  if (!placa) return null;
  const title = vehicle ? `${vehicle.marca} ${vehicle.modelo}` : unit ? `${unit.marca} ${unit.modelo}` : "Unidad";
  const tipo = vehicle?.tipo || toVehicleType(unit?.tipo);
  const photo = vehicle?.documentos?.fotoVehiculo;
  const docs = vehicle ? DOCUMENT_FIELDS.filter((d) => d.key !== "fotoVehiculo" && vehicle.documentos?.[d.key]) : [];
  const drivers = vehicleDrivers(vehicle);

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
                { icon: Wrench, label: filtered ? "Gastado en el período" : "Gastado (total)", value: formatRD(summary.total) },
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
                <Field label="Asignado a" value={
                  <span className="inline-flex flex-col items-end gap-0.5">
                    {drivers.length ? drivers.map((d, i) => (
                      <span key={`${d.id || d.nombre}-${i}`} className="inline-flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5" />{d.nombre}{d.turno ? <Badge variant="outline" className="text-[10px] px-1 py-0">{d.turno}</Badge> : null}
                      </span>
                    )) : (vehicle?.asignacion?.departamento || (vehicle ? "Disponible" : "—"))}
                    {vehicle && onEditDrivers && (
                      <button type="button" onClick={() => onEditDrivers(vehicle)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                        <Users className="h-3 w-3" /> {drivers.length ? "Cambiar empleados / turnos" : "Asignar empleados"}
                      </button>
                    )}
                  </span>
                } />
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

            {/* Inversión por período */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold mr-auto">Inversión en reparaciones</h4>
                <select aria-label="Año de la trazabilidad" value={year ?? ""} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
                  className="border rounded-md px-2 py-1 text-xs bg-background">
                  <option value="">Todos los años</option>
                  {byYear.map(([y]) => <option key={y} value={y}>{y}</option>)}
                </select>
                <select aria-label="Mes de la trazabilidad" value={month ?? ""} onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)}
                  className="border rounded-md px-2 py-1 text-xs bg-background">
                  <option value="">Todos los meses</option>
                  {MONTH_KEYS.map((m, i) => <option key={m} value={i + 1}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
                {filtered && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { setYear(null); setMonth(null); }}>
                    <X className="h-3 w-3" /> Ver todo
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {periodLabel(year, month)}: <strong className="text-foreground">{formatRD(summary.total)}</strong> en {summary.count} gasto(s)
                {filtered && <> · Total histórico {formatRD(lifetime.total)}</>}
              </p>
              {byYear.length > 0 && year == null && (
                <div className="flex flex-wrap gap-2">
                  {byYear.map(([y, v]) => (
                    <button key={y} type="button" onClick={() => setYear(y)}
                      className="rounded-md border border-border px-2.5 py-1.5 text-left hover:border-primary hover:bg-primary/5 transition-colors">
                      <p className="text-[11px] text-muted-foreground">{y} · {v.count} reg.</p>
                      <p className="text-xs font-semibold tabular-nums">{formatRD(v.total)}</p>
                    </button>
                  ))}
                </div>
              )}
              {byMonth && (
                <div className="grid grid-cols-12 gap-1 items-end h-20" aria-label={`Gasto por mes de ${year}`}>
                  {byMonth.map((m, i) => (
                    <button key={i} type="button" onClick={() => setMonth(month === i + 1 ? null : i + 1)}
                      title={`${MONTH_SHORT[i]} ${year}: ${formatRD(m.total)} (${m.count} reg.)`}
                      className="flex flex-col items-center justify-end h-full gap-1 group">
                      <span className={`w-full rounded-t ${month === i + 1 ? "bg-primary" : "bg-primary/40 group-hover:bg-primary/70"}`}
                        style={{ height: `${m.total ? Math.max(6, (m.total / monthMax) * 100) : 2}%` }} />
                      <span className={`text-[9px] ${month === i + 1 ? "font-bold text-primary" : "text-muted-foreground"}`}>{MONTH_SHORT[i]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><History className="h-4 w-4" /> Trazabilidad</h4>
              {timeline.length === 0 ? (
                <p className="text-xs text-muted-foreground">{filtered ? `Sin gastos ni movimientos en ${periodLabel(year, month).toLowerCase()}.` : "Sin gastos ni movimientos registrados."}</p>
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
