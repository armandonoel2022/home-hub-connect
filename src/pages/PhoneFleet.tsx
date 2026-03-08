import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { mockPhones } from "@/lib/mockData";
import type { PhoneDevice, PhoneStatus } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/types";
import { Search, Plus, Smartphone, X, Trash2 } from "lucide-react";

const statusColors: Record<PhoneStatus, string> = {
  Activo: "bg-emerald-50 text-emerald-700",
  Disponible: "bg-blue-50 text-blue-700",
  "En Reparación": "bg-amber-50 text-amber-700",
  "Dado de Baja": "bg-gray-100 text-gray-500",
};

const PhoneFleetPage = () => {
  const { user } = useAuth();
  const [phones, setPhones] = useState<PhoneDevice[]>(mockPhones);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<PhoneDevice>>({ status: "Disponible" });

  // Non-admins only see their own assigned phone
  const userPhones = user?.isAdmin
    ? phones
    : phones.filter((p) => p.assignedTo === user?.fullName);

  const filtered = userPhones.filter(
    (p) =>
      p.imei.toLowerCase().includes(search.toLowerCase()) ||
      p.serial.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase()) ||
      p.model.toLowerCase().includes(search.toLowerCase()) ||
      (p.assignedTo || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!form.imei || !form.serial || !form.brand || !form.model) return;
    const newP: PhoneDevice = {
      id: `PH-${String(phones.length + 1).padStart(3, "0")}`,
      imei: form.imei || "",
      serial: form.serial || "",
      brand: form.brand || "",
      model: form.model || "",
      status: (form.status as PhoneStatus) || "Disponible",
      assignedTo: form.assignedTo || null,
      department: form.department || null,
      acquisitionDate: form.acquisitionDate || new Date().toISOString().split("T")[0],
      phoneNumber: form.phoneNumber || "",
      notes: form.notes || "",
    };
    setPhones([newP, ...phones]);
    setShowAdd(false);
    setForm({ status: "Disponible" });
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
                  Flota <span className="gold-accent-text">Celular</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Registro de dispositivos móviles corporativos</p>
              </div>
              {user?.isAdmin && (
                <button onClick={() => setShowAdd(true)} className="btn-gold flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar Dispositivo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por IMEI, serial, marca o asignado..."
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
                    {["ID", "Marca / Modelo", "IMEI", "Serial", "Nro. Teléfono", "Estado", "Asignado a", "Departamento", "Adquisición", ...(user?.isAdmin ? [""] : [])].map((h, i) => (
                      <th key={`${h}-${i}`} className="text-left px-4 py-3 font-heading font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-card-foreground">{p.brand} {p.model}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{p.imei}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.serial}</td>
                      <td className="px-4 py-3">{p.phoneNumber || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColors[p.status]}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{p.assignedTo || "—"}</td>
                      <td className="px-4 py-3">{p.department || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.acquisitionDate}</td>
                      {user?.isAdmin && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              if (window.confirm(`¿Eliminar dispositivo ${p.id}: ${p.brand} ${p.model}?`)) {
                                setPhones((prev) => prev.filter((ph) => ph.id !== p.id));
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
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No se encontraron dispositivos</div>
            )}
          </div>
        </div>

        {/* Add Modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Agregar Dispositivo Móvil</h2>
                <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Marca *</label>
                    <input type="text" value={form.brand || ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="Samsung, iPhone, etc." />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Modelo *</label>
                    <input type="text" value={form.model || ""} onChange={(e) => setForm({ ...form, model: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="Galaxy A54, iPhone 15, etc." />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">IMEI *</label>
                  <input type="text" value={form.imei || ""} onChange={(e) => setForm({ ...form, imei: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="15 dígitos" maxLength={15} />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Serial *</label>
                  <input type="text" value={form.serial || ""} onChange={(e) => setForm({ ...form, serial: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Nro. Teléfono</label>
                    <input type="text" value={form.phoneNumber || ""} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Estado</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PhoneStatus })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      {(["Activo", "Disponible", "En Reparación", "Dado de Baja"] as PhoneStatus[]).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Asignado a</label>
                    <input type="text" value={form.assignedTo || ""} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Departamento</label>
                    <select value={form.department || ""} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      <option value="">Sin asignar</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Fecha de Adquisición</label>
                  <input type="date" value={form.acquisitionDate || ""} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
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

export default PhoneFleetPage;
