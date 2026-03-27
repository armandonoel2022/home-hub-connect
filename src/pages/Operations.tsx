import { useState, useRef, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useArmedPersonnel } from "@/hooks/useApiHooks";
import type { ArmedPersonnel } from "@/lib/types";
import { Search, Plus, User, MapPin, X, Phone, Upload, Image, Lock, Trash2, Pencil, Map, List, AlertTriangle } from "lucide-react";
import "leaflet/dist/leaflet.css";

const statusColors: Record<string, string> = {
  Activo: "bg-emerald-50 text-emerald-700",
  Licencia: "bg-amber-50 text-amber-700",
  Inactivo: "bg-gray-100 text-gray-500",
};

const conditionColors: Record<string, string> = {
  "En buenas condiciones": "bg-emerald-50 text-emerald-700",
  "En condiciones": "bg-emerald-50 text-emerald-700",
  "Falta de mantenimiento": "bg-amber-50 text-amber-700",
  "Arma inoperativa": "bg-red-50 text-red-700",
  "El seguro no sirve": "bg-red-50 text-red-700",
  "No esta en condiciones": "bg-red-50 text-red-700",
  "Arma en fiscalia": "bg-purple-50 text-purple-700",
  "Arma no estaba disponible": "bg-gray-100 text-gray-500",
};

const PROVINCES = [
  "Santiago", "Santo Domingo Oeste", "Santo Domingo Este", 
  "Distrito Nacional Este", "Distrito Nacional Oeste", "Distrito Nacional Norte",
  "San Pedro de Macoris Este", "Este",
];

const WEAPON_CONDITIONS = [
  "En buenas condiciones", "En condiciones", "Falta de mantenimiento",
  "Arma inoperativa", "El seguro no sirve", "No esta en condiciones",
  "Arma en fiscalia", "Arma no estaba disponible",
];

function parseCoords(coords: string): [number, number] | null {
  if (!coords || !coords.includes(",")) return null;
  const parts = coords.split(",").map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return [parts[0], parts[1]];
  return null;
}

// Lazy-loaded map component
function PersonnelMap({ personnel }: { personnel: ArmedPersonnel[] }) {
  const [mapReady, setMapReady] = useState(false);
  const [L, setL] = useState<any>(null);
  const [RL, setRL] = useState<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      import("leaflet"),
      import("react-leaflet"),
    ]).then(([leaflet, reactLeaflet]) => {
      // Fix default marker icons
      delete (leaflet.default.Icon.Default.prototype as any)._getIconUrl;
      leaflet.default.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });
      setL(leaflet.default);
      setRL(reactLeaflet);
      setMapReady(true);
    });
  }, []);

  const withCoords = personnel.filter(p => parseCoords(p.coordinates));

  if (!mapReady || !RL) return (
    <div className="h-[500px] flex items-center justify-center bg-muted rounded-xl">
      <p className="text-muted-foreground">Cargando mapa...</p>
    </div>
  );

  if (withCoords.length === 0) return (
    <div className="h-[500px] flex items-center justify-center bg-muted rounded-xl">
      <div className="text-center">
        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">No hay personal con coordenadas registradas</p>
      </div>
    </div>
  );

  const { MapContainer, TileLayer, Marker, Popup } = RL;
  const center = parseCoords(withCoords[0].coordinates) || [18.5, -69.9];

  return (
    <div className="h-[500px] rounded-xl overflow-hidden border border-border">
      <MapContainer center={center} zoom={9} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {withCoords.map(p => {
          const pos = parseCoords(p.coordinates)!;
          const condColor = p.weaponCondition?.includes("buenas") || p.weaponCondition === "En condiciones" ? "🟢" : p.weaponCondition?.includes("mantenimiento") ? "🟡" : "🔴";
          return (
            <Marker key={p.id} position={pos}>
              <Popup>
                <div className="text-xs min-w-[180px]">
                  <p className="font-bold text-sm">{condColor} {p.name || "Sin nombre"}</p>
                  <p><strong>Código:</strong> {p.employeeCode}</p>
                  <p><strong>Cliente:</strong> {p.client}</p>
                  <p><strong>Puesto:</strong> {p.location}</p>
                  <p><strong>Provincia:</strong> {p.province}</p>
                  <p><strong>Arma:</strong> {p.weaponType} {p.weaponBrand}</p>
                  <p><strong>Serial:</strong> {p.weaponSerial}</p>
                  <p><strong>Estado Arma:</strong> {p.weaponCondition}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

const OperationsPage = () => {
  const { user } = useAuth();
  const { data: personnel, setData: setPersonnel, create: createPersonnel, update: updatePersonnel, remove: removePersonnel } = useArmedPersonnel();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ArmedPersonnel | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<ArmedPersonnel>>({ status: "Activo" });
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [filterProvince, setFilterProvince] = useState("");
  const [filterCondition, setFilterCondition] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canView = user?.isAdmin || user?.department === "Operaciones";

  if (!canView) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-heading font-bold text-lg text-card-foreground">Acceso Restringido</h2>
            <p className="text-sm text-muted-foreground mt-1">Este módulo es exclusivo del departamento de Operaciones</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const filtered = personnel.filter((p) => {
    const matchSearch =
      (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.client || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.location || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.weaponSerial || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.employeeCode || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.province || "").toLowerCase().includes(search.toLowerCase());
    const matchProvince = !filterProvince || p.province === filterProvince;
    const matchCondition = !filterCondition || p.weaponCondition === filterCondition;
    return matchSearch && matchProvince && matchCondition;
  });

  // Stats
  const totalCount = personnel.length;
  const withCoords = personnel.filter(p => parseCoords(p.coordinates)).length;
  const needsMaintenance = personnel.filter(p => p.weaponCondition === "Falta de mantenimiento").length;
  const inGoodCondition = personnel.filter(p => p.weaponCondition?.includes("buenas") || p.weaponCondition === "En condiciones").length;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      alert("Solo se permiten archivos JPG o PNG");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setPhotoPreview(url);
      setForm({ ...form, photo: url });
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = async () => {
    if (!form.name && !form.client) return;
    const newP: Omit<ArmedPersonnel, "id"> & { id?: string } = {
      id: `AP-${String(personnel.length + 1).padStart(3, "0")}`,
      employeeCode: form.employeeCode || "",
      name: form.name || "",
      photo: form.photo || "",
      client: form.client || "",
      location: form.location || "",
      province: form.province || "",
      position: form.position || "Oficial de Seguridad",
      supervisor: form.supervisor || "",
      fleetPhone: form.fleetPhone || "",
      personalPhone: form.personalPhone || "",
      address: form.address || "",
      weaponType: form.weaponType || "",
      weaponSerial: form.weaponSerial || "",
      weaponBrand: form.weaponBrand || "",
      weaponCaliber: form.weaponCaliber || "",
      ammunitionCount: Number(form.ammunitionCount) || 0,
      coordinates: form.coordinates || "",
      weaponCondition: form.weaponCondition || "",
      licenseNumber: form.licenseNumber || "",
      licenseExpiry: form.licenseExpiry || "",
      assignedDate: form.assignedDate || new Date().toISOString().split("T")[0],
      status: (form.status as ArmedPersonnel["status"]) || "Activo",
    };
    try {
      await createPersonnel(newP as any);
    } catch {
      // Fallback: add locally
      setPersonnel((prev) => [{ ...newP, id: newP.id || `AP-${Date.now()}` } as ArmedPersonnel, ...prev]);
    }
    setShowAdd(false);
    setEditingId(null);
    setForm({ status: "Activo" });
    setPhotoPreview("");
  };

  const handleStartEdit = (p: ArmedPersonnel) => {
    setForm({ ...p });
    setPhotoPreview(p.photo || "");
    setEditingId(p.id);
    setShowAdd(true);
    setSelected(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const updateData: Partial<ArmedPersonnel> = {
      employeeCode: form.employeeCode || "",
      name: form.name || "",
      photo: form.photo || "",
      client: form.client || "",
      location: form.location || "",
      province: form.province || "",
      position: form.position || "",
      supervisor: form.supervisor || "",
      fleetPhone: form.fleetPhone || "",
      personalPhone: form.personalPhone || "",
      address: form.address || "",
      weaponType: form.weaponType || "",
      weaponSerial: form.weaponSerial || "",
      weaponBrand: form.weaponBrand || "",
      weaponCaliber: form.weaponCaliber || "",
      ammunitionCount: Number(form.ammunitionCount) || 0,
      coordinates: form.coordinates || "",
      weaponCondition: form.weaponCondition || "",
      licenseNumber: form.licenseNumber || "",
      licenseExpiry: form.licenseExpiry || "",
      status: (form.status as ArmedPersonnel["status"]) || "Activo",
    };
    try {
      await updatePersonnel(editingId, updateData);
    } catch {
      setPersonnel((prev) => prev.map(p => p.id === editingId ? { ...p, ...updateData } : p));
    }
    setShowAdd(false);
    setEditingId(null);
    setForm({ status: "Activo" });
    setPhotoPreview("");
  };

  const handleDelete = async (p: ArmedPersonnel) => {
    if (!window.confirm(`¿Eliminar registro de ${p.name || p.employeeCode}?`)) return;
    try {
      await removePersonnel(p.id);
    } catch {
      setPersonnel((prev) => prev.filter(per => per.id !== p.id));
    }
  };

  const formFields = [
    { key: "employeeCode", label: "Código de Empleado *" },
    { key: "name", label: "Nombre del Vigilante" },
    { key: "client", label: "Cliente *" },
    { key: "location", label: "Puesto / Ubicación *" },
    { key: "supervisor", label: "Supervisor" },
    { key: "fleetPhone", label: "Celular de Empresa (Flota)" },
    { key: "personalPhone", label: "Celular Personal" },
    { key: "address", label: "Dirección" },
    { key: "weaponType", label: "Tipo de Arma" },
    { key: "weaponBrand", label: "Marca del Arma" },
    { key: "weaponSerial", label: "Serial del Arma" },
    { key: "ammunitionCount", label: "Cantidad de Cápsulas" },
    { key: "coordinates", label: "Coordenadas (lat, lng)" },
    { key: "licenseNumber", label: "Nro. de Licencia" },
  ];

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
                <p className="text-muted-foreground text-sm mt-1">Registro de armas, ubicaciones y vigilantes — {totalCount} registros</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode(viewMode === "list" ? "map" : "list")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted text-sm font-medium text-card-foreground hover:bg-border transition-colors"
                >
                  {viewMode === "list" ? <Map className="h-4 w-4" /> : <List className="h-4 w-4" />}
                  {viewMode === "list" ? "Ver Mapa" : "Ver Lista"}
                </button>
                <button onClick={() => { setForm({ status: "Activo" }); setEditingId(null); setPhotoPreview(""); setShowAdd(true); }} className="btn-gold flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Registrar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700">{inGoodCondition}</p>
            <p className="text-xs text-emerald-600">Buen Estado</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-700">{needsMaintenance}</p>
            <p className="text-xs text-amber-600">Mantenimiento</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{withCoords}</p>
            <p className="text-xs text-blue-600">Con Ubicación</p>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-2 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre, cliente, puesto, código, serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
            />
          </div>
          <select value={filterProvince} onChange={e => setFilterProvince(e.target.value)} className="px-3 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm">
            <option value="">Todas las Provincias</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterCondition} onChange={e => setFilterCondition(e.target.value)} className="px-3 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm">
            <option value="">Todas las Condiciones</option>
            {WEAPON_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* MAP VIEW */}
        {viewMode === "map" && (
          <div className="px-6 py-4">
            <PersonnelMap personnel={filtered} />
          </div>
        )}

        {/* LIST VIEW */}
        {viewMode === "list" && (
          <div className="px-6 pb-8 pt-2">
            <div className="overflow-x-auto bg-card rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-left">
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Código</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Vigilante</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Cliente</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Puesto</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Provincia</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Arma</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Serial</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Tipo</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Cáps.</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Estado Arma</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Ubic.</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => {
                    const hasCoords = !!parseCoords(p.coordinates);
                    return (
                      <tr key={p.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelected(p)}>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.employeeCode || "—"}</td>
                        <td className="px-3 py-2 font-medium text-card-foreground">{p.name || <span className="text-muted-foreground italic">Sin nombre</span>}</td>
                        <td className="px-3 py-2 text-card-foreground">{p.client}</td>
                        <td className="px-3 py-2 text-card-foreground">{p.location}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{p.province}</td>
                        <td className="px-3 py-2 text-card-foreground">{p.weaponType} {p.weaponBrand && p.weaponBrand !== "No visible" ? p.weaponBrand : ""}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.weaponSerial || "—"}</td>
                        <td className="px-3 py-2">
                          {p.weaponCaliber && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${p.weaponCaliber === "Letal" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                              {p.weaponCaliber}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">{p.ammunitionCount || "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${conditionColors[p.weaponCondition] || "bg-gray-100 text-gray-500"}`}>
                            {p.weaponCondition || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {hasCoords ? (
                            <a
                              href={`https://www.google.com/maps?q=${p.coordinates}`}
                              target="_blank"
                              rel="noopener"
                              onClick={e => e.stopPropagation()}
                              className="text-blue-600 hover:text-blue-800"
                              title="Ver en Google Maps"
                            >
                              <MapPin className="h-4 w-4" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {user?.isAdmin && (
                            <div className="flex gap-1">
                              <button onClick={(e) => { e.stopPropagation(); handleStartEdit(p); }} className="p-1 rounded hover:bg-blue-50 text-muted-foreground hover:text-blue-600" title="Editar">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(p); }} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600" title="Eliminar">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No se encontraron registros</div>
              )}
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {selected && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="font-heading font-bold text-lg text-card-foreground">{selected.name || "Sin nombre"}</h2>
                  <p className="text-xs text-muted-foreground font-mono">{selected.employeeCode}</p>
                </div>
                <button onClick={() => setSelected(null)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              {selected.photo && (
                <div className="px-5 pt-5 flex justify-center">
                  <img src={selected.photo} alt={selected.name} className="w-28 h-28 rounded-xl object-cover border-2 border-border" />
                </div>
              )}
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Código Empleado", selected.employeeCode || "—"],
                    ["Cliente", selected.client || "—"],
                    ["Puesto", selected.location],
                    ["Provincia", selected.province || "—"],
                    ["Cargo", selected.position],
                    ["Supervisor", selected.supervisor || "—"],
                    ["Estado", selected.status],
                    ["Cel. Empresa", selected.fleetPhone || "—"],
                    ["Cel. Personal", selected.personalPhone || "—"],
                    ["Dirección", selected.address || "—"],
                    ["Tipo de Arma", selected.weaponType || "—"],
                    ["Marca", selected.weaponBrand || "—"],
                    ["Tipo Munición", selected.weaponCaliber || "—"],
                    ["Cápsulas", String(selected.ammunitionCount)],
                    ["Serial Arma", selected.weaponSerial || "—"],
                    ["Estado del Arma", selected.weaponCondition || "—"],
                    ["Nro. Licencia", selected.licenseNumber || "—"],
                    ["Venc. Licencia", selected.licenseExpiry || "—"],
                    ["Coordenadas", selected.coordinates || "—"],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-muted rounded-lg p-3">
                      <span className="text-xs text-muted-foreground block">{label}</span>
                      <span className="font-medium text-card-foreground">{val}</span>
                    </div>
                  ))}
                </div>
                {/* Mini map in detail */}
                {parseCoords(selected.coordinates) && (
                  <div className="mt-4">
                    <a
                      href={`https://www.google.com/maps?q=${selected.coordinates}`}
                      target="_blank"
                      rel="noopener"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors w-full justify-center"
                    >
                      <MapPin className="h-4 w-4" />
                      Ver ubicación en Google Maps
                    </a>
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-border flex justify-end gap-2">
                {user?.isAdmin && (
                  <button onClick={() => handleStartEdit(selected)} className="px-4 py-2 rounded-lg text-sm font-medium bg-muted text-card-foreground hover:bg-border transition-colors flex items-center gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                )}
                <button onClick={() => setSelected(null)} className="btn-gold text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">{editingId ? "Editar Personal Armado" : "Registrar Personal Armado"}</h2>
                <button onClick={() => { setShowAdd(false); setEditingId(null); setPhotoPreview(""); setForm({ status: "Activo" }); }} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* Photo upload */}
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Foto</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Image className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png" onChange={handlePhotoUpload} className="hidden" />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-sm font-medium text-card-foreground hover:bg-border transition-colors">
                        <Upload className="h-4 w-4" />
                        Subir foto
                      </button>
                    </div>
                  </div>
                </div>

                {formFields.map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">{label}</label>
                    <input
                      type="text"
                      value={(form as any)[key] || ""}
                      onChange={(e) => setForm({ ...form, [key]: key === "ammunitionCount" ? Number(e.target.value) || 0 : e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                      placeholder={key === "coordinates" ? "ej: 18.49, -69.99" : ""}
                    />
                  </div>
                ))}

                {/* Province select */}
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Provincia *</label>
                  <select value={form.province || ""} onChange={e => setForm({ ...form, province: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="">Seleccionar...</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* Weapon caliber (Letal/No letal) */}
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Tipo de Munición</label>
                  <select value={form.weaponCaliber || ""} onChange={e => setForm({ ...form, weaponCaliber: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="">Seleccionar...</option>
                    <option value="Letal">Letal</option>
                    <option value="No letal">No letal</option>
                  </select>
                </div>

                {/* Weapon condition */}
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Estado del Arma</label>
                  <select value={form.weaponCondition || ""} onChange={e => setForm({ ...form, weaponCondition: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="">Seleccionar...</option>
                    {WEAPON_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Venc. Licencia</label>
                    <input type="date" value={form.licenseExpiry || ""} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Estado Vigilante</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ArmedPersonnel["status"] })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      {["Activo", "Licencia", "Inactivo"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => { setShowAdd(false); setEditingId(null); setPhotoPreview(""); setForm({ status: "Activo" }); }} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={editingId ? handleSaveEdit : handleAdd} className="btn-gold text-sm">{editingId ? "Guardar Cambios" : "Registrar"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default OperationsPage;
