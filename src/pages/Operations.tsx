import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { mockArmedPersonnel } from "@/lib/mockData";
import type { ArmedPersonnel } from "@/lib/types";
import { Search, Plus, Shield, User, MapPin, X } from "lucide-react";

const statusColors: Record<string, string> = {
  Activo: "bg-emerald-50 text-emerald-700",
  Licencia: "bg-amber-50 text-amber-700",
  Inactivo: "bg-gray-100 text-gray-500",
};

const OperationsPage = () => {
  const [personnel, setPersonnel] = useState<ArmedPersonnel[]>(mockArmedPersonnel);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ArmedPersonnel | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<ArmedPersonnel>>({ status: "Activo" });

  const filtered = personnel.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase()) ||
      p.weaponSerial.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!form.name || !form.location || !form.weaponSerial) return;
    const newP: ArmedPersonnel = {
      id: `AP-${String(personnel.length + 1).padStart(3, "0")}`,
      name: form.name || "",
      photo: "",
      location: form.location || "",
      position: form.position || "Oficial de Seguridad",
      weaponType: form.weaponType || "",
      weaponSerial: form.weaponSerial || "",
      weaponBrand: form.weaponBrand || "",
      weaponCaliber: form.weaponCaliber || "",
      licenseNumber: form.licenseNumber || "",
      licenseExpiry: form.licenseExpiry || "",
      assignedDate: form.assignedDate || new Date().toISOString().split("T")[0],
      status: (form.status as ArmedPersonnel["status"]) || "Activo",
    };
    setPersonnel([newP, ...personnel]);
    setShowAdd(false);
    setForm({ status: "Activo" });
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
                  Personal <span className="gold-accent-text">Armado</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Registro de armas asignadas y ubicaciones</p>
              </div>
              <button onClick={() => setShowAdd(true)} className="btn-gold flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Registrar Personal
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre, ubicación o serial de arma..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
            />
          </div>
        </div>

        <div className="px-6 pb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <div key={p.id} onClick={() => setSelected(p)} className="card-department overflow-hidden cursor-pointer">
              <div className="h-1 w-full bg-secondary" />
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    {p.photo ? (
                      <img src={p.photo} alt={p.name} className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      <User className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-heading font-bold text-card-foreground truncate">{p.name}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusColors[p.status]}`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{p.position}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {p.location}
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Arma</span>
                    <span className="font-medium text-card-foreground">{p.weaponBrand} {p.weaponType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Calibre</span>
                    <span className="font-medium text-card-foreground">{p.weaponCaliber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Serial</span>
                    <span className="font-mono text-card-foreground">{p.weaponSerial}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Licencia</span>
                    <span className="font-mono text-card-foreground">{p.licenseNumber}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Modal */}
        {selected && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">{selected.name}</h2>
                <button onClick={() => setSelected(null)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Cargo", selected.position],
                    ["Ubicación", selected.location],
                    ["Estado", selected.status],
                    ["Tipo de Arma", selected.weaponType],
                    ["Marca", selected.weaponBrand],
                    ["Calibre", selected.weaponCaliber],
                    ["Serial Arma", selected.weaponSerial],
                    ["Nro. Licencia", selected.licenseNumber],
                    ["Venc. Licencia", selected.licenseExpiry],
                    ["Fecha Asignación", selected.assignedDate],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-muted rounded-lg p-3">
                      <span className="text-xs text-muted-foreground block">{label}</span>
                      <span className="font-medium text-card-foreground">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5 border-t border-border flex justify-end">
                <button onClick={() => setSelected(null)} className="btn-gold text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* Add Modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Registrar Personal Armado</h2>
                <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {[
                  { key: "name", label: "Nombre Completo *" },
                  { key: "position", label: "Cargo" },
                  { key: "location", label: "Ubicación *" },
                  { key: "weaponType", label: "Tipo de Arma" },
                  { key: "weaponBrand", label: "Marca del Arma" },
                  { key: "weaponCaliber", label: "Calibre" },
                  { key: "weaponSerial", label: "Serial del Arma *" },
                  { key: "licenseNumber", label: "Nro. de Licencia" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">{label}</label>
                    <input
                      type="text"
                      value={(form as any)[key] || ""}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Venc. Licencia</label>
                    <input type="date" value={form.licenseExpiry || ""} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Estado</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ArmedPersonnel["status"] })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      {["Activo", "Licencia", "Inactivo"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowAdd(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleAdd} className="btn-gold text-sm">Registrar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default OperationsPage;
