import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useEquipment } from "@/hooks/useApiHooks";
import type { Equipment, EquipmentStatus, EquipmentType } from "@/lib/types";
import { Search, Plus, Monitor, Printer, Cpu, Wifi, Package, X, Trash2 } from "lucide-react";
import ExportMenu from "@/components/ExportMenu";

const typeIcons: Record<EquipmentType, typeof Monitor> = {
  Computadora: Cpu,
  Monitor: Monitor,
  Impresora: Printer,
  "Equipo de Red": Wifi,
  Otro: Package,
};

const statusColors: Record<EquipmentStatus, string> = {
  Disponible: "bg-emerald-50 text-emerald-700",
  Asignado: "bg-blue-50 text-blue-700",
  "En Reparación": "bg-amber-50 text-amber-700",
  "Dado de Baja": "bg-gray-100 text-gray-500",
};

const ALLOWED_DEPARTMENTS = [
  "Tecnología y Monitoreo", "Administración", "Gerencia", "Gerencia General", "Gerencia Comercial",
];

const InventoryPage = () => {
  const { user } = useAuth();
  const { data: equipment, setData: setEquipment, create: createEquipment, remove: removeEquipment } = useEquipment();

  // Access control: only IT, Admin, and Management
  const hasAccess = user?.isAdmin || ALLOWED_DEPARTMENTS.includes(user?.department || "");
  if (!hasAccess) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-heading font-bold text-card-foreground mb-2">Acceso Restringido</h2>
            <p className="text-muted-foreground">Solo los departamentos de IT, Administración y Gerencia pueden acceder al inventario.</p>
          </div>
        </div>
      </AppLayout>
    );
  }
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("Todos");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<Equipment>>({ type: "Computadora", status: "Disponible" });

  const filtered = equipment.filter((e) => {
    const matchSearch =
      e.brand.toLowerCase().includes(search.toLowerCase()) ||
      e.model.toLowerCase().includes(search.toLowerCase()) ||
      e.serial.toLowerCase().includes(search.toLowerCase()) ||
      (e.assignedTo || "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "Todos" || e.type === filterType;
    return matchSearch && matchType;
  });

  const typeCounts = {
    Todos: equipment.length,
    Computadora: equipment.filter((e) => e.type === "Computadora").length,
    Monitor: equipment.filter((e) => e.type === "Monitor").length,
    Impresora: equipment.filter((e) => e.type === "Impresora").length,
    "Equipo de Red": equipment.filter((e) => e.type === "Equipo de Red").length,
  };

  const handleAdd = () => {
    if (!form.brand || !form.model || !form.serial) return;
    const newItem: Equipment = {
      id: `EQ-${String(equipment.length + 1).padStart(3, "0")}`,
      type: (form.type as EquipmentType) || "Otro",
      brand: form.brand || "",
      model: form.model || "",
      serial: form.serial || "",
      status: (form.status as EquipmentStatus) || "Disponible",
      assignedTo: form.assignedTo || null,
      department: form.department || null,
      acquisitionDate: form.acquisitionDate || new Date().toISOString().split("T")[0],
      notes: form.notes || "",
    };
    setEquipment([newItem, ...equipment]);
    setShowAdd(false);
    setForm({ type: "Computadora", status: "Disponible" });
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
                  Inventario <span className="gold-accent-text">IT</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Equipos de cómputo, monitores, impresoras y red</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAdd(true)} className="btn-gold flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar Equipo
                </button>
                <ExportMenu
                  title="Inventario IT SafeOne"
                  columns={[
                    { header: "Tipo", key: "type", width: 14 },
                    { header: "Marca", key: "brand", width: 14 },
                    { header: "Modelo", key: "model", width: 14 },
                    { header: "Serial", key: "serial", width: 18 },
                    { header: "Estado", key: "status", width: 14 },
                    { header: "Asignado a", key: "assignedTo", width: 20 },
                    { header: "Departamento", key: "department", width: 18 },
                  ]}
                  data={filtered.map((e) => ({ ...e, assignedTo: e.assignedTo || "—", department: e.department || "—" }))}
                  filename="inventario-it-safeone"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5 flex-wrap">
              {Object.entries(typeCounts).map(([label, count]) => (
                <button
                  key={label}
                  onClick={() => setFilterType(label)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterType === label
                      ? "bg-gold text-charcoal-dark"
                      : "bg-charcoal-light text-muted-foreground hover:text-secondary-foreground"
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por marca, modelo, serial o asignado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
            />
          </div>
        </div>

        <div className="px-6 pb-8">
          <div className="bg-card rounded-xl overflow-hidden shadow-sm border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-heading font-semibold text-muted-foreground text-xs uppercase tracking-wider">ID</th>
                    <th className="text-left px-4 py-3 font-heading font-semibold text-muted-foreground text-xs uppercase tracking-wider">Tipo</th>
                    <th className="text-left px-4 py-3 font-heading font-semibold text-muted-foreground text-xs uppercase tracking-wider">Marca / Modelo</th>
                    <th className="text-left px-4 py-3 font-heading font-semibold text-muted-foreground text-xs uppercase tracking-wider">Serial</th>
                    <th className="text-left px-4 py-3 font-heading font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                    <th className="text-left px-4 py-3 font-heading font-semibold text-muted-foreground text-xs uppercase tracking-wider">Asignado a</th>
                    <th className="text-left px-4 py-3 font-heading font-semibold text-muted-foreground text-xs uppercase tracking-wider">Adquisición</th>
                    {user?.isAdmin && <th className="text-left px-4 py-3 font-heading font-semibold text-muted-foreground text-xs uppercase tracking-wider w-16"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((eq) => {
                    const TypeIcon = typeIcons[eq.type] || Package;
                    return (
                      <tr key={eq.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{eq.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            <span>{eq.type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-card-foreground">{eq.brand} {eq.model}</td>
                        <td className="px-4 py-3 font-mono text-xs">{eq.serial}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColors[eq.status]}`}>
                            {eq.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">{eq.assignedTo || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{eq.acquisitionDate}</td>
                        {user?.isAdmin && (
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
                                if (window.confirm(`¿Eliminar equipo ${eq.id}: ${eq.brand} ${eq.model}?`)) {
                                  setEquipment((prev) => prev.filter((e) => e.id !== eq.id));
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Add Equipment Modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Agregar Equipo</h2>
                <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Tipo *</label>
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as EquipmentType })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      {(["Computadora", "Monitor", "Impresora", "Equipo de Red", "Otro"] as EquipmentType[]).map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Estado</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EquipmentStatus })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      {(["Disponible", "Asignado", "En Reparación", "Dado de Baja"] as EquipmentStatus[]).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {[
                  { key: "brand", label: "Marca *", placeholder: "Ej: Dell, HP, Ubiquiti" },
                  { key: "model", label: "Modelo *", placeholder: "Ej: OptiPlex 7090" },
                  { key: "serial", label: "Serial *", placeholder: "Número de serie" },
                  { key: "assignedTo", label: "Asignado a", placeholder: "Nombre del usuario" },
                  { key: "acquisitionDate", label: "Fecha de Adquisición", placeholder: "YYYY-MM-DD" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">{label}</label>
                    <input
                      type={key === "acquisitionDate" ? "date" : "text"}
                      value={(form as any)[key] || ""}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                      placeholder={placeholder}
                    />
                  </div>
                ))}
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

export default InventoryPage;
