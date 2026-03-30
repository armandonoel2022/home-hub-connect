import { useState, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { DEPARTMENTS } from "@/lib/types";
import type { IntranetUser } from "@/lib/types";
import { Plus, X, Search, Pencil, Trash2, User, Shield, Mail, Building2, Phone, Upload, Image, KeyRound } from "lucide-react";
import { Navigate } from "react-router-dom";
import RegistrationRequests from "@/components/RegistrationRequests";
import ExportMenu from "@/components/ExportMenu";

const emptyForm = (): Partial<IntranetUser> => ({
  fullName: "",
  email: "",
  department: DEPARTMENTS[0],
  position: "",
  birthday: "",
  photoUrl: "",
  allowedDepartments: [],
  isAdmin: false,
  isDepartmentLeader: false,
  reportsTo: "",
  fleetPhone: "",
  extension: "",
  shift: "",
  team: "",
  workDaysPerWeek: 5,
  hireDate: "",
});

const UserManagementPage = () => {
  const { user, allUsers, activeUsers, inactiveUsers, addUser, updateUser, deleteUser, resetUserPassword } = useAuth();
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IntranetUser | null>(null);
  const [form, setForm] = useState<Partial<IntranetUser>>(emptyForm());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File, maxSize = 300): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      const reader = new FileReader();
      reader.onload = (ev) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d")!;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.92));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      alert("Solo se permiten archivos JPG o PNG");
      return;
    }
    try {
      const compressed = await compressImage(file);
      setPhotoPreview(compressed);
      setForm({ ...form, photoUrl: compressed });
    } catch {
      alert("Error al procesar la imagen");
    }
  };

  // Only admins can access
  if (!user?.isAdmin) return <Navigate to="/" replace />;

  const filtered = allUsers.filter(
    (u) =>
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.department.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setPhotoPreview("");
    setShowForm(true);
  };

  const openEdit = (u: IntranetUser) => {
    setEditing(u);
    setForm({ ...u });
    setPhotoPreview(u.photoUrl || "");
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.fullName || !form.email) return;
    if (editing) {
      updateUser(editing.id, form);
    } else {
      const newUser: IntranetUser = {
        id: `USR-${String(Date.now()).slice(-6)}`,
        fullName: form.fullName || "",
        email: form.email || "",
        department: form.department || DEPARTMENTS[0],
        position: form.position || "",
        birthday: form.birthday || "",
        photoUrl: form.photoUrl || "",
        allowedDepartments: form.allowedDepartments || [form.department || DEPARTMENTS[0]],
        isAdmin: form.isAdmin || false,
        isDepartmentLeader: form.isDepartmentLeader || false,
        reportsTo: form.reportsTo || "",
        fleetPhone: form.fleetPhone || "",
      };
      addUser(newUser);
    }
    setShowForm(false);
    setForm(emptyForm());
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    deleteUser(id);
    setShowDeleteConfirm(null);
  };

  const toggleDeptAccess = (dept: string) => {
    const current = form.allowedDepartments || [];
    if (current.includes(dept)) {
      setForm({ ...form, allowedDepartments: current.filter((d) => d !== dept) });
    } else {
      setForm({ ...form, allowedDepartments: [...current, dept] });
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Shield className="h-7 w-7 text-gold" />
                <div>
                  <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                    Administración de <span className="gold-accent-text">Usuarios</span>
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">Registrar, modificar y eliminar usuarios de la intranet</p>
                </div>
              </div>
              <button onClick={openAdd} className="btn-gold flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Usuario
              </button>
              <ExportMenu
                title="Usuarios SafeOne"
                columns={[
                  { header: "Nombre", key: "fullName", width: 22 },
                  { header: "Ext.", key: "extension", width: 8 },
                  { header: "Correo", key: "email", width: 28 },
                  { header: "Departamento", key: "department", width: 22 },
                  { header: "Cargo", key: "position", width: 22 },
                  { header: "Rol", key: "role", width: 12 },
                ]}
                data={allUsers.map((u) => ({ ...u, role: u.isAdmin ? "Admin" : u.isDepartmentLeader ? "Líder" : "Usuario" }))}
                filename="usuarios-safeone"
              />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre, correo o departamento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 pb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total Activos", value: activeUsers.length },
            { label: "Administradores", value: activeUsers.filter((u) => u.isAdmin).length },
            { label: "Usuarios Regulares", value: activeUsers.filter((u) => !u.isAdmin).length },
            { label: "Ex-Empleados", value: inactiveUsers.length },
            { label: "Departamentos", value: new Set(activeUsers.map((u) => u.department)).size },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-lg p-4 border border-border">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-heading font-bold text-card-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Registration Requests */}
        <div className="px-6 pb-4">
          <RegistrationRequests />
        </div>

        {/* User Table */}
        <div className="px-6 pb-8">
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                 <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-heading font-semibold text-card-foreground">Usuario</th>
                    <th className="text-left px-4 py-3 font-heading font-semibold text-card-foreground">Ext.</th>
                    <th className="text-left px-4 py-3 font-heading font-semibold text-card-foreground">Correo</th>
                    <th className="text-left px-4 py-3 font-heading font-semibold text-card-foreground">Departamento</th>
                    <th className="text-left px-4 py-3 font-heading font-semibold text-card-foreground">Cargo</th>
                    <th className="text-left px-4 py-3 font-heading font-semibold text-card-foreground">Rol</th>
                    <th className="text-right px-4 py-3 font-heading font-semibold text-card-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                            {u.photoUrl ? (
                              <img src={u.photoUrl} alt={u.fullName} className="w-full h-full object-cover" />
                            ) : (
                              <User className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                           <span className="font-medium text-card-foreground">{u.fullName}</span>
                           {u.employeeStatus === "Inactivo" && (
                             <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">Inactivo</span>
                           )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.extension ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono bg-muted px-2 py-1 rounded">
                            <Phone className="h-3 w-3 text-gold" />{u.extension}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.department}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.position}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.isAdmin ? "bg-gold/20 gold-accent-text" : "bg-muted text-muted-foreground"}`}>
                          {u.isAdmin ? "Admin" : "Usuario"}
                        </span>
                        {u.isDepartmentLeader && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground ml-1">
                            Líder
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                         <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(u)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Editar">
                            <Pencil className="h-4 w-4" />
                          </button>
                          {u.id !== user?.id && (
                            <>
                              <button onClick={() => setResetConfirm(u.id)} className="p-2 rounded-lg hover:bg-gold/10 text-muted-foreground hover:text-gold transition-colors" title="Resetear Contraseña">
                                <KeyRound className="h-4 w-4" />
                              </button>
                              <button onClick={() => setShowDeleteConfirm(u.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Add/Edit Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">
                  {editing ? "Editar Usuario" : "Nuevo Usuario"}
                </h2>
                <button onClick={() => { setShowForm(false); setEditing(null); }} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* Photo upload */}
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Foto de Perfil</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Image className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png" onChange={handlePhotoUpload} className="hidden" />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-sm font-medium text-card-foreground hover:bg-border transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        Subir foto (JPG/PNG)
                      </button>
                    </div>
                  </div>
                </div>
                {[
                  { key: "fullName", label: "Nombre Completo *", type: "text" },
                  { key: "email", label: "Correo Electrónico", type: "email" },
                  { key: "position", label: "Cargo", type: "text" },
                  { key: "extension", label: "Extensión Telefónica", type: "text", placeholder: "Ej: 201" },
                  { key: "fleetPhone", label: "Teléfono Flota", type: "text", placeholder: "Ej: +1 809-555-0010" },
                  { key: "shift", label: "Turno", type: "text", placeholder: "Ej: Turno día, Mañana, Noche" },
                  { key: "team", label: "Equipo", type: "text", placeholder: "Ej: Sede Central, ALNAP, Banco Caribe" },
                  { key: "birthday", label: "Cumpleaños (MM-DD)", type: "text", placeholder: "Ej: 07-15" },
                  { key: "hireDate", label: "Fecha de Ingreso", type: "date", placeholder: "" },
                ].map(({ key, label, type, placeholder }) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">{label}</label>
                    <input
                      type={type}
                      placeholder={placeholder}
                      value={(form as any)[key] || ""}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Días Laborables por Semana</label>
                  <select
                    value={form.workDaysPerWeek || 5}
                    onChange={(e) => setForm({ ...form, workDaysPerWeek: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>{d} día{d > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Para calcular correctamente las vacaciones</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Departamento Principal</label>
                  <select
                    value={form.department || ""}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                  >
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Departamentos con Acceso</label>
                  <div className="flex flex-wrap gap-2">
                    {DEPARTMENTS.map((dept) => {
                      const selected = (form.allowedDepartments || []).includes(dept);
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => toggleDeptAccess(dept)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            selected
                              ? "bg-gold/20 border-gold/50 gold-accent-text font-semibold"
                              : "bg-background border-border text-muted-foreground hover:border-gold/30"
                          }`}
                        >
                          {dept}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, allowedDepartments: [...DEPARTMENTS] })}
                    className="text-xs gold-accent-text hover:underline mt-2"
                  >
                    Seleccionar todos
                  </button>
                </div>

                <div className="flex items-center gap-3 bg-muted rounded-lg p-4">
                  <input
                    type="checkbox"
                    id="isAdmin"
                    checked={form.isAdmin || false}
                    onChange={(e) => setForm({
                      ...form,
                      isAdmin: e.target.checked,
                      allowedDepartments: e.target.checked ? [...DEPARTMENTS] : form.allowedDepartments,
                    })}
                    className="w-4 h-4 rounded accent-gold"
                  />
                  <label htmlFor="isAdmin" className="text-sm text-card-foreground">
                    <span className="font-medium">Administrador</span>
                    <span className="text-muted-foreground ml-2 text-xs">(acceso total a todos los módulos)</span>
                  </label>
                </div>

                <div className="flex items-center gap-3 bg-muted rounded-lg p-4">
                  <input
                    type="checkbox"
                    id="isDepartmentLeader"
                    checked={form.isDepartmentLeader || false}
                    onChange={(e) => setForm({ ...form, isDepartmentLeader: e.target.checked })}
                    className="w-4 h-4 rounded accent-gold"
                  />
                  <label htmlFor="isDepartmentLeader" className="text-sm text-card-foreground">
                    <span className="font-medium">Líder de Departamento</span>
                    <span className="text-muted-foreground ml-2 text-xs">(aparece como líder en el dashboard)</span>
                  </label>
                </div>

                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Reporta a</label>
                  <select
                    value={form.reportsTo || ""}
                    onChange={(e) => setForm({ ...form, reportsTo: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                  >
                    <option value="">— Sin asignar —</option>
                    {allUsers
                      .filter((u) => u.id !== (editing?.id || ""))
                      .map((u) => (
                        <option key={u.id} value={u.id}>{u.fullName} — {u.position}</option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSave} className="btn-gold text-sm">
                  {editing ? "Guardar Cambios" : "Registrar Usuario"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-sm shadow-2xl">
              <div className="p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="h-7 w-7 text-destructive" />
                </div>
                <h3 className="font-heading font-bold text-lg text-card-foreground mb-2">¿Eliminar usuario?</h3>
                <p className="text-sm text-muted-foreground mb-1">
                  {allUsers.find((u) => u.id === showDeleteConfirm)?.fullName}
                </p>
                <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer</p>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowDeleteConfirm(null)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button onClick={() => handleDelete(showDeleteConfirm)} className="px-5 py-2.5 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Password Confirmation */}
        {resetConfirm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-sm shadow-2xl">
              <div className="p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="h-7 w-7 text-gold" />
                </div>
                <h3 className="font-heading font-bold text-lg text-card-foreground mb-2">¿Resetear contraseña?</h3>
                <p className="text-sm text-muted-foreground mb-1">
                  {allUsers.find((u) => u.id === resetConfirm)?.fullName}
                </p>
                <p className="text-xs text-muted-foreground">
                  La contraseña volverá a "safeone" y el usuario deberá cambiarla en su próximo ingreso.
                </p>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setResetConfirm(null)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    resetUserPassword(resetConfirm);
                    setResetConfirm(null);
                  }}
                  className="btn-gold text-sm"
                >
                  Resetear Contraseña
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default UserManagementPage;
