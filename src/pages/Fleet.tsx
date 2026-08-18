import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import ExportMenu from "@/components/ExportMenu";
import VehicleAvatar from "@/components/fleet/VehicleAvatar";
import VehicleFormDialog from "@/components/fleet/VehicleFormDialog";
import VehicleDetailDialog from "@/components/fleet/VehicleDetailDialog";
import {
  VEHICLE_TYPES, VEHICLE_STATES, daysUntil,
} from "@/lib/vehicleTypes";
import type { Vehiculo } from "@/lib/vehicleTypes";
import { listVehicles, deleteVehicle, isVehicleServerMode } from "@/lib/vehicleFleetData";
import { Search, Plus, Trash2, Cloud, CloudOff, AlertTriangle, Car, UserCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const TYPE_COLORS: Record<string, string> = {
  SUV: "hsl(42 90% 50%)",
  Automovil: "hsl(215 80% 55%)",
  Motocicleta: "hsl(142 65% 45%)",
  Camioneta: "hsl(25 85% 55%)",
  Furgon: "hsl(275 60% 60%)",
  Otro: "hsl(215 15% 60%)",
};

const stateTone: Record<string, string> = {
  Activo: "bg-emerald-50 text-emerald-700",
  "En Mantenimiento": "bg-amber-50 text-amber-700",
  Inactivo: "bg-gray-100 text-gray-600",
  Descargado: "bg-red-50 text-red-600",
};

const selectCls =
  "px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none";

const FleetPage = () => {
  const { user } = useAuth();
  const canEdit = !!user;
  const [vehicles, setVehicles] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [server, setServer] = useState(false);
  const [search, setSearch] = useState("");
  const [fType, setFType] = useState("");
  const [fState, setFState] = useState("");
  const [fAsign, setFAsign] = useState("");
  const [fMarbete, setFMarbete] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehiculo | null>(null);
  const [detail, setDetail] = useState<Vehiculo | null>(null);
  const [toDelete, setToDelete] = useState<Vehiculo | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listVehicles();
      setVehicles(data);
      setServer(isVehicleServerMode());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      const asignado = v.asignacion?.empleadoNombre || v.asignacion?.departamento || "";
      if (q && !`${v.placa} ${v.marca} ${v.modelo} ${v.vin} ${v.matricula} ${asignado}`.toLowerCase().includes(q)) return false;
      if (fType && v.tipo !== fType) return false;
      if (fState && v.estado !== fState) return false;
      if (fMarbete && v.marbete?.estado !== fMarbete) return false;
      if (fAsign === "asignado" && !asignado) return false;
      if (fAsign === "disponible" && asignado) return false;
      if (fAsign && fAsign !== "asignado" && fAsign !== "disponible" && asignado !== fAsign) return false;
      return true;
    });
  }, [vehicles, search, fType, fState, fAsign, fMarbete]);

  const kpis = useMemo(() => {
    const activos = vehicles.filter((v) => v.estado === "Activo").length;
    const asignados = vehicles.filter((v) => v.asignacion?.empleadoNombre || v.asignacion?.departamento).length;
    const mantenimiento = vehicles.filter((v) => v.estado === "En Mantenimiento").length;
    const vencimientos = vehicles.filter((v) => {
      const d = daysUntil(v.marbete?.fechaVencimiento);
      return d !== null && d <= 30;
    }).length;
    return { activos, asignados, disponibles: vehicles.length - asignados, mantenimiento, vencimientos };
  }, [vehicles]);

  const byType = useMemo(
    () =>
      VEHICLE_TYPES.map((t) => ({ name: t, value: vehicles.filter((v) => v.tipo === t).length }))
        .filter((d) => d.value > 0),
    [vehicles]
  );

  const asignables = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach((v) => {
      const a = v.asignacion?.empleadoNombre || v.asignacion?.departamento;
      if (a) set.add(a);
    });
    return [...set].sort();
  }, [vehicles]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteVehicle(toDelete.id, "Descargado desde Flotilla Vehicular", user?.fullName || "Sistema");
      toast({ title: `Vehículo ${toDelete.placa} descargado` });
      setToDelete(null);
      refresh();
    } catch (e: any) {
      toast({ title: e?.message || "No se pudo descargar", variant: "destructive" });
    }
  };

  const kpiCards = [
    { label: "Vehículos activos", value: kpis.activos, icon: Car, onClick: () => { setFState("Activo"); setFAsign(""); } },
    { label: "Asignados", value: kpis.asignados, icon: UserCheck, onClick: () => { setFAsign("asignado"); setFState(""); } },
    { label: "Disponibles", value: kpis.disponibles, icon: Car, onClick: () => { setFAsign("disponible"); setFState(""); } },
    { label: "En mantenimiento", value: kpis.mantenimiento, icon: Wrench, onClick: () => { setFState("En Mantenimiento"); setFAsign(""); } },
    
  ];

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                Flotilla <span className="gold-accent-text">Vehicular</span>
              </h1>
              <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
                Registro, documentación y asignación de vehículos
                <span className="inline-flex items-center gap-1 text-xs">
                  {server ? <><Cloud className="h-3.5 w-3.5" /> Sincronizado con servidor</> : <><CloudOff className="h-3.5 w-3.5" /> Modo local</>}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="btn-gold flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Registrar vehículo
                </Button>
              )}
              <ExportMenu
                title="Flotilla Vehicular SafeOne"
                columns={[
                  { header: "ID", key: "id", width: 12 },
                  { header: "Tipo", key: "tipo", width: 12 },
                  { header: "Placa", key: "placa", width: 12 },
                  { header: "Marca", key: "marca", width: 14 },
                  { header: "Modelo", key: "modelo", width: 14 },
                  { header: "Año", key: "anio", width: 8 },
                  { header: "VIN", key: "vin", width: 20 },
                  { header: "Estado", key: "estado", width: 16 },
                  { header: "Asignado a", key: "asignado", width: 22 },
                  { header: "Kilometraje", key: "kilometraje", width: 12 },
                ]}
                data={filtered.map((v) => ({
                  ...v,
                  asignado: v.asignacion?.empleadoNombre || v.asignacion?.departamento || "—",
                }))}

                filename="flotilla-vehicular"
              />
            </div>
          </div>
        </div>

        {/* Dashboard */}
        <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
            {kpiCards.map((k, i) => (
              <motion.button
                key={k.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={k.onClick}
                className="card-department p-4 text-left hover:border-gold transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{k.label}</span>
                  <k.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="font-heading font-bold text-2xl mt-1">{k.value}</p>
              </motion.button>
            ))}
          </div>
          <div className="card-department p-4">
            <h3 className="text-sm font-semibold mb-2">Vehículos por tipo</h3>
            {byType.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aún no hay vehículos registrados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                    {byType.map((d) => <Cell key={d.name} fill={TYPE_COLORS[d.name]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="px-6 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar placa, VIN, marca, asignado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
            />
          </div>
          <select className={selectCls} value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="">Todos los tipos</option>
            {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select className={selectCls} value={fState} onChange={(e) => setFState(e.target.value)}>
            <option value="">Todos los estados</option>
            {VEHICLE_STATES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select className={selectCls} value={fAsign} onChange={(e) => setFAsign(e.target.value)}>
            <option value="">Asignación: todas</option>
            <option value="asignado">Asignados</option>
            <option value="disponible">Disponibles</option>
            {asignables.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {(fType || fState || fAsign || search) && (
            <Button variant="ghost" size="sm" onClick={() => { setFType(""); setFState(""); setFAsign(""); setSearch(""); }}>
              Limpiar filtros
            </Button>
          )}
        </div>


        {/* Tabla */}
        <div className="px-6 py-5">
          <div className="card-department overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  {["Vehículo", "Placa / VIN", "Tipo", "Estado", "Asignado a", "Km", ""].map((h) => (
                    <th key={h} className="text-left font-semibold px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Cargando flotilla...</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      No hay vehículos registrados con esos criterios. Use “Registrar vehículo” para cargar data real.
                    </td>
                  </tr>
                )}
                {filtered.map((v) => {
                  return (
                    <tr key={v.id} className="border-t border-border hover:bg-muted/40 cursor-pointer" onClick={() => setDetail(v)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <VehicleAvatar tipo={v.tipo} photo={v.documentos?.fotoVehiculo} size="sm" />
                          <div>
                            <p className="font-medium">{v.marca} {v.modelo}</p>
                            <p className="text-xs text-muted-foreground">{v.anio} · {v.color || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{v.placa}</p>
                        <p className="text-xs text-muted-foreground">{v.vin}</p>
                      </td>
                      <td className="px-4 py-3">{v.tipo}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${stateTone[v.estado] || ""}`}>{v.estado}</span>
                      </td>

                      <td className="px-4 py-3">{v.asignacion?.empleadoNombre || v.asignacion?.departamento || <span className="text-muted-foreground">Disponible</span>}</td>
                      <td className="px-4 py-3">{(v.kilometraje || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        {user?.isAdmin && (
                          <button
                            className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600"
                            title="Descargar vehículo"
                            onClick={(e) => { e.stopPropagation(); setToDelete(v); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <VehicleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        vehicle={editing}
        usuario={user?.fullName || "Sistema"}
        onSaved={refresh}
      />

      <VehicleDetailDialog
        vehicle={detail}
        onOpenChange={(o) => !o && setDetail(null)}
        canEdit={canEdit}
        onEdit={(v) => { setDetail(null); setEditing(v); setFormOpen(true); }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descargar vehículo {toDelete?.placa}?</AlertDialogTitle>
            <AlertDialogDescription>
              El vehículo se marcará como “Descargado” y se conservará en el historial de auditoría. No se elimina permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Descargar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default FleetPage;
