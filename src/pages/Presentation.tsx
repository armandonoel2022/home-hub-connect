import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  LayoutDashboard,
  Ticket,
  Package,
  Truck,
  Smartphone,
  Shield,
  ShoppingCart,
  Users,
  FileCheck,
  Phone,
  Calendar,
  FolderOpen,
  BookOpen,
  TrendingUp,
  ClipboardList,
  BookMarked,
  CheckSquare,
  Wallet,
  UserCog,
  MessageSquare,
  Bell,
  Search,
  FileText,
  Monitor,
  Radio,
  Building2,
  Lock,
  type LucideIcon,
} from "lucide-react";
import logo from "@/assets/safeone-logo.png";
import building from "@/assets/safeone-building.jpeg";

/* ─── Slide data ─── */
interface Slide {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  bullets?: string[];
  highlight?: string;
  layout: "cover" | "feature" | "grid" | "closing";
  gridItems?: { icon: LucideIcon; label: string; desc: string }[];
}

const slides: Slide[] = [
  {
    layout: "cover",
    title: "SafeOne Intranet Corporativa",
    subtitle: "Plataforma integral de gestión operativa, administrativa y tecnológica",
    highlight: "Departamento de Tecnología y Monitoreo",
  },
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
  {
    layout: "feature",
    title: "Flotilla Vehicular y Celular",
    icon: Truck,
    bullets: [
      "Gestión completa de vehículos: placa, marca, modelo, kilometraje",
      "Control de dispositivos móviles: IMEI, serial, número telefónico",
      "Estados de activos: Activo, Disponible, En Reparación, Dado de Baja",
      "Asignación por empleado con historial de cambios",
      "Seguimiento de mantenimiento y vencimientos",
    ],
  },
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
  {
    layout: "grid",
    title: "Herramientas Adicionales",
    subtitle: "Productividad, comunicación y gestión del conocimiento",
    gridItems: [
      { icon: Phone, label: "Directorio", desc: "Extensiones y contactos internos" },
      { icon: Calendar, label: "Calendario", desc: "Eventos y fechas importantes" },
      { icon: FolderOpen, label: "Archivos", desc: "Documentos compartidos" },
      { icon: BookOpen, label: "Procedimientos", desc: "SOPs y manuales" },
      { icon: BookMarked, label: "Wiki", desc: "Base de conocimiento" },
      { icon: ClipboardList, label: "Encuestas", desc: "Evaluaciones internas" },
      { icon: MessageSquare, label: "Chat", desc: "Mensajería encriptada" },
      { icon: Search, label: "Búsqueda", desc: "Búsqueda global unificada" },
      { icon: Bell, label: "Notificaciones", desc: "Alertas en tiempo real" },
      { icon: Monitor, label: "Monitoreo", desc: "Centro de monitoreo" },
      { icon: Radio, label: "Operaciones", desc: "Centro de operaciones" },
      { icon: UserCog, label: "Admin", desc: "Gestión de usuarios y roles" },
    ],
  },
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
  {
    layout: "closing",
    title: "SafeOne Intranet",
    subtitle: "Transformando la gestión corporativa de seguridad",
    highlight: "Departamento de Tecnología y Monitoreo — 2025",
  },
];

/* ─── Component ─── */
const Presentation = () => {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const total = slides.length;

  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, total - 1)), [total]);
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape" && isFullscreen) toggleFullscreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, isFullscreen]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const slide = slides[current];

  return (
    <div className={`min-h-screen flex flex-col ${isFullscreen ? "bg-[hsl(220,20%,8%)]" : "bg-background"}`}>
      {/* Toolbar */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <img src={logo} alt="SafeOne" className="h-8" />
            <span className="font-heading font-bold text-sm text-foreground">
              Presentación del Proyecto
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {current + 1} / {total}
            </span>
            <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground">
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Slide area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden select-none">
        {/* Navigation zones */}
        <button onClick={prev} className="absolute left-0 top-0 bottom-0 w-20 z-10 flex items-center justify-start pl-4 opacity-0 hover:opacity-100 transition-opacity" aria-label="Previous">
          <ChevronLeft className="h-8 w-8 text-muted-foreground" />
        </button>
        <button onClick={next} className="absolute right-0 top-0 bottom-0 w-20 z-10 flex items-center justify-end pr-4 opacity-0 hover:opacity-100 transition-opacity" aria-label="Next">
          <ChevronRight className="h-8 w-8 text-muted-foreground" />
        </button>

        {/* Slide content */}
        <div className="w-full max-w-5xl mx-auto px-8">
          {slide.layout === "cover" && <CoverSlide slide={slide} />}
          {slide.layout === "feature" && <FeatureSlide slide={slide} />}
          {slide.layout === "grid" && <GridSlide slide={slide} />}
          {slide.layout === "closing" && <ClosingSlide slide={slide} />}
        </div>

        {/* Fullscreen controls */}
        {isFullscreen && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[hsl(220,15%,15%)] rounded-full px-6 py-2 opacity-0 hover:opacity-100 transition-opacity">
            <button onClick={prev} className="text-[hsl(0,0%,70%)] hover:text-[hsl(0,0%,100%)] transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm text-[hsl(0,0%,70%)]">{current + 1} / {total}</span>
            <button onClick={next} className="text-[hsl(0,0%,70%)] hover:text-[hsl(0,0%,100%)] transition-colors">
              <ChevronRight className="h-5 w-5" />
            </button>
            <button onClick={toggleFullscreen} className="text-[hsl(0,0%,70%)] hover:text-[hsl(0,0%,100%)] transition-colors ml-2">
              <Minimize className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {!isFullscreen && (
        <div className="border-t border-border bg-card px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {slides.map((s, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`shrink-0 w-24 h-14 rounded-md border-2 transition-all flex items-center justify-center text-[8px] font-medium px-1 text-center leading-tight ${
                  i === current
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                }`}
              >
                {s.title.length > 25 ? s.title.slice(0, 25) + "…" : s.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Slide layouts ─── */
const CoverSlide = ({ slide }: { slide: Slide }) => (
  <div className="text-center py-16 relative">
    <div className="absolute inset-0 opacity-5 bg-cover bg-center rounded-3xl" style={{ backgroundImage: `url(${building})` }} />
    <div className="relative z-10">
      <img src={logo} alt="SafeOne" className="h-20 mx-auto mb-8" />
      <h1 className="font-heading font-black text-5xl md:text-6xl text-foreground mb-4 tracking-tight">
        Safe<span className="text-primary">One</span>
      </h1>
      <h2 className="font-heading text-2xl md:text-3xl text-foreground/80 mb-6">{slide.title}</h2>
      <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">{slide.subtitle}</p>
      <div className="inline-block px-6 py-2 rounded-full bg-primary/10 border border-primary/30">
        <span className="text-sm font-semibold text-primary">{slide.highlight}</span>
      </div>
    </div>
  </div>
);

const FeatureSlide = ({ slide }: { slide: Slide }) => {
  const Icon = slide.icon!;
  return (
    <div className="py-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <h2 className="font-heading font-bold text-3xl md:text-4xl text-foreground">{slide.title}</h2>
      </div>
      <ul className="space-y-4 ml-2">
        {slide.bullets?.map((b, i) => (
          <li key={i} className="flex items-start gap-4">
            <div className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />
            <span className="text-lg text-foreground/85 leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const GridSlide = ({ slide }: { slide: Slide }) => (
  <div className="py-10">
    <h2 className="font-heading font-bold text-3xl md:text-4xl text-foreground text-center mb-2">{slide.title}</h2>
    {slide.subtitle && <p className="text-muted-foreground text-center mb-8">{slide.subtitle}</p>}
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {slide.gridItems?.map((item, i) => (
        <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <item.icon className="h-5 w-5 text-primary" />
          </div>
          <span className="font-heading font-semibold text-sm text-foreground">{item.label}</span>
          <span className="text-xs text-muted-foreground text-center">{item.desc}</span>
        </div>
      ))}
    </div>
  </div>
);

const ClosingSlide = ({ slide }: { slide: Slide }) => (
  <div className="text-center py-20 relative">
    <div className="absolute inset-0 opacity-5 bg-cover bg-center rounded-3xl" style={{ backgroundImage: `url(${building})` }} />
    <div className="relative z-10">
      <img src={logo} alt="SafeOne" className="h-16 mx-auto mb-6" />
      <h2 className="font-heading font-black text-4xl md:text-5xl text-foreground mb-4">
        {slide.title}
      </h2>
      <p className="text-xl text-muted-foreground mb-8">{slide.subtitle}</p>
      <div className="inline-block px-6 py-2 rounded-full bg-primary/10 border border-primary/30">
        <span className="text-sm font-semibold text-primary">{slide.highlight}</span>
      </div>
      <p className="mt-10 text-sm text-muted-foreground">
        SafeOne Security Company — RNC 101526752
      </p>
    </div>
  </div>
);

export default Presentation;
