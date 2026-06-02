import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePhones } from "@/hooks/useApiHooks";
import type { PhoneDevice, PhoneStatus, MobileDeviceType } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/types";
import {
  PHONE_STATUSES, phoneStatusColors, generateAssignmentSheetPDF,
  addDeviceRegistration, readFileAsDataUrl,
} from "@/lib/deviceAssignment";
import { Search, Plus, Smartphone, Tablet, X, Trash2, Pencil, FileText, Upload, Paperclip } from "lucide-react";
import { toast } from "sonner";

const ALLOWED_DEPARTMENTS = [
  "Tecnología y Monitoreo", "Administración", "Gerencia", "Gerencia General", "Gerencia Comercial",
];

const emptyForm: Partial<PhoneDevice> = { status: "En Stock", deviceType: "Celular" };

const PhoneFleetPage = () => {
  const { user, activeUsers } = useAuth();
  const { data: phones, setData: setPhones, create: createPhone, update: updatePhone } = usePhones();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PhoneDevice>>(emptyForm);
  const [detail, setDetail] = useState<PhoneDevice | null>(null);
  const evidenceTarget = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const id = searchParams.get("device");
    if (id && phones.length) {
      const found = phones.find((p) => p.id === id);
      if (found) {
        setDetail(found);
        searchParams.delete("device");
        setSearchParams(searchParams, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phones]);

  const hasAccess = user?.isAdmin || ALLOWED_DEPARTMENTS.includes(user?.department || "");
  if (!hasAccess) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Smartphone className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-heading font-bold text-card-foreground mb-2">Acceso Restringido</h2>
            <p className="text-muted-foreground">Solo los departamentos de IT, Administración y Gerencia pueden acceder a la flota celular.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const canManage = !!user?.isAdmin || user?.department === "Tecnología y Monitoreo";

  const userPhones = canManage ? phones : phones.filter((p) => p.assignedTo === user?.fullName);

  const filtered = userPhones.filter(
    (p) =>
      p.imei.toLowerCase().includes(search.toLowerCase()) ||
      p.serial.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase()) ||
      p.model.toLowerCase().includes(search.toLowerCase()) ||
      (p.assignedTo || "").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (p: PhoneDevice) => { setEditingId(p.id); setForm({ ...p }); setShowForm(true); };

  const onPickEmployee = (name: string) => {
    const emp = activeUsers.find((u) => u.fullName === name);
    setForm((f) => ({
      ...f,
      assignedTo: name || null,
      assignedToCode: emp?.employeeCode,
      department: emp?.department || f.department || null,
      status: name ? (f.status === "En Stock" ? "Asignado" : f.status) : f.status,
    }));
  };

  const handleSave = async () => {
    if (!form.brand || !form.model || !form.serial) {
      toast.error("Marca, modelo y serie son obligatorios");
      return;
    }
    if (editingId) {
      const updated = { ...form, assignedDate: form.assignedTo && !form.assignedDate ? new Date().toISOString().split("T")[0] : form.assignedDate } as Partial<PhoneDevice>;
      setPhones((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...updated } as PhoneDevice : p)));
      try { await updatePhone(editingId, updated); } catch { /* local mode */ }
      toast.success("Dispositivo actualizado");
    } else {
      const id = `PH-${String(Date.now()).slice(-6)}`;
      const newP: PhoneDevice = {
        id,
        deviceType: (form.deviceType as MobileDeviceType) || "Celular",
        imei: form.imei || "",
        serial: form.serial || "",
        brand: form.brand || "",
        model: form.model || "",
        status: (form.status as PhoneStatus) || "En Stock",
        assignedTo: form.assignedTo || null,
        assignedToCode: form.assignedToCode,
        department: form.department || null,
        acquisitionDate: form.acquisitionDate || new Date().toISOString().split("T")[0],
        assignedDate: form.assignedTo ? new Date().toISOString().split("T")[0] : undefined,
        phoneNumber: form.phoneNumber || "",
        color: form.color || "",
        storage: form.storage || "",
        ram: form.ram || "",
        notes: form.notes || "",
        assignmentEvidence: [],
      };
      setPhones((prev) => [newP, ...prev]);
      try { await createPhone(newP); } catch { /* local mode */ }
      // Disparar overlay/registro para Chrisnel
      addDeviceRegistration({
        deviceId: id,
        source: "Flota Celular",
        deviceType: newP.deviceType || "Celular",
        brand: newP.brand,
        model: newP.model,
        serial: newP.serial,
        imei: newP.imei,
        status: newP.status,
        assignedTo: newP.assignedTo,
        department: newP.department,
        registeredBy: user?.fullName || "Tecnología",
      });
      toast.success("Dispositivo registrado · Notificado a Administración");
    }
    setShowForm(false);
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleGenerateSheet = async (p: PhoneDevice) => {
    if (!p.assignedTo && !p.department) {
      toast.error("Asigna el dispositivo a un empleado o departamento primero");
      return;
    }
    const emp = p.assignedTo ? activeUsers.find((u) => u.fullName === p.assignedTo) : undefined;
    await generateAssignmentSheetPDF({
      deviceId: p.id,
      source: "Flota Celular",
      deviceType: p.deviceType || "Celular",
      brand: p.brand, model: p.model, serial: p.serial, imei: p.imei,
      color: p.color, storage: p.storage, ram: p.ram, phoneNumber: p.phoneNumber,
      acquisitionDate: p.acquisitionDate,
      employeeName: p.assignedTo || undefined,
      employeeCode: p.assignedToCode || emp?.employeeCode,
      department: p.department || emp?.department,
      position: emp?.position,
      deliveredBy: user?.fullName,
    }, { open: true });
  };

  const triggerUpload = (id: string) => { evidenceTarget.current = id; fileInput.current?.click(); };
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = evidenceTarget.current;
    if (!file || !id) return;
    const dataUrl = await readFileAsDataUrl(file);
    const evidence = { fileUrl: dataUrl, fileName: file.name, uploadedAt: new Date().toISOString(), uploadedBy: user?.fullName };
    setPhones((prev) => prev.map((p) => p.id === id ? { ...p, assignmentEvidence: [...(p.assignmentEvidence || []), evidence] } : p));
    try { const target = phones.find(p => p.id === id); await updatePhone(id, { assignmentEvidence: [...(target?.assignmentEvidence || []), evidence] }); } catch { /* local */ }
    toast.success("Constancia firmada cargada");
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleDelete = (p: PhoneDevice) => {
    if (window.confirm(`¿Eliminar dispositivo ${p.id}: ${p.brand} ${p.model}?`)) {
      setPhones((prev) => prev.filter((ph) => ph.id !== p.id));
    }
  };

  return (
    <AppLayout>
      <input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} />
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                  Flota <span className="gold-accent-text">Celular</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Celulares y tablets corporativos · Procedimiento PRO-IT-05</p>
              </div>
              {canManage && (
                <button onClick={openAdd} className="btn-gold flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Agregar Dispositivo
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
                    {["Tipo", "Marca / Modelo", "IMEI / Serie", "Especif.", "Línea", "Estado", "Asignado a", "Depto.", "Constancia", ...(canManage ? [""] : [])].map((h, i) => (
                      <th key={`${h}-${i}`} className="text-left px-4 py-3 font-heading font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} onClick={() => setDetail(p)} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {p.deviceType === "Tablet" ? <Tablet className="h-4 w-4 text-muted-foreground" /> : <Smartphone className="h-4 w-4 text-muted-foreground" />}
                          <span className="text-xs">{p.deviceType || "Celular"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="font-medium text-card-foreground">{p.brand} {p.model}</span></td>
                      <td className="px-4 py-3 font-mono text-[11px]">
                        <div>{p.imei || "—"}</div>
                        <div className="text-muted-foreground">{p.serial}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {[p.color, p.storage, p.ram].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-3">{p.phoneNumber || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${phoneStatusColors[p.status] || "bg-gray-100 text-gray-500"}`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3">{p.assignedTo || "—"}</td>
                      <td className="px-4 py-3 text-xs">{p.department || "—"}</td>
                      <td className="px-4 py-3">
                        {(p.assignmentEvidence?.length || 0) > 0 ? (
                          <a href={p.assignmentEvidence![p.assignmentEvidence!.length - 1].fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-700">
                            <Paperclip className="h-3.5 w-3.5" /> {p.assignmentEvidence!.length}
                          </a>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">

                            <button onClick={() => handleGenerateSheet(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold" title="Generar hoja de asignación"><FileText className="h-4 w-4" /></button>
                            <button onClick={() => triggerUpload(p.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-emerald-600" title="Subir constancia firmada"><Upload className="h-4 w-4" /></button>
                            <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-blue-600" title="Editar"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
                          </div>
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

        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">{editingId ? "Editar Dispositivo" : "Agregar Dispositivo Móvil"}</h2>
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Tipo *</label>
                    <select value={form.deviceType || "Celular"} onChange={(e) => setForm({ ...form, deviceType: e.target.value as MobileDeviceType })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      <option value="Celular">Celular</option>
                      <option value="Tablet">Tablet</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Estado</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PhoneStatus })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      {PHONE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Marca *</label>
                    <input type="text" value={form.brand || ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="Samsung, Apple..." />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Modelo *</label>
                    <input type="text" value={form.model || ""} onChange={(e) => setForm({ ...form, model: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="Galaxy A54..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">IMEI</label>
                    <input type="text" value={form.imei || ""} onChange={(e) => setForm({ ...form, imei: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" maxLength={20} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Serie *</label>
                    <input type="text" value={form.serial || ""} onChange={(e) => setForm({ ...form, serial: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Color</label>
                    <input type="text" value={form.color || ""} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Almacen.</label>
                    <input type="text" value={form.storage || ""} onChange={(e) => setForm({ ...form, storage: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="128 GB" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">RAM</label>
                    <input type="text" value={form.ram || ""} onChange={(e) => setForm({ ...form, ram: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="6 GB" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Nro. Teléfono</label>
                    <input type="text" value={form.phoneNumber || ""} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Fecha de Adquisición</label>
                    <input type="date" value={form.acquisitionDate || ""} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Asignado a (empleado)</label>
                    <select value={form.assignedTo || ""} onChange={(e) => onPickEmployee(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      <option value="">Sin asignar (In Stock)</option>
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
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Notas</label>
                  <input type="text" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleSave} className="btn-gold text-sm">{editingId ? "Guardar" : "Agregar"}</button>
              </div>
            </div>
          </div>
        )}

        {detail && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-2">
                  {detail.deviceType === "Tablet" ? <Tablet className="h-5 w-5 text-gold" /> : <Smartphone className="h-5 w-5 text-gold" />}
                  <h2 className="font-heading font-bold text-lg text-card-foreground">{detail.brand} {detail.model}</h2>
                </div>
                <button onClick={() => setDetail(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${phoneStatusColors[detail.status] || "bg-gray-100 text-gray-500"}`}>{detail.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {[
                    ["ID inventario", detail.id],
                    ["Tipo", detail.deviceType || "Celular"],
                    ["Marca", detail.brand || "—"],
                    ["Modelo", detail.model || "—"],
                    ["IMEI", detail.imei || "—"],
                    ["Serie", detail.serial || "—"],
                    ["Color", detail.color || "—"],
                    ["Almacenamiento", detail.storage || "—"],
                    ["RAM", detail.ram || "—"],
                    ["Línea telefónica", detail.phoneNumber || "—"],
                    ["Fecha de adquisición", detail.acquisitionDate || "—"],
                    ["Fecha de asignación", detail.assignedDate || "—"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
                      <p className="text-card-foreground font-medium">{v}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Asignación</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Asignado a</p>
                      <p className="text-card-foreground font-medium">{detail.assignedTo || "Sin asignar"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Código empleado</p>
                      <p className="text-card-foreground font-medium">{detail.assignedToCode || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Departamento</p>
                      <p className="text-card-foreground font-medium">{detail.department || "—"}</p>
                    </div>
                  </div>
                </div>

                {detail.notes && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Notas</p>
                    <p className="text-sm text-card-foreground">{detail.notes}</p>
                  </div>
                )}

                {(detail.assignmentEvidence?.length || 0) > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Constancias firmadas</p>
                    <div className="space-y-1">
                      {detail.assignmentEvidence!.map((ev, i) => (
                        <a key={i} href={ev.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline">
                          <Paperclip className="h-3.5 w-3.5" /> {ev.fileName || `Constancia ${i + 1}`}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {canManage && (
                <div className="p-5 border-t border-border flex gap-3 justify-end flex-wrap">
                  <button onClick={() => handleGenerateSheet(detail)} className="px-4 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors flex items-center gap-2"><FileText className="h-4 w-4" /> Generar hoja</button>
                  <button onClick={() => { const d = detail; setDetail(null); openEdit(d); }} className="btn-gold text-sm flex items-center gap-2"><Pencil className="h-4 w-4" /> Editar</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </AppLayout>
  );
};

export default PhoneFleetPage;
