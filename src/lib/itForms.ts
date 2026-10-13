/** Definición de los formularios de TI (F-IT-01..04) según los documentos oficiales. */
export type FieldKind = "text" | "date" | "email" | "textarea" | "radio" | "checks";
export interface ITField { key: string; label: string; kind?: FieldKind; options?: string[]; required?: boolean; placeholder?: string }
export interface ITSection { title: string; fields: ITField[] }
export interface ITFormDef { codigo: string; titulo: string; descripcion: string; resumenKey: string; sections: ITSection[]; ti: ITField[] }

const DEPTOS = ["Administración", "Monitoreo", "Operaciones", "Tecnología", "RRHH", "Contabilidad"];
const SN = ["Sí", "No"];
const solicitante = (withEmail = false): ITSection => ({
  title: "Datos del solicitante",
  fields: [
    { key: "solNombre", label: "Nombre del solicitante", required: true },
    { key: "solCargo", label: "Cargo", required: true },
    { key: "solDepto", label: "Departamento", required: true },
    ...(withEmail ? [{ key: "solEmail", label: "Correo electrónico", kind: "email" as FieldKind }] : []),
  ],
});

export const IT_FORMS: ITFormDef[] = [
  {
    codigo: "F-IT-01", titulo: "Alta de Usuario", descripcion: "Nuevo ingreso: creación de usuario de red, correo y accesos.", resumenKey: "nombres",
    sections: [
      { title: "Fecha", fields: [{ key: "fecha", label: "Fecha de solicitud", kind: "date", required: true }] },
      solicitante(),
      { title: "Datos del nuevo usuario", fields: [
        { key: "nombres", label: "Nombres completos", required: true },
        { key: "apellidos", label: "Apellidos completos", required: true },
        { key: "cedula", label: "Cédula / Pasaporte", required: true },
        { key: "fechaIngreso", label: "Fecha de ingreso a la empresa", kind: "date", required: true },
        { key: "emailPersonal", label: "Correo personal (envío de credenciales)", kind: "email", required: true },
        { key: "telefono", label: "Teléfono / celular corporativo (si aplica)" },
      ] },
      { title: "Datos laborales y de acceso", fields: [
        { key: "cargo", label: "Cargo / Posición", required: true },
        { key: "ou", label: "Departamento (Unidad Organizativa - OU)", kind: "radio", options: DEPTOS, required: true },
        { key: "tipoUsuario", label: "Tipo de usuario", kind: "radio", options: ["Estación fija (Workstation)", "Móvil (Laptop)"], required: true },
        { key: "grupos", label: "Grupos de seguridad requeridos (adicionales)", kind: "textarea" },
        { key: "carpetas", label: "¿Requiere carpetas compartidas especiales?", kind: "radio", options: SN },
        { key: "carpetasRuta", label: "Ruta o nombre de carpeta (si aplica)" },
        { key: "software", label: "Software base adicional al estándar", kind: "textarea" },
      ] },
    ],
    ti: [
      { key: "usuarioRed", label: "Usuario de red creado", placeholder: "Ej: aperez" },
      { key: "correo", label: "Correo electrónico asignado", placeholder: "usuario@safeone.com.do" },
      { key: "passTemp", label: "Contraseña temporal entregada al usuario (no se escribe aquí)", kind: "radio", options: SN },
      { key: "cambioObligatorio", label: "Cambio obligatorio en primer inicio", kind: "radio", options: SN },
      { key: "fechaCreacion", label: "Fecha de creación", kind: "date" },
    ],
  },
  {
    codigo: "F-IT-02", titulo: "Baja de Usuario", descripcion: "Salida de personal: deshabilitar cuenta, accesos y respaldo.", resumenKey: "nombre",
    sections: [
      { title: "Fecha", fields: [{ key: "fecha", label: "Fecha de solicitud", kind: "date", required: true }] },
      solicitante(),
      { title: "Datos del usuario a dar de baja", fields: [
        { key: "nombre", label: "Nombre completo", required: true },
        { key: "usuarioRed", label: "Usuario de red (login)" },
        { key: "cedula", label: "Cédula / Pasaporte", required: true },
        { key: "cargo", label: "Cargo / Posición actual" },
        { key: "depto", label: "Departamento" },
        { key: "fechaBaja", label: "Último día de trabajo / Fecha efectiva de baja", kind: "date", required: true },
      ] },
      { title: "Tipo de baja y observaciones", fields: [
        { key: "tipoBaja", label: "Tipo de baja", kind: "radio", options: ["Renuncia voluntaria", "Término de contrato", "Despido", "Otro"], required: true },
        { key: "tipoOtro", label: "Otro (especificar)" },
        { key: "obs", label: "Observaciones (entrega de equipos, reemplazo)", kind: "textarea" },
      ] },
    ],
    ti: [
      { key: "fechaDeshab", label: "Fecha de deshabilitación de cuenta", kind: "date" },
      { key: "fechaPass", label: "Fecha de cambio de contraseña", kind: "date" },
      { key: "grupos", label: "¿Se removió de grupos de seguridad?", kind: "radio", options: SN },
      { key: "backup", label: "¿Se realizó backup de datos del usuario?", kind: "radio", options: SN },
      { key: "ubicacion", label: "Ubicación del backup" },
      { key: "siga", label: "¿Se notificó a sistemas externos (DGA SIGA)?", kind: "radio", options: ["Sí", "No", "N/A"] },
    ],
  },
  {
    codigo: "F-IT-03", titulo: "Cambio de Permisos", descripcion: "Grupos de seguridad, carpetas, cambio de departamento.", resumenKey: "nombre",
    sections: [
      { title: "Fecha", fields: [{ key: "fecha", label: "Fecha de solicitud", kind: "date", required: true }] },
      solicitante(true),
      { title: "Datos del usuario afectado", fields: [
        { key: "nombre", label: "Nombre completo", required: true },
        { key: "usuarioRed", label: "Usuario de red (login)" },
        { key: "cargo", label: "Cargo / Posición actual" },
        { key: "depto", label: "Departamento" },
      ] },
      { title: "Detalle del cambio solicitado", fields: [
        { key: "cambios", label: "Tipo de cambio", kind: "checks", required: true, options: ["Alta en grupo(s) de seguridad", "Baja en grupo(s) de seguridad", "Cambio de departamento", "Asignación de carpeta compartida", "Cambio de permisos en recurso específico", "Otro"] },
        { key: "detalle", label: "Especificar el/los cambios (grupo, ruta, permiso, nuevo departamento…)", kind: "textarea", required: true },
        { key: "justificacion", label: "Justificación del cambio", kind: "textarea", required: true },
        { key: "aprobador", label: "Aprobación del jefe de departamento (nombre, si aplica)" },
      ] },
    ],
    ti: [
      { key: "fechaEjec", label: "Fecha de ejecución", kind: "date" },
      { key: "resultado", label: "Acción realizada / resultado", kind: "textarea" },
    ],
  },
  {
    codigo: "F-IT-04", titulo: "Registro de Equipo en Dominio", descripcion: "Unión de equipos a safeone.local (lo completa TI).", resumenKey: "hostname",
    sections: [
      { title: "Registro", fields: [
        { key: "fecha", label: "Fecha de registro", kind: "date", required: true },
        { key: "tecnico", label: "Nombre del técnico", required: true },
      ] },
      { title: "Datos del equipo", fields: [
        { key: "tipo", label: "Tipo de equipo", kind: "radio", options: ["Workstation (Escritorio)", "Laptop", "Servidor"], required: true },
        { key: "modelo", label: "Marca y modelo", required: true },
        { key: "serie", label: "Número de serie / Service Tag", required: true },
        { key: "hostname", label: "Nombre actual del equipo (hostname)", required: true },
        { key: "nuevoNombre", label: "Nuevo nombre en el dominio (si aplica)" },
        { key: "so", label: "Sistema operativo (versión y edición)", placeholder: "Win 11 Pro" },
        { key: "ip", label: "Dirección IP (fija o DHCP)" },
        { key: "mac", label: "Dirección MAC" },
      ] },
      { title: "Usuario principal asignado", fields: [
        { key: "usuario", label: "Nombre del usuario" },
        { key: "usuarioRed", label: "Usuario de red (login)" },
        { key: "depto", label: "Departamento" },
      ] },
    ],
    ti: [
      { key: "fechaUnion", label: "Fecha de unión al dominio (safeone.local)", kind: "date" },
      { key: "ou", label: "Ubicación en la Unidad Organizativa", kind: "radio", options: ["SafeOne_Computers/Workstations", "SafeOne_Computers/Laptops", "SafeOne_Computers/Servers"] },
      { key: "reinicio", label: "Reinicio completado", kind: "radio", options: SN },
      { key: "gpo", label: "Políticas de grupo aplicadas (GPUpdate / RSoP)", kind: "radio", options: SN },
      { key: "av", label: "Antivirus corporativo activo", kind: "radio", options: SN },
      { key: "mapeo", label: "Mapeo de unidades correcto", kind: "radio", options: SN },
      { key: "obs", label: "Observaciones (incidencias, software especial)", kind: "textarea" },
    ],
  },
];

export const formatValue = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(", ") : v || "");
