import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, X, Link2 } from "lucide-react";
import VehicleAvatar from "./VehicleAvatar";
import {
  VEHICLE_TYPES, FUEL_TYPES, VEHICLE_STATES, DEPARTAMENTOS, DOCUMENT_FIELDS,
  emptyVehicle, computeMarbeteEstado,
} from "@/lib/vehicleTypes";
import type { Vehiculo, VehicleType, FuelType, VehicleState } from "@/lib/vehicleTypes";
import { compressImage, createVehicle, updateVehicle, makeHistory } from "@/lib/vehicleFleetData";
import { loadFixedAssets } from "@/lib/fixedAssetsData";
import type { FixedAsset } from "@/lib/fixedAssetsData";
import { generalSqlApi, isApiConfigured } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  vehicle: Vehiculo | null;
  usuario: string;
  onSaved: () => void;
}

const selectCls =
  "w-full px-3 py-2 rounded-md bg-background border border-input text-foreground text-sm focus:ring-2 focus:ring-ring outline-none";

const VehicleFormDialog = ({ open, onOpenChange, vehicle, usuario, onSaved }: Props) => {
  const [form, setForm] = useState<any>(emptyVehicle());
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [assetQuery, setAssetQuery] = useState("");
  const [employees, setEmployees] = useState<{ codigo: string; nombre: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm(vehicle ? { ...vehicle } : emptyVehicle());
    setAssetQuery("");
    loadFixedAssets()
      .then((all) => setAssets(all.filter((a) => a.tipo === "VEH" || a.tipo === "MOT")))
      .catch(() => setAssets([]));
    if (isApiConfigured()) {
      generalSqlApi
        .employeesActive()
        .then((r) =>
          setEmployees(
            (r.items || []).map((e) => ({ codigo: String(e.codigo ?? e.oid), nombre: e.nombreCompleto }))
          )
        )
        .catch(() => setEmployees([]));
    }
  }, [open, vehicle]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const filteredAssets = useMemo(() => {
    const q = assetQuery.trim().toLowerCase();
    if (!q) return assets.slice(0, 8);
    return assets
      .filter((a) => `${a.id} ${a.descripcion} ${a.serial} ${a.marca} ${a.modelo}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [assets, assetQuery]);

  const handleDoc = async (key: string, file?: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setForm((f: any) => ({ ...f, documentos: { ...(f.documentos || {}), [key]: dataUrl } }));
    } catch {
      toast({ title: "No se pudo procesar la imagen", variant: "destructive" });
    }
  };

  const validate = (): string | null => {
    if (!form.marca?.trim() || !form.modelo?.trim()) return "Marca y modelo son obligatorios";
    if (!form.placa?.trim()) return "La placa es obligatoria";
    if (!form.vin?.trim()) return "El VIN es obligatorio";
    if (form.vin.trim().length < 6) return "El VIN debe tener al menos 6 caracteres";
    if (!form.anio || form.anio < 1950 || form.anio > new Date().getFullYear() + 1) return "Año inválido";
    if (form.kilometraje == null || form.kilometraje < 0) return "Kilometraje inválido";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) return toast({ title: err, variant: "destructive" });
    setSaving(true);
    try {
      const payload = {
        ...form,
        placa: String(form.placa).trim().toUpperCase(),
        vin: String(form.vin).trim().toUpperCase(),
        matricula: String(form.matricula || "").trim().toUpperCase(),
        marbete: {
          ...(form.marbete || {}),
          estado: computeMarbeteEstado(form.marbete?.fechaVencimiento),
        },
      };
      if (vehicle) {
        const changes: string[] = [];
        if (vehicle.estado !== payload.estado) changes.push(`Estado: ${vehicle.estado} → ${payload.estado}`);
        if ((vehicle.asignacion?.empleadoNombre || vehicle.asignacion?.departamento) !==
            (payload.asignacion?.empleadoNombre || payload.asignacion?.departamento)) {
          changes.push(
            `Asignación: ${payload.asignacion?.empleadoNombre || payload.asignacion?.departamento || "sin asignar"}`
          );
        }
        const hist = changes.length
          ? changes.map((c) => makeHistory(c.startsWith("Asignación") ? "asignacion" : "estado", c, usuario))
          : [makeHistory("actualizacion", "Datos del vehículo actualizados", usuario)];
        await updateVehicle(vehicle.id, payload, hist);
        toast({ title: "Vehículo actualizado" });
      } else {
        await createVehicle({ ...payload, creadoPor: usuario }, usuario);
        toast({ title: "Vehículo registrado" });
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: e?.message || "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <VehicleAvatar tipo={form.tipo as VehicleType} photo={form.documentos?.fotoVehiculo} />
            {vehicle ? `Editar ${vehicle.placa}` : "Registrar vehículo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Identificación */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Tipo *</Label>
              <select className={selectCls} value={form.tipo} onChange={(e) => set("tipo", e.target.value as VehicleType)}>
                {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><Label>Marca *</Label><Input value={form.marca} onChange={(e) => set("marca", e.target.value)} /></div>
            <div><Label>Modelo *</Label><Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} /></div>
            <div><Label>Año *</Label><Input type="number" value={form.anio} onChange={(e) => set("anio", Number(e.target.value))} /></div>
            <div><Label>Color</Label><Input value={form.color} onChange={(e) => set("color", e.target.value)} /></div>
            <div>
              <Label>Combustible</Label>
              <select className={selectCls} value={form.combustible} onChange={(e) => set("combustible", e.target.value as FuelType)}>
                {FUEL_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><Label>VIN *</Label><Input value={form.vin} onChange={(e) => set("vin", e.target.value)} /></div>
            <div><Label>Placa *</Label><Input value={form.placa} onChange={(e) => set("placa", e.target.value)} /></div>
            <div><Label>Matrícula</Label><Input value={form.matricula} onChange={(e) => set("matricula", e.target.value)} /></div>
            <div><Label>Kilometraje *</Label><Input type="number" value={form.kilometraje} onChange={(e) => set("kilometraje", Number(e.target.value))} /></div>
            <div><Label>Capacidad</Label><Input type="number" value={form.capacidad} onChange={(e) => set("capacidad", Number(e.target.value))} /></div>
            <div>
              <Label>Estado *</Label>
              <select className={selectCls} value={form.estado} onChange={(e) => set("estado", e.target.value as VehicleState)}>
                {VEHICLE_STATES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </section>

          {/* Marbete, seguro y mantenimiento */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border pt-4">
            <div>
              <Label>Vencimiento marbete</Label>
              <Input
                type="date"
                value={form.marbete?.fechaVencimiento || ""}
                onChange={(e) => set("marbete", { ...(form.marbete || {}), fechaVencimiento: e.target.value || null })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Estado: {computeMarbeteEstado(form.marbete?.fechaVencimiento)}
              </p>
            </div>
            <div><Label>Aseguradora</Label><Input value={form.seguro?.compania || ""} onChange={(e) => set("seguro", { ...(form.seguro || {}), compania: e.target.value })} /></div>
            <div><Label>Póliza</Label><Input value={form.seguro?.poliza || ""} onChange={(e) => set("seguro", { ...(form.seguro || {}), poliza: e.target.value })} /></div>
            <div><Label>Vigencia seguro</Label><Input type="date" value={form.seguro?.vigenciaHasta || ""} onChange={(e) => set("seguro", { ...(form.seguro || {}), vigenciaHasta: e.target.value })} /></div>
            <div><Label>Último mantenimiento</Label><Input type="date" value={form.ultimoMantenimiento || ""} onChange={(e) => set("ultimoMantenimiento", e.target.value || null)} /></div>
            <div><Label>Próximo mantenimiento</Label><Input type="date" value={form.proximoMantenimiento || ""} onChange={(e) => set("proximoMantenimiento", e.target.value || null)} /></div>
          </section>

          {/* Asignación */}
          <section className="border-t border-border pt-4 space-y-3">
            <h4 className="font-semibold text-sm">Asignación</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Tipo</Label>
                <select
                  className={selectCls}
                  value={form.asignacion?.tipo || ""}
                  onChange={(e) =>
                    set("asignacion", {
                      ...(form.asignacion || {}),
                      tipo: e.target.value || null,
                      empleadoId: null, empleadoNombre: null, departamento: null,
                    })
                  }
                >
                  <option value="">Sin asignar</option>
                  <option value="Empleado">Empleado</option>
                  <option value="Departamento">Departamento</option>
                </select>
              </div>
              {form.asignacion?.tipo === "Empleado" && (
                <div>
                  <Label>Empleado activo</Label>
                  {employees.length > 0 ? (
                    <select
                      className={selectCls}
                      value={form.asignacion?.empleadoId || ""}
                      onChange={(e) => {
                        const emp = employees.find((x) => x.codigo === e.target.value);
                        set("asignacion", { ...form.asignacion, empleadoId: emp?.codigo || null, empleadoNombre: emp?.nombre || null });
                      }}
                    >
                      <option value="">Seleccione...</option>
                      {employees.map((e) => <option key={e.codigo} value={e.codigo}>{e.nombre}</option>)}
                    </select>
                  ) : (
                    <Input
                      placeholder="Nombre del empleado"
                      value={form.asignacion?.empleadoNombre || ""}
                      onChange={(e) => set("asignacion", { ...form.asignacion, empleadoNombre: e.target.value })}
                    />
                  )}
                </div>
              )}
              {form.asignacion?.tipo === "Departamento" && (
                <div>
                  <Label>Departamento</Label>
                  <select
                    className={selectCls}
                    value={form.asignacion?.departamento || ""}
                    onChange={(e) => set("asignacion", { ...form.asignacion, departamento: e.target.value })}
                  >
                    <option value="">Seleccione...</option>
                    {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
              )}
              {form.asignacion?.tipo && (
                <>
                  <div><Label>Fecha asignación</Label><Input type="date" value={form.asignacion?.fechaAsignacion || ""} onChange={(e) => set("asignacion", { ...form.asignacion, fechaAsignacion: e.target.value })} /></div>
                  <div><Label>Fecha devolución</Label><Input type="date" value={form.asignacion?.fechaDevolucion || ""} onChange={(e) => set("asignacion", { ...form.asignacion, fechaDevolucion: e.target.value || null })} /></div>
                </>
              )}
            </div>
          </section>

          {/* Activo fijo */}
          <section className="border-t border-border pt-4 space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Link2 className="h-4 w-4" /> Activo fijo relacionado</h4>
            {form.activoFijoId ? (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>{form.numeroActivoFijo || form.activoFijoId}</span>
                <Button variant="ghost" size="sm" onClick={() => setForm((f: any) => ({ ...f, activoFijoId: null, numeroActivoFijo: null }))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Input placeholder="Buscar activo (SSC-VEH..., serial, descripción)" value={assetQuery} onChange={(e) => setAssetQuery(e.target.value)} />
                <div className="max-h-40 overflow-y-auto divide-y divide-border rounded-md border border-border">
                  {filteredAssets.length === 0 && <p className="p-3 text-xs text-muted-foreground">Sin coincidencias en Activos Fijos.</p>}
                  {filteredAssets.map((a) => (
                    <button
                      key={a.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-xs"
                      onClick={() => setForm((f: any) => ({ ...f, activoFijoId: a.id, numeroActivoFijo: a.codigoOriginal || a.id }))}
                    >
                      <span className="font-medium">{a.id}</span> — {a.descripcion} {a.serial ? `· ${a.serial}` : ""}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Documentos */}
          <section className="border-t border-border pt-4">
            <h4 className="font-semibold text-sm mb-3">Documentos y evidencias (opcional)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DOCUMENT_FIELDS.map(({ key, label }) => {
                const val = form.documentos?.[key];
                return (
                  <div key={key} className="border border-border rounded-lg p-2 text-center">
                    {val ? (
                      <img src={val} alt={label} className="h-20 w-full object-cover rounded" />
                    ) : (
                      <div className="h-20 flex items-center justify-center bg-muted rounded text-muted-foreground">
                        <Upload className="h-5 w-5" />
                      </div>
                    )}
                    <p className="text-[11px] mt-1 truncate">{label}</p>
                    <div className="flex gap-1 justify-center mt-1">
                      <label className="text-[11px] text-primary cursor-pointer hover:underline">
                        {val ? "Cambiar" : "Subir"}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleDoc(key, e.target.files?.[0])} />
                      </label>
                      {val && (
                        <button
                          className="text-[11px] text-destructive hover:underline"
                          onClick={() => setForm((f: any) => ({ ...f, documentos: { ...f.documentos, [key]: undefined } }))}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div>
            <Label>Observaciones</Label>
            <Textarea value={form.observaciones || ""} onChange={(e) => set("observaciones", e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {vehicle ? "Guardar cambios" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleFormDialog;
