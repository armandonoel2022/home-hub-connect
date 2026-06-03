import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useEquipment } from "@/hooks/useApiHooks";
import type { Equipment, EquipmentStatus, EquipmentType, SoftwareEntry } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/types";
import {
  EQUIPMENT_STATUSES, equipmentStatusColors, generateAssignmentSheetPDF,
  generateEquipmentSheetPDF, parseSoftwareInventory, addDeviceRegistration, readFileAsDataUrl,
} from "@/lib/deviceAssignment";
import {
  Search, Plus, Monitor, Printer, Cpu, Wifi, Package, Laptop, Server,
  Tv, Projector, Phone, X, Trash2, Pencil, FileText, Upload, Paperclip,
  AppWindow, MonitorSmartphone,
} from "lucide-react";
import ExportMenu from "@/components/ExportMenu";
import { toast } from "sonner";

const EQUIPMENT_TYPES: EquipmentType[] = [
  "Computadora", "Laptop", "Workstation", "Monitor", "Impresora",
  "Pantalla / TV", "Proyector", "Teléfono IP", "Equipo de Red", "Otro",
];

const COMPUTER_TYPES: EquipmentType[] = ["Computadora", "Laptop", "Workstation"];

const typeIcons: Record<EquipmentType, typeof Monitor> = {
  Computadora: Cpu,
  Laptop: Laptop,
  Workstation: Server,
  Monitor: Monitor,
  Impresora: Printer,
  "Pantalla / TV": Tv,
  Proyector: Projector,
  "Teléfono IP": Phone,
  "Equipo de Red": Wifi,
  Otro: Package,
};

const ALLOWED_DEPARTMENTS = [
  "Tecnología y Monitoreo", "Administración", "Gerencia", "Gerencia General", "Gerencia Comercial",
];

const emptyForm: Partial<Equipment> = { type: "Laptop", status: "Disponible" };

const InventoryPage = () => {
  const { user, activeUsers } = useAuth();
  const { data: equipment, setData: setEquipment, create: createEquipment, update: updateEquipment, remove: removeEquipment } = useEquipment();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Equipment>>(emptyForm);
  const [detail, setDetail] = useState<Equipment | null>(null);
  const evidenceTarget = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const softwareTarget = useRef<string | null>(null);
  const softwareInput = useRef<HTMLInputElement>(null);
  const photoTarget = useRef<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const hasAccess = user?.isAdmin || ALLOWED_DEPARTMENTS.includes(user?.department || "");

  // Abrir directamente la ficha de un equipo vía ?device=<id>
  useEffect(() => {
    const id = searchParams.get("device");
    if (id && equipment.length) {
      const found = equipment.find((e) => e.id === id || e.fixedAssetCode === id);
      if (found) {
        setDetail(found);
        searchParams.delete("device");
        setSearchParams(searchParams, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipment]);

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

  const canManage = !!user?.isAdmin || user?.department === "Tecnología y Monitoreo";
  const isComputer = COMPUTER_TYPES.includes((form.type as EquipmentType) || "Otro");
  const monitors = equipment.filter((e) => e.type === "Monitor");
  const monitorLabel = (id?: string) => {
    if (!id) return undefined;
    const m = equipment.find((e) => e.id === id);
    return m ? `${m.fixedAssetCode || m.id} · ${m.brand} ${m.model}` : id;
  };

  const filtered = equipment.filter((e) => {
    const matchSearch =
      e.brand.toLowerCase().includes(search.toLowerCase()) ||
      e.model.toLowerCase().includes(search.toLowerCase()) ||
      e.serial.toLowerCase().includes(search.toLowerCase()) ||
      (e.fixedAssetCode || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.assignedTo || "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "Todos" || e.type === filterType;
    return matchSearch && matchType;
  });

  const typeCounts: Record<string, number> = { Todos: equipment.length };
  EQUIPMENT_TYPES.forEach((t) => { typeCounts[t] = equipment.filter((e) => e.type === t).length; });

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (e: Equipment) => { setEditingId(e.id); setForm({ ...e }); setShowForm(true); };

  const onPickEmployee = (name: string) => {
    const emp = activeUsers.find((u) => u.fullName === name);
    setForm((f) => ({
      ...f,
      assignedTo: name || null,
      assignedToCode: emp?.employeeCode,
      department: emp?.department || f.department || null,
      status: name ? (f.status === "Disponible" ? "Asignado" : f.status) : f.status,
    }));
  };

  const handleSave = async () => {
    if (!form.brand || !form.model || !form.serial) { toast.error("Marca, modelo y serie son obligatorios"); return; }
    if (!form.fixedAssetCode || !form.fixedAssetCode.trim()) { toast.error("El código de Activo Fijo es obligatorio"); return; }
    const assetCode = form.fixedAssetCode.trim();
    if (editingId) {
      const emp = form.assignedTo ? activeUsers.find((u) => u.fullName === form.assignedTo) : undefined;
      const updated = {
        ...form,
        fixedAssetCode: assetCode,
        assignedToCode: form.assignedToCode || emp?.employeeCode,
        assignedDate: form.assignedTo && !form.assignedDate ? new Date().toISOString().split("T")[0] : form.assignedDate,
      } as Partial<Equipment>;
      setEquipment((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...updated } as Equipment : e)));
      try { await updateEquipment(editingId, updated); } catch { /* local */ }
      toast.success("Equipo actualizado");
    } else {
      // Evitar duplicar el Activo Fijo
      if (equipment.some((e) => (e.fixedAssetCode || e.id) === assetCode)) {
        toast.error(`Ya existe un equipo con el Activo Fijo ${assetCode}`);
        return;
      }
      const id = assetCode;
      const isComp = COMPUTER_TYPES.includes((form.type as EquipmentType) || "Otro");
      const newItem: Equipment = {
        id,
        fixedAssetCode: assetCode,
        type: (form.type as EquipmentType) || "Otro",
        brand: form.brand || "",
        model: form.model || "",
        serial: form.serial || "",
        status: (form.status as EquipmentStatus) || "Disponible",
        assignedTo: form.assignedTo || null,
        assignedToCode: form.assignedToCode,
        department: form.department || null,
        acquisitionDate: form.acquisitionDate || new Date().toISOString().split("T")[0],
        assignedDate: form.assignedTo ? new Date().toISOString().split("T")[0] : undefined,
        color: form.color || "",
        storage: form.storage || "",
        ram: form.ram || "",
        notes: form.notes || "",
        operatingSystem: isComp ? form.operatingSystem || "" : undefined,
        osLanguage: isComp ? form.osLanguage || "" : undefined,
        bios: isComp ? form.bios || "" : undefined,
        processor: isComp ? form.processor || "" : undefined,
        hasMouse: isComp ? !!form.hasMouse : undefined,
        hasKeyboard: isComp ? !!form.hasKeyboard : undefined,
        hasMonitor: isComp ? !!form.hasMonitor : undefined,
        linkedMonitorId: isComp && form.hasMonitor ? form.linkedMonitorId : undefined,
        assignmentEvidence: [],
      };
      setEquipment([newItem, ...equipment]);
      try { await createEquipment(newItem); } catch { /* local */ }
      addDeviceRegistration({
        deviceId: id,
        source: "Inventario IT",
        deviceType: newItem.type,
        brand: newItem.brand,
        model: newItem.model,
        serial: newItem.serial,
        status: newItem.status,
        assignedTo: newItem.assignedTo,
        department: newItem.department,
        registeredBy: user?.fullName || "Tecnología",
      });
      toast.success("Equipo registrado · Notificado a Administración");
    }
    setShowForm(false);
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleGenerateSheet = async (e: Equipment) => {
    if (!e.assignedTo && !e.department) {
      toast.error("Asigna el equipo a un empleado o departamento primero");
      return;
    }
    const emp = e.assignedTo ? activeUsers.find((u) => u.fullName === e.assignedTo) : undefined;
    await generateAssignmentSheetPDF({
      deviceId: e.fixedAssetCode || e.id,
      source: "Inventario IT",
      deviceType: e.type,
      brand: e.brand, model: e.model, serial: e.serial,
      color: e.color, storage: e.storage, ram: e.ram,
      acquisitionDate: e.acquisitionDate,
      employeeName: e.assignedTo || undefined,
      employeeCode: e.assignedToCode || emp?.employeeCode,
      department: e.department || emp?.department,
      position: emp?.position,
      deliveredBy: user?.fullName,
    }, { open: true });
  };

  const handleEquipmentSheet = async (e: Equipment) => {
    await generateEquipmentSheetPDF(e, { open: true, linkedMonitorLabel: monitorLabel(e.linkedMonitorId) });
  };

  const triggerUpload = (id: string) => { evidenceTarget.current = id; fileInput.current?.click(); };
  const handleUpload = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    const id = evidenceTarget.current;
    if (!file || !id) return;
    const dataUrl = await readFileAsDataUrl(file);
    const evidence = { fileUrl: dataUrl, fileName: file.name, uploadedAt: new Date().toISOString(), uploadedBy: user?.fullName };
    setEquipment((prev) => prev.map((e) => e.id === id ? { ...e, assignmentEvidence: [...(e.assignmentEvidence || []), evidence] } : e));
    try { const target = equipment.find(e => e.id === id); await updateEquipment(id, { assignmentEvidence: [...(target?.assignmentEvidence || []), evidence] }); } catch { /* local */ }
    toast.success("Constancia firmada cargada");
    if (fileInput.current) fileInput.current.value = "";
  };

  const triggerSoftwareUpload = (id: string) => { softwareTarget.current = id; softwareInput.current?.click(); };
  const handleSoftwareUpload = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    const id = softwareTarget.current;
    if (!file || !id) return;
    const text = await file.text();
    const parsed = parseSoftwareInventory(text);
    if (!parsed.apps.length) { toast.error("No se detectó software en el archivo"); if (softwareInput.current) softwareInput.current.value = ""; return; }
    const patch = {
      softwareInventory: parsed.apps as SoftwareEntry[],
      softwareUpdatedAt: new Date().toISOString(),
      softwareSource: file.name,
    };
    setEquipment((prev) => prev.map((e) => e.id === id ? { ...e, ...patch } : e));
    setDetail((d) => (d && d.id === id ? { ...d, ...patch } : d));
    try { await updateEquipment(id, patch); } catch { /* local */ }
    toast.success(`Inventario de software cargado · ${parsed.apps.length} aplicaciones`);
    if (softwareInput.current) softwareInput.current.value = "";
  };

  return (
    <AppLayout>
      <input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} />
      <input ref={softwareInput} type="file" accept=".txt,.csv,.log" className="hidden" onChange={handleSoftwareUpload} />
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                  Inventario <span className="gold-accent-text">IT</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Laptops, workstations, monitores, impresoras, pantallas, proyectores y teléfonos IP · vinculados a Activo Fijo</p>
              </div>
              <div className="flex items-center gap-2">
                {canManage && (
                  <button onClick={openAdd} className="btn-gold flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Agregar Equipo
                  </button>
                )}
                <ExportMenu
                  title="Inventario IT SafeOne"
                  columns={[
                    { header: "Activo Fijo", key: "fixedAssetCode", width: 18 },
                    { header: "Tipo", key: "type", width: 14 },
                    { header: "Marca", key: "brand", width: 14 },
                    { header: "Modelo", key: "model", width: 14 },
                    { header: "Serial", key: "serial", width: 18 },
                    { header: "Procesador", key: "processor", width: 18 },
                    { header: "RAM", key: "ram", width: 10 },
                    { header: "Almacen.", key: "storage", width: 12 },
                    { header: "S.O.", key: "operatingSystem", width: 16 },
                    { header: "Software", key: "softwareCount", width: 10 },
                    { header: "Estado", key: "status", width: 14 },
                    { header: "Asignado a", key: "assignedTo", width: 20 },
                    { header: "Departamento", key: "department", width: 18 },
                  ]}
                  data={filtered.map((e) => ({
                    ...e,
                    fixedAssetCode: e.fixedAssetCode || e.id,
                    processor: e.processor || "—",
                    ram: e.ram || "—",
                    storage: e.storage || "—",
                    operatingSystem: e.operatingSystem || "—",
                    softwareCount: e.softwareInventory?.length || 0,
                    assignedTo: e.assignedTo || "—",
                    department: e.department || "—",
                  }))}
                  filename="inventario-it-safeone"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5 flex-wrap">
              {["Todos", ...EQUIPMENT_TYPES].map((label) => (
                <button
                  key={label}
                  onClick={() => setFilterType(label)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filterType === label ? "bg-gold text-charcoal-dark" : "bg-charcoal-light text-muted-foreground hover:text-secondary-foreground"
                  }`}
                >
                  {label} ({typeCounts[label] || 0})
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
              placeholder="Buscar por activo fijo, marca, modelo, serial o asignado..."
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
                    {["Activo Fijo", "Tipo", "Marca / Modelo", "Serial", "Especif.", "Software", "Estado", "Asignado a", "Depto.", "Constancia", ...(canManage ? [""] : [])].map((h, i) => (
                      <th key={`${h}-${i}`} className="text-left px-4 py-3 font-heading font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((eq) => {
                    const TypeIcon = typeIcons[eq.type] || Package;
                    return (
                      <tr key={eq.id} onClick={() => setDetail(eq)} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                        <td className="px-4 py-3 font-mono text-xs text-card-foreground font-semibold">{eq.fixedAssetCode || eq.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs">{eq.type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-card-foreground">{eq.brand} {eq.model}</td>
                        <td className="px-4 py-3 font-mono text-xs">{eq.serial}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{[eq.processor, eq.ram, eq.storage, eq.color].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="px-4 py-3 text-xs">
                          {(eq.softwareInventory?.length || 0) > 0 ? (
                            <span className="inline-flex items-center gap-1 text-blue-700"><AppWindow className="h-3.5 w-3.5" />{eq.softwareInventory!.length}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${equipmentStatusColors[eq.status] || "bg-gray-100 text-gray-500"}`}>{eq.status}</span>
                        </td>
                        <td className="px-4 py-3">{eq.assignedTo || "—"}</td>
                        <td className="px-4 py-3 text-xs">{eq.department || "—"}</td>
                        <td className="px-4 py-3">
                          {(eq.assignmentEvidence?.length || 0) > 0 ? (
                            <a onClick={(e) => e.stopPropagation()} href={eq.assignmentEvidence![eq.assignmentEvidence!.length - 1].fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-700">
                              <Paperclip className="h-3.5 w-3.5" /> {eq.assignmentEvidence!.length}
                            </a>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleGenerateSheet(eq)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold" title="Generar hoja de asignación"><FileText className="h-4 w-4" /></button>
                              <button onClick={() => triggerUpload(eq.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-emerald-600" title="Subir constancia firmada"><Upload className="h-4 w-4" /></button>
                              <button onClick={() => openEdit(eq)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-blue-600" title="Editar"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => { if (window.confirm(`¿Eliminar equipo ${eq.fixedAssetCode || eq.id}: ${eq.brand} ${eq.model}?`)) setEquipment((prev) => prev.filter((e) => e.id !== eq.id)); }} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">No se encontraron equipos</div>}
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">{editingId ? "Editar Equipo" : "Agregar Equipo"}</h2>
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Activo Fijo (ID) *</label>
                  <input type="text" value={form.fixedAssetCode || ""} onChange={(e) => setForm({ ...form, fixedAssetCode: e.target.value })} disabled={!!editingId} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm font-mono focus:ring-2 focus:ring-gold outline-none disabled:opacity-60" placeholder="SSC-LAP-29615" />
                  <p className="text-[11px] text-muted-foreground mt-1">Este código de Activo Fijo identifica el equipo en el inventario.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Tipo *</label>
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as EquipmentType })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      {EQUIPMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Estado</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EquipmentStatus })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      {EQUIPMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Marca *</label>
                    <input type="text" value={form.brand || ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="Dell, HP..." />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Modelo *</label>
                    <input type="text" value={form.model || ""} onChange={(e) => setForm({ ...form, model: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="Inspiron 15 3520..." />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Serial *</label>
                  <input type="text" value={form.serial || ""} onChange={(e) => setForm({ ...form, serial: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Color</label>
                    <input type="text" value={form.color || ""} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Almacen.</label>
                    <input type="text" value={form.storage || ""} onChange={(e) => setForm({ ...form, storage: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="512 GB SSD" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">RAM</label>
                    <input type="text" value={form.ram || ""} onChange={(e) => setForm({ ...form, ram: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="16 GB" />
                  </div>
                </div>

                {isComputer && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5" /> Especificaciones de equipo</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-card-foreground block mb-1.5">Procesador</label>
                        <input type="text" value={form.processor || ""} onChange={(e) => setForm({ ...form, processor: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="Intel Core i5-1235U" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-card-foreground block mb-1.5">Sistema Operativo</label>
                        <input type="text" value={form.operatingSystem || ""} onChange={(e) => setForm({ ...form, operatingSystem: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="Windows 11 Pro" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-card-foreground block mb-1.5">Idioma</label>
                        <input type="text" value={form.osLanguage || ""} onChange={(e) => setForm({ ...form, osLanguage: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="Español / Inglés" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-card-foreground block mb-1.5">BIOS</label>
                        <input type="text" value={form.bios || ""} onChange={(e) => setForm({ ...form, bios: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="Versión / fecha" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-card-foreground mb-2">Periféricos</p>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={!!form.hasMouse} onChange={(e) => setForm({ ...form, hasMouse: e.target.checked })} className="accent-gold h-4 w-4" /> Mouse
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={!!form.hasKeyboard} onChange={(e) => setForm({ ...form, hasKeyboard: e.target.checked })} className="accent-gold h-4 w-4" /> Teclado
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={!!form.hasMonitor} onChange={(e) => setForm({ ...form, hasMonitor: e.target.checked, linkedMonitorId: e.target.checked ? form.linkedMonitorId : undefined })} className="accent-gold h-4 w-4" /> Monitor
                        </label>
                      </div>
                    </div>
                    {form.hasMonitor && (
                      <div>
                        <label className="text-sm font-medium text-card-foreground block mb-1.5">Vincular con monitor del inventario</label>
                        <select value={form.linkedMonitorId || ""} onChange={(e) => setForm({ ...form, linkedMonitorId: e.target.value || undefined })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                          <option value="">Sin vincular</option>
                          {monitors.map((m) => <option key={m.id} value={m.id}>{m.fixedAssetCode || m.id} · {m.brand} {m.model}</option>)}
                        </select>
                        {monitors.length === 0 && <p className="text-[11px] text-muted-foreground mt-1">Registra primero el monitor como equipo tipo "Monitor" para poder vincularlo.</p>}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Asignado a (empleado)</label>
                    <select value={form.assignedTo || ""} onChange={(e) => onPickEmployee(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      <option value="">Sin asignar</option>
                      {activeUsers.map((u) => <option key={u.id} value={u.fullName}>{u.fullName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Departamento</label>
                    <select value={form.department || ""} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      <option value="">Sin asignar</option>
                      {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Fecha de Adquisición</label>
                    <input type="date" value={form.acquisitionDate || ""} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Notas</label>
                    <input type="text" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleSave} className="btn-gold text-sm">{editingId ? "Guardar" : "Agregar"}</button>
              </div>
            </div>
          </div>
        )}

        {detail && (() => {
          const DIcon = typeIcons[detail.type] || Package;
          const isComp = COMPUTER_TYPES.includes(detail.type);
          return (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
              <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-border">
                  <div className="flex items-center gap-2">
                    <DIcon className="h-5 w-5 text-gold" />
                    <div>
                      <h2 className="font-heading font-bold text-lg text-card-foreground">{detail.brand} {detail.model}</h2>
                      <p className="text-xs font-mono text-muted-foreground">{detail.fixedAssetCode || detail.id}</p>
                    </div>
                  </div>
                  <button onClick={() => setDetail(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${equipmentStatusColors[detail.status] || "bg-gray-100 text-gray-500"}`}>{detail.status}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
                    {[
                      ["Activo Fijo", detail.fixedAssetCode || detail.id],
                      ["Tipo", detail.type],
                      ["Serie", detail.serial || "—"],
                      ["Color", detail.color || "—"],
                      ["RAM", detail.ram || "—"],
                      ["Almacenamiento", detail.storage || "—"],
                      ...(isComp ? [
                        ["Procesador", detail.processor || "—"],
                        ["Sistema Operativo", detail.operatingSystem || "—"],
                        ["Idioma", detail.osLanguage || "—"],
                        ["BIOS", detail.bios || "—"],
                      ] as [string, string][] : []),
                      ["Fecha adquisición", detail.acquisitionDate || "—"],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
                        <p className="text-card-foreground font-medium break-words">{v}</p>
                      </div>
                    ))}
                  </div>

                  {isComp && (
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Periféricos</p>
                      <div className="flex flex-wrap gap-3 text-sm">
                        <span className={detail.hasMouse ? "text-emerald-700" : "text-muted-foreground"}>{detail.hasMouse ? "✓" : "✗"} Mouse</span>
                        <span className={detail.hasKeyboard ? "text-emerald-700" : "text-muted-foreground"}>{detail.hasKeyboard ? "✓" : "✗"} Teclado</span>
                        <span className={detail.hasMonitor ? "text-emerald-700" : "text-muted-foreground"}>{detail.hasMonitor ? "✓" : "✗"} Monitor</span>
                      </div>
                      {detail.hasMonitor && detail.linkedMonitorId && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5"><MonitorSmartphone className="h-3.5 w-3.5" /> Vinculado a: <span className="text-card-foreground font-medium">{monitorLabel(detail.linkedMonitorId)}</span></p>
                      )}
                    </div>
                  )}

                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Asignación</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                      <div><p className="text-[11px] text-muted-foreground">Asignado a</p><p className="text-card-foreground font-medium">{detail.assignedTo || "Sin asignar"}</p></div>
                      <div><p className="text-[11px] text-muted-foreground">Código empleado</p><p className="text-card-foreground font-medium">{detail.assignedToCode || "—"}</p></div>
                      <div><p className="text-[11px] text-muted-foreground">Departamento</p><p className="text-card-foreground font-medium">{detail.department || "—"}</p></div>
                    </div>
                  </div>

                  {/* Inventario de software */}
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><AppWindow className="h-3.5 w-3.5" /> Inventario de Software {(detail.softwareInventory?.length || 0) > 0 && `(${detail.softwareInventory!.length})`}</p>
                      {canManage && (
                        <button onClick={() => triggerSoftwareUpload(detail.id)} className="text-xs inline-flex items-center gap-1 text-blue-700 hover:underline"><Upload className="h-3.5 w-3.5" /> Cargar (.txt)</button>
                      )}
                    </div>
                    {(detail.softwareInventory?.length || 0) > 0 ? (
                      <>
                        <p className="text-[11px] text-muted-foreground mb-2">Actualizado {detail.softwareUpdatedAt ? new Date(detail.softwareUpdatedAt).toLocaleString("es-DO") : "—"}{detail.softwareSource ? ` · ${detail.softwareSource}` : ""}</p>
                        <div className="max-h-48 overflow-y-auto border border-border rounded-md divide-y">
                          {detail.softwareInventory!.map((s, i) => (
                            <div key={i} className="px-3 py-1.5 text-xs flex justify-between gap-3">
                              <span className="text-card-foreground truncate">{s.name}</span>
                              <span className="text-muted-foreground shrink-0">{s.version}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin inventario de software cargado.</p>
                    )}
                  </div>

                  {detail.notes && (
                    <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Notas</p><p className="text-sm text-card-foreground">{detail.notes}</p></div>
                  )}

                  {(detail.assignmentEvidence?.length || 0) > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Constancias firmadas</p>
                      <div className="space-y-1">
                        {detail.assignmentEvidence!.map((ev, i) => (
                          <a key={i} href={ev.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"><Paperclip className="h-3.5 w-3.5" /> {ev.fileName || `Constancia ${i + 1}`}</a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {canManage && (
                  <div className="p-5 border-t border-border flex gap-2 justify-end flex-wrap">
                    <button onClick={() => handleEquipmentSheet(detail)} className="px-4 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors flex items-center gap-2"><FileText className="h-4 w-4" /> Ficha del equipo</button>
                    <button onClick={() => handleGenerateSheet(detail)} className="px-4 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors flex items-center gap-2"><FileText className="h-4 w-4" /> Hoja de asignación</button>
                    <button onClick={() => { const d = detail; setDetail(null); openEdit(d); }} className="btn-gold text-sm flex items-center gap-2"><Pencil className="h-4 w-4" /> Editar</button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </AppLayout>
  );
};

export default InventoryPage;
