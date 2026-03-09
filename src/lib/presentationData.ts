import {
  LayoutDashboard, TrendingUp, CheckSquare, Ticket, Package, Truck,
  Smartphone, Shield, ShoppingCart, Users, FileText, Wallet, Phone,
  Calendar, FolderOpen, BookOpen, BookMarked, ClipboardList, MessageSquare,
  Search, Bell, Monitor, Radio, UserCog, Lock, Building2, Calculator,
  AlertTriangle, type LucideIcon,
} from "lucide-react";

export interface Slide {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  bullets?: string[];
  highlight?: string;
  layout: "cover" | "feature" | "demo" | "grid" | "closing";
  /** route to open for live demo */
  demoRoute?: string;
  demoLabel?: string;
  gridItems?: { icon: LucideIcon; label: string; desc: string }[];
}

export const slides: Slide[] = [
  /* 0 — Cover */
  {
    layout: "cover",
    title: "SafeOne Intranet Corporativa",
    subtitle: "Plataforma integral de gestión operativa, administrativa y tecnológica",
    highlight: "Departamento de Tecnología y Monitoreo",
  },

  /* 1 — Módulos overview */
  {
    layout: "grid",
    title: "Módulos del Sistema",
    subtitle: "Una plataforma unificada con más de 20 módulos especializados",
    gridItems: [
      { icon: LayoutDashboard, label: "Dashboard", desc: "Vista general corporativa" },
      { icon: TrendingUp, label: "KPIs", desc: "Indicadores de rendimiento" },
      { icon: CheckSquare, label: "Tareas", desc: "Gestión de pendientes" },
      { icon: Ticket, label: "Tickets IT", desc: "Soporte técnico con SLA" },
      { icon: Package, label: "Inventario IT", desc: "Control de equipos" },
      { icon: Truck, label: "Flotilla", desc: "Vehículos corporativos" },
      { icon: Smartphone, label: "Flota Celular", desc: "Dispositivos móviles" },
      { icon: Shield, label: "Personal Armado", desc: "Control de armamento" },
      { icon: ShoppingCart, label: "Compras", desc: "Solicitudes y aprobaciones" },
      { icon: Users, label: "Contratación", desc: "Requisiciones de personal" },
      { icon: FileText, label: "RRHH", desc: "Formularios y vacaciones" },
      { icon: Wallet, label: "Gastos Menores", desc: "Caja chica y tarjeta" },
    ],
  },

  /* Dashboard */
  {
    layout: "feature",
    title: "Dashboard Corporativo",
    icon: LayoutDashboard,
    bullets: [
      "Vista general con tarjetas por departamento y líderes asignados",
      "Anuncios corporativos y celebración de cumpleaños del día",
      "Accesos rápidos a sistemas externos (General y Adonis)",
      "Información jerárquica: equipo de trabajo y cadena de reportes",
      "Diseño moderno inspirado en SharePoint con identidad SafeOne",
    ],
  },
  { layout: "demo", title: "Dashboard Corporativo", icon: LayoutDashboard, demoRoute: "/", demoLabel: "Abrir Dashboard" },

  /* KPIs */
  {
    layout: "feature",
    title: "KPIs y Métricas",
    icon: TrendingUp,
    bullets: [
      "Dashboard de indicadores de rendimiento por departamento",
      "Gráficos interactivos con Recharts para visualización de datos",
      "Seguimiento de metas y objetivos corporativos",
      "Reportes exportables para presentaciones gerenciales",
      "Actualización en tiempo real de métricas clave",
    ],
  },
  { layout: "demo", title: "KPIs y Métricas", icon: TrendingUp, demoRoute: "/kpis", demoLabel: "Abrir KPIs" },

  /* Tareas */
  {
    layout: "feature",
    title: "Gestión de Tareas",
    icon: CheckSquare,
    bullets: [
      "Bandeja de entrada de tareas pendientes por usuario",
      "Asignación, priorización y seguimiento de actividades",
      "Fechas de vencimiento y notificaciones automáticas",
      "Filtros por estado, prioridad y departamento",
      "Historial completo de cambios y comentarios",
    ],
  },
  { layout: "demo", title: "Gestión de Tareas", icon: CheckSquare, demoRoute: "/tareas", demoLabel: "Abrir Tareas" },

  /* Directorio */
  {
    layout: "feature",
    title: "Directorio Corporativo",
    icon: Phone,
    bullets: [
      "Directorio completo de empleados con extensiones telefónicas",
      "Tarjetas de contacto con foto, cargo y departamento",
      "Búsqueda y filtrado por departamento o nombre",
      "Información de contacto: email, extensión, celular",
      "Exportación del directorio a Excel",
    ],
  },
  { layout: "demo", title: "Directorio Corporativo", icon: Phone, demoRoute: "/directorio", demoLabel: "Abrir Directorio" },

  /* Calendario */
  {
    layout: "feature",
    title: "Calendario Corporativo",
    icon: Calendar,
    bullets: [
      "Vista mensual con eventos y fechas importantes",
      "Categorías de eventos codificadas por colores",
      "Reuniones, capacitaciones y fechas de vencimiento",
      "Integración con módulos de RRHH y operaciones",
      "Notificaciones de próximos eventos",
    ],
  },
  { layout: "demo", title: "Calendario Corporativo", icon: Calendar, demoRoute: "/calendario", demoLabel: "Abrir Calendario" },

  /* Tickets IT */
  {
    layout: "feature",
    title: "Tickets de Soporte IT",
    icon: Ticket,
    bullets: [
      "Creación y seguimiento de tickets con categorías especializadas",
      "SLA automático por prioridad: Baja (72h), Media (24h), Alta (8h), Crítica (2h)",
      "Estados: Abierto → En Progreso → En Espera → Resuelto → Cerrado",
      "Asignación por departamento con historial completo",
      "Adjuntos y notas de seguimiento en cada ticket",
    ],
  },
  { layout: "demo", title: "Tickets de Soporte IT", icon: Ticket, demoRoute: "/tickets", demoLabel: "Abrir Tickets" },

  /* Inventario IT */
  {
    layout: "feature",
    title: "Inventario de Equipos IT",
    icon: Package,
    bullets: [
      "Registro de computadoras, monitores, impresoras y equipos de red",
      "Control de estados: Disponible, Asignado, En Reparación, Dado de Baja",
      "Asignación por usuario y departamento con trazabilidad",
      "Búsqueda y filtrado avanzado por tipo, estado y marca",
      "Exportación de reportes a Excel y PDF",
    ],
  },
  { layout: "demo", title: "Inventario de Equipos IT", icon: Package, demoRoute: "/inventario", demoLabel: "Abrir Inventario" },

  /* Flotilla */
  {
    layout: "feature",
    title: "Flotilla Vehicular",
    icon: Truck,
    bullets: [
      "Gestión completa de vehículos: placa, marca, modelo, kilometraje",
      "Estados de activos: Activo, Disponible, En Reparación, Dado de Baja",
      "Asignación por empleado con historial de cambios",
      "Seguimiento de mantenimiento y vencimientos",
      "Control de documentos: seguro, matrícula, inspección",
    ],
  },
  { layout: "demo", title: "Flotilla Vehicular", icon: Truck, demoRoute: "/flotilla", demoLabel: "Abrir Flotilla" },

  /* Flota Celular */
  {
    layout: "feature",
    title: "Flota de Celulares",
    icon: Smartphone,
    bullets: [
      "Control de dispositivos móviles: IMEI, serial, número telefónico",
      "Asignación por empleado con historial",
      "Estados: Activo, Disponible, En Reparación, Dado de Baja",
      "Información de carrier y plan de datos",
      "Seguimiento de líneas corporativas",
    ],
  },
  { layout: "demo", title: "Flota de Celulares", icon: Smartphone, demoRoute: "/flota-celular", demoLabel: "Abrir Flota Celular" },

  /* BASC */
  {
    layout: "feature",
    title: "Personal Armado (BASC)",
    icon: Shield,
    bullets: [
      "Registro de agentes con armamento asignado: tipo, serial, marca, calibre",
      "Control de licencias con alertas de vencimiento",
      "Información completa: ubicación, supervisor, teléfono, dirección",
      "Cumplimiento con estándares BASC de seguridad",
      "Vista de tarjetas con foto del agente y detalles del arma",
    ],
  },
  { layout: "demo", title: "Personal Armado (BASC)", icon: Shield, demoRoute: "/basc", demoLabel: "Abrir BASC" },

  /* Compras */
  {
    layout: "feature",
    title: "Solicitudes de Compra",
    icon: ShoppingCart,
    bullets: [
      "Flujo de aprobación escalonado por monto (hasta RD$50,000 y superiores)",
      "Aprobación: Jefe Directo → Gerencia General (montos mayores)",
      "Adjunto de cotizaciones y justificación de compra",
      "Seguimiento visual por pasos: Solicitud → Aprobación → Compra → Completada",
      "Notificaciones automáticas en cada cambio de estado",
    ],
  },
  { layout: "demo", title: "Solicitudes de Compra", icon: ShoppingCart, demoRoute: "/solicitudes-compra", demoLabel: "Abrir Compras" },

  /* Contratación */
  {
    layout: "feature",
    title: "Solicitudes de Personal",
    icon: Users,
    bullets: [
      "Requisiciones de contratación con flujo multi-nivel",
      "Aprobación: Gerente de Área → Gerencia General → RRHH",
      "Campos específicos para operaciones: zona residencial, vehículo disponible",
      "Seguimiento de entrevistas y proceso de selección",
      "Control de tipos de contrato: Indefinido, Temporal, Proyecto",
    ],
  },
  { layout: "demo", title: "Solicitudes de Personal", icon: Users, demoRoute: "/solicitudes-personal", demoLabel: "Abrir Contratación" },

  /* RRHH */
  {
    layout: "feature",
    title: "Recursos Humanos",
    icon: FileText,
    bullets: [
      "Formularios: Vacaciones, Permisos, Ausencias, Días Libres, Préstamos",
      "Cálculo automático de vacaciones según Ley Laboral Dominicana (Art. 177)",
      "Doble modalidad: Impresión para firma física y Aprobación Virtual",
      "Flujo de aprobación: Empleado → Supervisor → RRHH con notificaciones",
      "Cálculo de antigüedad y días según jornada laboral configurada",
    ],
  },
  { layout: "demo", title: "Recursos Humanos", icon: FileText, demoRoute: "/rrhh/formularios", demoLabel: "Abrir RRHH" },

  /* Gastos Menores */
  {
    layout: "feature",
    title: "Gastos Menores",
    icon: Wallet,
    bullets: [
      "Gestión de caja chica y tarjeta corporativa",
      "Solicitudes de reembolso con adjunto de recibos",
      "Aprobación por supervisores con trazabilidad",
      "Reportes de gastos por categoría y período",
      "Control de presupuesto mensual disponible",
    ],
  },
  { layout: "demo", title: "Gastos Menores", icon: Wallet, demoRoute: "/gastos-menores", demoLabel: "Abrir Gastos" },

  /* Archivos */
  {
    layout: "feature",
    title: "Archivos Compartidos",
    icon: FolderOpen,
    bullets: [
      "Gestor de documentos con carpetas organizadas por departamento",
      "Soporte para PDF, Word, Excel, imágenes y más",
      "Búsqueda y filtrado de archivos por nombre y tipo",
      "Carga y descarga de documentos corporativos",
      "Control de versiones y permisos por departamento",
    ],
  },
  { layout: "demo", title: "Archivos Compartidos", icon: FolderOpen, demoRoute: "/archivos", demoLabel: "Abrir Archivos" },

  /* Procedimientos */
  {
    layout: "feature",
    title: "Procedimientos (SOPs)",
    icon: BookOpen,
    bullets: [
      "Biblioteca de procedimientos estándar de operación",
      "Organización por departamento y categoría",
      "Versionado de documentos con historial de cambios",
      "Búsqueda por contenido y palabras clave",
      "Acceso rápido a manuales operativos y guías",
    ],
  },
  { layout: "demo", title: "Procedimientos (SOPs)", icon: BookOpen, demoRoute: "/procedimientos", demoLabel: "Abrir Procedimientos" },

  /* Wiki */
  {
    layout: "feature",
    title: "Wiki Corporativa",
    icon: BookMarked,
    bullets: [
      "Base de conocimiento colaborativa por departamento",
      "Artículos con editor de texto enriquecido",
      "Categorización y etiquetas para fácil búsqueda",
      "Contribuciones de múltiples autores",
      "Historial de ediciones y revisiones",
    ],
  },
  { layout: "demo", title: "Wiki Corporativa", icon: BookMarked, demoRoute: "/wiki", demoLabel: "Abrir Wiki" },

  /* Encuestas */
  {
    layout: "feature",
    title: "Encuestas Internas",
    icon: ClipboardList,
    bullets: [
      "Creación de encuestas con múltiples tipos de pregunta",
      "Seguimiento de participación y porcentaje de completado",
      "Resultados en tiempo real con gráficos",
      "Evaluaciones de clima laboral y satisfacción",
      "Encuestas anónimas y nominales",
    ],
  },
  { layout: "demo", title: "Encuestas Internas", icon: ClipboardList, demoRoute: "/encuestas", demoLabel: "Abrir Encuestas" },

  /* Gestión de Usuarios */
  {
    layout: "feature",
    title: "Gestión de Usuarios",
    icon: UserCog,
    bullets: [
      "Administración de cuentas: crear, editar, activar/desactivar",
      "Asignación de roles: Administrador y Usuario estándar",
      "Control de departamento y posición por usuario",
      "Solicitudes de registro con aprobación administrativa",
      "Configuración de jornada laboral y fecha de ingreso",
    ],
  },
  { layout: "demo", title: "Gestión de Usuarios", icon: UserCog, demoRoute: "/admin/usuarios", demoLabel: "Abrir Admin" },

  /* Login */
  {
    layout: "feature",
    title: "Autenticación Segura",
    icon: Lock,
    bullets: [
      "Login con correo electrónico corporativo y contraseña",
      "Registro de nuevos usuarios con aprobación del administrador",
      "Control de acceso por departamento y rol",
      "Sesiones seguras con cierre automático por inactividad",
      "Interfaz limpia con identidad visual SafeOne",
    ],
  },
  { layout: "demo", title: "Pantalla de Login", icon: Lock, demoRoute: "/login", demoLabel: "Ver Login" },

  /* Chat */
  {
    layout: "feature",
    title: "Chat Corporativo",
    icon: MessageSquare,
    bullets: [
      "Mensajería instantánea entre empleados",
      "Cifrado end-to-end para comunicaciones seguras",
      "Indicadores de estado: en línea, ausente, ocupado",
      "Historial de conversaciones persistente",
      "Notificaciones en tiempo real de nuevos mensajes",
    ],
  },

  /* Botón de Pánico */
  {
    layout: "feature",
    title: "Botón de Pánico",
    icon: AlertTriangle,
    bullets: [
      "Botón de emergencia accesible desde cualquier pantalla",
      "Envío instantáneo de alerta al centro de operaciones",
      "Compartición automática de ubicación del usuario",
      "Notificación inmediata a supervisores y seguridad",
      "Registro de incidentes para seguimiento posterior",
    ],
  },

  /* General */
  {
    layout: "feature",
    title: "Sistema General",
    icon: Building2,
    bullets: [
      "Control operativo y administrativo centralizado",
      "Reportes de horas y rondas de seguridad",
      "Gestión de equipos y activos fijos",
      "Datos del personal operativo",
      "Integración con módulos de la intranet (Próximamente)",
    ],
  },
  { layout: "demo", title: "Sistema General", icon: Building2, demoRoute: "/general", demoLabel: "Ver General" },

  /* Adonis */
  {
    layout: "feature",
    title: "Sistema Adonis",
    icon: Calculator,
    bullets: [
      "Sistema contable y de nómina",
      "Facturación y cuentas por cobrar/pagar",
      "Reportes financieros y estados de cuenta",
      "Gestión presupuestaria por departamento",
      "Integración con módulos de la intranet (Próximamente)",
    ],
  },
  { layout: "demo", title: "Sistema Adonis", icon: Calculator, demoRoute: "/adonis", demoLabel: "Ver Adonis" },

  /* Seguridad */
  {
    layout: "feature",
    title: "Seguridad y Arquitectura",
    icon: Lock,
    bullets: [
      "Autenticación por correo electrónico con control de acceso por departamento",
      "Roles de usuario: Administrador y Usuario estándar",
      "Chat corporativo con cifrado end-to-end",
      "Botón de pánico para emergencias operativas",
      "Stack: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui",
    ],
  },

  /* Closing */
  {
    layout: "closing",
    title: "SafeOne Intranet",
    subtitle: "Transformando la gestión corporativa de seguridad",
    highlight: "Departamento de Tecnología y Monitoreo — 2025",
  },
];
