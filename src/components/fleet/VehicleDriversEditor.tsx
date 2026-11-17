import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Loader2, Plus, Trash2, UserCheck } from "lucide-react";
import { generalSqlApi, isApiConfigured } from "@/lib/api";
import type { Vehiculo, VehicleDriver } from "@/lib/vehicleTypes";
import { vehicleDrivers } from "@/lib/fleetVehicleLink";

export const TURNOS = ["Día", "Noche", "24x24", "Rotativo", "Fines de semana"];

interface Props {
  vehicle: Vehiculo | null;
  onOpenChange: (o: boolean) => void;
  onSave: (v: Vehiculo, drivers: VehicleDriver[]) => Promise<void>;
}

const selectCls = "w-full border rounded-md px-3 py-2 text-sm bg-background";

/** Asigna uno o varios empleados a un vehículo (por turnos). Se guarda en Flotilla Vehicular. */
export default function VehicleDriversEditor({ vehicle, onOpenChange, onSave }: Props) {
  const [list, setList] = useState<VehicleDriver[]>([]);
  const [employees, setEmployees] = useState<{ codigo: string; nombre: string }[] | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [turno, setTurno] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!vehicle) return;
    setList(vehicleDrivers(vehicle).map((d) => ({ ...d })));
    setManual(""); setTurno("");
    if (!isApiConfigured()) { setEmployees([]); return; }
    setEmployees(null);
    generalSqlApi.employeesActive()
      .then((r) => setEmployees((r.items || []).map((e) => ({ codigo: String(e.codigo ?? e.oid), nombre: e.nombreCompleto }))))
      .catch(() => setEmployees([]));
  }, [vehicle]);

  const add = (d: VehicleDriver) => {
    const name = d.nombre.trim();
    if (!name) return;
    if (list.some((x) => (d.id && x.id === d.id) || x.nombre.toLowerCase() === name.toLowerCase())) return;
    setList((l) => [...l, { id: d.id ?? null, nombre: name, turno: turno || null }]);
    setManual("");
  };

  const save = async () => {
    if (!vehicle) return;
    setSaving(true);
    try { await onSave(vehicle, list); onOpenChange(false); } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!vehicle} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" /> Empleados que usan {vehicle?.placa}</DialogTitle>
          <DialogDescription>Puede asignar uno o varios empleados si el vehículo se usa por turnos.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="max-w-[220px]">
            <Label className="text-xs">Turno del próximo empleado (opcional)</Label>
            <select aria-label="Turno" value={turno} onChange={(e) => setTurno(e.target.value)} className={selectCls}>
              <option value="">Sin turno</option>
              {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {employees === null ? (
            <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Cargando empleados activos…</p>
          ) : employees.length > 0 ? (
            <div>
              <Label className="text-xs">Empleado activo</Label>
              <Popover open={pickOpen} onOpenChange={setPickOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-label="Buscar empleado" className="w-full justify-between font-normal">
                    <span className="text-muted-foreground">Buscar por nombre o código…</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Nombre o código…" />
                    <CommandList className="max-h-64">
                      <CommandEmpty>Sin resultados.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((e) => (
                          <CommandItem key={e.codigo} value={`${e.nombre} ${e.codigo}`}
                            onSelect={() => { add({ id: e.codigo, nombre: e.nombre }); setPickOpen(false); }}>
                            <span className="flex-1 truncate">{e.nombre}</span>
                            <span className="text-[10px] font-mono text-muted-foreground ml-2">{e.codigo}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          ) : null}

          <div>
            <Label className="text-xs">{employees && employees.length > 0 ? "O escriba el nombre" : "Nombre del empleado"}</Label>
            <div className="flex gap-2">
              <Input aria-label="Nombre del empleado" value={manual} onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add({ nombre: manual }); } }} />
              <Button type="button" variant="outline" onClick={() => add({ nombre: manual })} disabled={!manual.trim()} className="gap-1">
                <Plus className="h-4 w-4" /> Agregar
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border divide-y divide-border">
            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">Sin empleados asignados: el vehículo quedará disponible.</p>
            ) : list.map((d, i) => (
              <div key={`${d.id || d.nombre}-${i}`} className="flex items-center gap-2 p-2 text-sm">
                <UserCheck className="h-4 w-4 text-primary shrink-0" />
                <span className="flex-1 min-w-0 truncate">{d.nombre}{d.id ? <span className="text-[10px] font-mono text-muted-foreground ml-2">{d.id}</span> : null}</span>
                <select aria-label={`Turno de ${d.nombre}`} value={d.turno || ""} className="border rounded-md px-2 py-1 text-xs bg-background"
                  onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, turno: e.target.value || null } : x)))}>
                  <option value="">Sin turno</option>
                  {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" aria-label={`Quitar ${d.nombre}`}
                  onClick={() => setList((l) => l.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="gap-1">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar asignación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
