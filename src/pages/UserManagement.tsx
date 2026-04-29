import { useState, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useChatContextSafe } from "@/contexts/ChatContext";
import { DEPARTMENTS } from "@/lib/types";
import type { IntranetUser } from "@/lib/types";
import { generateOnboardingTicketDescription } from "@/lib/assetLinking";
import { Plus, X, Search, Pencil, Trash2, User, Shield, Mail, Building2, Phone, Upload, Image, KeyRound, Cake, FileSpreadsheet, Download, AlertCircle } from "lucide-react";
import { Navigate } from "react-router-dom";
import RegistrationRequests from "@/components/RegistrationRequests";
import BirthdayOverlay from "@/components/BirthdayOverlay";
import ExportMenu from "@/components/ExportMenu";
import { toast } from "@/hooks/use-toast";

const emptyForm = (): Partial<IntranetUser> => ({
  employeeCode: "",
  fullName: "",
  firstName1: "",
  firstName2: "",
  lastName1: "",
  lastName2: "",
  cedula: "",
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
  const { addNotification } = useNotifications();
  const chatCtx = useChatContextSafe();
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IntranetUser | null>(null);
  const [form, setForm] = useState<Partial<IntranetUser>>(emptyForm());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [birthdayTestUsers, setBirthdayTestUsers] = useState<IntranetUser[]>([]);
  const [showBirthdayTest, setShowBirthdayTest] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState<Partial<IntranetUser>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importDept, setImportDept] = useState<string>(DEPARTMENTS[0]);

  // ─── CSV Import ────────────────────────────────────────────
  const parseCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else cur += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === "," || c === ";" || c === "\t") { out.push(cur); cur = ""; }
        else cur += c;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const normalizeHeader = (h: string) =>
    h.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const HEADER_MAP: Record<string, keyof IntranetUser> = {
    codigo: "employeeCode",
    employeecode: "employeeCode",
    nombre1: "firstName1",
    primernombre: "firstName1",
    nombre: "firstName1",
    nombre2: "firstName2",
    segundonombre: "firstName2",
    apellido1: "lastName1",
    primerapellido: "lastName1",
    apellido: "lastName1",
    apellido2: "lastName2",
    segundoapellido: "lastName2",
    cedula: "cedula",
    fechanacimiento: "birthday",
    nacimiento: "birthday",
    cumpleanos: "birthday",
    direccion: "position", // no usado, placeholder
    telefono: "fleetPhone",
    celular: "fleetPhone",
    puesto: "position",
    cargo: "position",
    fechaingreso: "hireDate",
    correo: "email",
    email: "email",
  };

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setImportErrors(["El archivo está vacío o no tiene filas de datos."]);
      setImportPreview([]);
      return;
    }
    const headers = parseCsvLine(lines[0]).map(normalizeHeader);
    const rows = lines.slice(1).map(parseCsvLine);
    const errors: string[] = [];
    const preview: Partial<IntranetUser>[] = [];

    rows.forEach((row, idx) => {
      const u: Partial<IntranetUser> = {};
      headers.forEach((h, i) => {
        const field = HEADER_MAP[h];
        if (!field) return;
        const val = row[i] ?? "";
        if (val === "" || val === "NULL" || val === "null") return;
        if (field === "birthday") {
          // Acepta MM-DD, YYYY-MM-DD, DD/MM/YYYY
          let mmdd = "";
          const m1 = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
          const m2 = val.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
          const m3 = val.match(/^(\d{2})-(\d{2})$/);
          if (m1) mmdd = `${m1[2]}-${m1[3]}`;
          else if (m2) mmdd = `${m2[2]}-${m2[1]}`;
          else if (m3) mmdd = `${m3[1]}-${m3[2]}`;
          if (mmdd) (u as any)[field] = mmdd;
        } else {
          (u as any)[field] = val;
        }
      });

      // Validación mínima: necesita al menos un nombre
      const composed = [u.firstName1, u.firstName2, u.lastName1, u.lastName2]
        .filter(Boolean).join(" ").trim();
      if (!composed) {
        errors.push(`Fila ${idx + 2}: sin nombre, omitida.`);
        return;
      }
      u.fullName = composed;
      // Evitar duplicados por employeeCode
      if (u.employeeCode && allUsers.some((au) => au.employeeCode === u.employeeCode)) {
        errors.push(`Fila ${idx + 2}: código ${u.employeeCode} ya existe, omitida.`);
        return;
      }
      preview.push(u);
    });

    setImportPreview(preview);
    setImportErrors(errors);
  };

  const confirmImport = () => {
    importPreview.forEach((u, i) => {
      const newUser: IntranetUser = {
        id: `USR-${String(Date.now() + i).slice(-6)}`,
        employeeCode: u.employeeCode || "",
        fullName: u.fullName || "",
        firstName1: u.firstName1 || "",
        firstName2: u.firstName2 || "",
        lastName1: u.lastName1 || "",
        lastName2: u.lastName2 || "",
        cedula: u.cedula || "",
        email: u.email || "",
        department: importDept,
        position: u.position || "",
        birthday: u.birthday || "",
        photoUrl: "",
        allowedDepartments: [importDept],
        isAdmin: false,
        isDepartmentLeader: false,
        reportsTo: "",
        fleetPhone: u.fleetPhone || "",
        hireDate: u.hireDate || "",
      };
      addUser(newUser);
    });
    toast({
      title: "Importación completada",
      description: `${importPreview.length} empleado(s) agregados al departamento ${importDept}.`,
    });
    setShowImport(false);
    setImportPreview([]);
    setImportErrors([]);
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const downloadTemplate = () => {
    const headers = ["Codigo", "Nombre1", "Nombre2", "Apellido1", "Apellido2", "Cedula", "FechaNacimiento", "Telefono", "Puesto", "FechaIngreso"];
    const example = ["3751", "Brandon", "", "Diaz", "Perez", "402-3309103-8", "1990-05-15", "(829) 570-8977", "Operador", "2023-01-10"];
    const csv = [headers.join(","), example.join(",")].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-empleados.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

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
      (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.id || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.employeeCode || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.cedula || "").toLowerCase().includes(search.toLowerCase()) ||
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
    // Si se llenaron los nombres separados, autogenerar fullName
    const composedName = [form.firstName1, form.firstName2, form.lastName1, form.lastName2]
      .filter(Boolean).join(" ").trim();
    const finalFullName = (form.fullName?.trim() || composedName).trim();
    if (!finalFullName) return;

    const payload = { ...form, fullName: finalFullName };

    if (editing) {
      updateUser(editing.id, payload);
    } else {
      const newUser: IntranetUser = {
        id: `USR-${String(Date.now()).slice(-6)}`,
        employeeCode: form.employeeCode || "",
        fullName: finalFullName,
        firstName1: form.firstName1 || "",
        firstName2: form.firstName2 || "",
        lastName1: form.lastName1 || "",
        lastName2: form.lastName2 || "",
        cedula: form.cedula || "",
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
        hireDate: form.hireDate || "",
      };
      addUser(newUser);

      // Auto-create IT onboarding ticket
      const reportsToUser = allUsers.find((u) => u.id === newUser.reportsTo);
      const reportsToName = reportsToUser?.fullName || "No asignado";
      const ticketDescription = generateOnboardingTicketDescription(
        newUser.fullName, newUser.department, newUser.position, reportsToName
      );
      const now = new Date();
      const existingTickets = JSON.parse(localStorage.getItem("safeone_tickets") || "[]");
      const onboardTicket = {
        id: `TK-${String(Date.now()).slice(-6)}`,
        title: `Nueva Contratación: ${newUser.fullName} — Preparar equipos y accesos`,
        description: ticketDescription,
        category: "Asignación de Equipos (Nuevos)",
        priority: "Alta",
        status: "Abierto",
        createdBy: user?.fullName || "Sistema",
        createdById: user?.id,
        assignedTo: "Tecnología y Monitoreo",
        assignedToId: "USR-002",
        department: "Tecnología y Monitoreo",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        slaHours: 8,
        slaDeadline: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
        attachments: [],
        comments: [],
      };
      existingTickets.push(onboardTicket);
      localStorage.setItem("safeone_tickets", JSON.stringify(existingTickets));

      // Notify IT
      addNotification({
        type: "info",
        title: "🟢 Nueva Contratación — Preparar Equipos",
        message: `${newUser.fullName} ingresa a ${newUser.department} como ${newUser.position}. Preparar equipos y accesos. Supervisor: ${reportsToName}.`,
        relatedId: newUser.id,
        forUserId: "USR-002",
        actionUrl: "/tickets",
      });

      // Notify all IT department members
      const itMembers = allUsers.filter((u) => u.department === "Tecnología y Monitoreo" && u.id !== "USR-002" && u.employeeStatus !== "Inactivo");
      itMembers.forEach((itUser) => {
        addNotification({
          type: "info",
          title: "Nueva Contratación",
          message: `${newUser.fullName} ingresa a ${newUser.department}. Ticket de preparación generado.`,
          relatedId: newUser.id,
          forUserId: itUser.id,
          actionUrl: "/tickets",
        });
      });

      // Notify HR
      addNotification({
        type: "hiring",
        title: "Nuevo Colaborador Registrado",
        message: `${newUser.fullName} ha sido registrado en ${newUser.department} como ${newUser.position}.`,
        relatedId: newUser.id,
        forUserId: "USR-006",
        actionUrl: "/",
      });

      toast({
        title: "✅ Usuario registrado",
        description: `${newUser.fullName} fue registrado. Se generó ticket de IT para preparar equipos y accesos.`,
      });
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
              <button
                onClick={() => { setShowImport(true); setImportPreview([]); setImportErrors([]); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-sm font-medium text-card-foreground hover:bg-border transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Importar CSV
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

        {/* Admin Tools — Birthday Test */}
        <div className="px-6 pb-4">
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cake className="h-4 w-4 text-gold" />
              <h3 className="font-heading font-bold text-sm text-card-foreground">Probar Overlay de Cumpleaños</h3>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={birthdayTestUsers[0]?.id || ""}
                onChange={(e) => {
                  const selected = activeUsers.find((u) => u.id === e.target.value);
                  if (selected) setBirthdayTestUsers([selected]);
                }}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
              >
                <option value="">Seleccionar usuario...</option>
                {activeUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName} — {u.department}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (birthdayTestUsers.length > 0) setShowBirthdayTest(true);
                }}
                disabled={birthdayTestUsers.length === 0}
                className="btn-gold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Cake className="h-4 w-4" />
                Previsualizar
              </button>
            </div>
          </div>
        </div>

        {/* Birthday Test Overlay */}
        {showBirthdayTest && birthdayTestUsers.length > 0 && (
          <BirthdayOverlay
            birthdayUsers={birthdayTestUsers}
            isTest
            onDismissTest={() => setShowBirthdayTest(false)}
            onSendCongrats={(bdayUser) => {
              if (chatCtx) {
                chatCtx.startIndividualChat(bdayUser.id);
                setTimeout(() => {
                  chatCtx.sendMessage(`🎂🎉 ¡Feliz Cumpleaños, ${bdayUser.fullName}! De parte de SafeOne Security Company te deseamos un maravilloso día lleno de éxitos y bendiciones. 🥳`);
                }, 500);
              }
            }}
          />
        )}

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
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.email ? (
                          u.email
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-mono bg-muted px-2 py-1 rounded" title="Sin correo — inicia sesión con su ID">
                            <User className="h-3 w-3 text-gold" />{u.id}
                          </span>
                        )}
                      </td>
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
                  { key: "employeeCode", label: "Código de Empleado", type: "text", placeholder: "Ej: 3751" },
                  { key: "fullName", label: "Nombre Completo (se autocompleta si llenas los campos separados abajo)", type: "text" },
                  { key: "firstName1", label: "Primer Nombre", type: "text", placeholder: "Ej: Brandon" },
                  { key: "firstName2", label: "Segundo Nombre", type: "text", placeholder: "(opcional)" },
                  { key: "lastName1", label: "Primer Apellido", type: "text", placeholder: "Ej: Diaz" },
                  { key: "lastName2", label: "Segundo Apellido", type: "text", placeholder: "Ej: Perez" },
                  { key: "cedula", label: "Cédula", type: "text", placeholder: "Ej: 402-3309103-8" },
                  { key: "email", label: "Correo Electrónico (opcional — si no tiene, inicia sesión con su Código de Empleado o ID)", type: "email" },
                  { key: "position", label: "Cargo", type: "text" },
                  { key: "extension", label: "Extensión Telefónica", type: "text", placeholder: "Ej: 201" },
                  { key: "fleetPhone", label: "Teléfono Flota", type: "text", placeholder: "Ej: +1 809-555-0010" },
                  { key: "shift", label: "Turno", type: "text", placeholder: "Ej: Turno día, Mañana, Noche" },
                  { key: "team", label: "Equipo", type: "text", placeholder: "Ej: Sede Central, ALNAP, Banco Caribe" },
                  { key: "birthday", label: "Cumpleaños (MM-DD)", type: "text", placeholder: "Ej: 07-15" },
                  { key: "hireDate", label: "Fecha de Ingreso", type: "date", placeholder: "" },
                ].map(({ key, label, type, placeholder }: any) => (
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

        {/* ═══ Import CSV Modal ═══ */}
        {showImport && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-gold" />
                  Importar Empleados desde CSV
                </h2>
                <button onClick={() => setShowImport(false)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm text-muted-foreground">
                  <p className="font-semibold text-card-foreground mb-2">Columnas reconocidas (encabezados):</p>
                  <p className="text-xs font-mono">
                    Codigo, Nombre1, Nombre2, Apellido1, Apellido2, Cedula,
                    FechaNacimiento, Telefono/Celular, Puesto, FechaIngreso, Correo
                  </p>
                  <p className="mt-2 text-xs">
                    Las columnas que no estén en esta lista se ignoran. Valores `NULL` también se ignoran.
                    El nombre completo se arma automáticamente.
                  </p>
                  <button onClick={downloadTemplate} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-gold hover:underline">
                    <Download className="h-3.5 w-3.5" /> Descargar plantilla CSV
                  </button>
                </div>

                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Departamento al que pertenecen estos empleados</label>
                  <select
                    value={importDept}
                    onChange={(e) => setImportDept(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                  >
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Archivo CSV</label>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvFile}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gold/10 file:text-gold hover:file:bg-gold/20"
                  />
                </div>

                {importErrors.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-amber-600 mb-1">
                      <AlertCircle className="h-4 w-4" /> Avisos ({importErrors.length})
                    </div>
                    <ul className="space-y-0.5 max-h-24 overflow-y-auto">
                      {importErrors.map((e, i) => <li key={i} className="text-muted-foreground">• {e}</li>)}
                    </ul>
                  </div>
                )}

                {importPreview.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-muted text-xs font-semibold text-card-foreground">
                      Vista previa: {importPreview.length} empleado(s) listos para importar
                    </div>
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-1.5">Código</th>
                            <th className="text-left px-3 py-1.5">Nombre</th>
                            <th className="text-left px-3 py-1.5">Cédula</th>
                            <th className="text-left px-3 py-1.5">Cumpleaños</th>
                            <th className="text-left px-3 py-1.5">Puesto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {importPreview.slice(0, 50).map((u, i) => (
                            <tr key={i}>
                              <td className="px-3 py-1.5 font-mono">{u.employeeCode || "—"}</td>
                              <td className="px-3 py-1.5">{u.fullName}</td>
                              <td className="px-3 py-1.5 font-mono">{u.cedula || "—"}</td>
                              <td className="px-3 py-1.5">{u.birthday || "—"}</td>
                              <td className="px-3 py-1.5">{u.position || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {importPreview.length > 50 && (
                      <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/30 text-center">
                        … y {importPreview.length - 50} más
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2 border-t border-border">
                  <button onClick={() => setShowImport(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">
                    Cancelar
                  </button>
                  <button
                    onClick={confirmImport}
                    disabled={importPreview.length === 0}
                    className="btn-gold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Importar {importPreview.length > 0 ? `${importPreview.length} empleado(s)` : ""}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default UserManagementPage;
