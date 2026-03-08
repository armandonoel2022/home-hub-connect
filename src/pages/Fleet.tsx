import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { mockVehicles } from "@/lib/mockData";
import type { Vehicle, VehicleStatus } from "@/lib/types";
import { Search, Plus, Truck, X } from "lucide-react";
import ExportMenu from "@/components/ExportMenu";

const statusColors: Record<VehicleStatus, string> = {
  Activo: "bg-emerald-50 text-emerald-700",
  "En Taller": "bg-amber-50 text-amber-700",
  "Dado de Baja": "bg-gray-100 text-gray-500",
  Disponible: "bg-blue-50 text-blue-700",
};

const FleetPage = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<Vehicle>>({ status: "Disponible", year: 2024 });

  const filtered = vehicles.filter(
    (v) =>
      v.plate.toLowerCase().includes(search.toLowerCase()) ||
      v.brand.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase()) ||
      (v.assignedTo || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!form.plate || !form.brand || !form.model) return;
    const newV: Vehicle = {
      id: `VH-${String(vehicles.length + 1).padStart(3, "0")}`,
      plate: form.plate || "",
      brand: form.brand || "",
      model: form.model || "",
      year: form.year || 2024,
      status: (form.status as VehicleStatus) || "Disponible",
      assignedTo: form.assignedTo || null,
      acquisitionDate: form.acquisitionDate || new Date().toISOString().split("T")[0],
      mileage: form.mileage || 0,
      notes: form.notes || "",
    };
    setVehicles([newV, ...vehicles]);
    setShowAdd(false);
    setForm({ status: "Disponible", year: 2024 });
  };

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                  Flotilla <span className="gold-accent-text">Vehicular</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Inventario y asignación de vehículos</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAdd(true)} className="btn-gold flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar Vehículo
                </button>
                <ExportMenu
                  title="Flotilla Vehicular SafeOne"
                  columns={[
                    { header: "Placa", key: "plate", width: 12 },
                    { header: "Marca", key: "brand", width: 14 },
                    { header: "Modelo", key: "model", width: 14 },
                    { header: "Año", key: "year", width: 8 },
                    { header: "Estado", key: "status", width: 14 },
                    { header: "Asignado a", key: "assignedTo", width: 20 },
                    { header: "Kilometraje", key: "mileage", width: 14 },
                  ]}
                  data={vehicles.map((v) => ({ ...v, assignedTo: v.assignedTo || "—" }))}
                  filename="flotilla-safeone"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por placa, marca o asignado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
            />
          </div>
        </div>

        <div className="px-6 pb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <div key={v.id} className="card-department overflow-hidden">
              <div className="h-1 w-full bg-gold" />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Truck className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-card-foreground">{v.brand} {v.model}</h3>
                      <span className="text-xs text-muted-foreground">{v.year}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColors[v.status]}`}>
                    {v.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  {[
                    ["Placa", v.plate],
                    ["Asignado", v.assignedTo || "Sin asignar"],
                    ["Kilometraje", `${v.mileage.toLocaleString()} km`],
                    ["Adquisición", v.acquisitionDate],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-card-foreground">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {showAdd && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Agregar Vehículo</h2>
                <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: "plate", label: "Placa *", type: "text" },
                    { key: "brand", label: "Marca *", type: "text" },
                    { key: "model", label: "Modelo *", type: "text" },
                    { key: "year", label: "Año", type: "number" },
                    { key: "mileage", label: "Kilometraje", type: "number" },
                    { key: "assignedTo", label: "Asignado a", type: "text" },
                  ].map(({ key, label, type }) => (
                    <div key={key}>
                      <label className="text-sm font-medium text-card-foreground block mb-1.5">{label}</label>
                      <input
                        type={type}
                        value={(form as any)[key] || ""}
                        onChange={(e) => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Estado</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as VehicleStatus })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    {(["Activo", "En Taller", "Dado de Baja", "Disponible"] as VehicleStatus[]).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowAdd(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleAdd} className="btn-gold text-sm">Agregar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default FleetPage;
