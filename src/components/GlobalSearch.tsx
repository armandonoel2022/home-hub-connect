import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Search, X, User, Ticket, Package, Truck, FileText, BookOpen, Phone, Building2 } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: "usuario" | "modulo" | "contacto";
  icon: React.ElementType;
  url: string;
}

const MODULE_MAP: { label: string; url: string; icon: React.ElementType; departments?: string[] }[] = [
  { label: "Dashboard", url: "/", icon: Building2 },
  { label: "KPIs", url: "/kpis", icon: Building2 },
  { label: "Tareas", url: "/tareas", icon: FileText },
  { label: "Directorio", url: "/directorio", icon: Phone },
  { label: "Calendario", url: "/calendario", icon: FileText },
  { label: "Tickets IT", url: "/tickets", icon: Ticket, departments: ["Tecnología y Monitoreo"] },
  { label: "Inventario IT", url: "/inventario", icon: Package, departments: ["Tecnología y Monitoreo"] },
  { label: "Flotilla Vehicular", url: "/flotilla", icon: Truck, departments: ["Operaciones", "Administración"] },
  { label: "Flota Celular", url: "/flota-celular", icon: Phone, departments: ["Tecnología y Monitoreo"] },
  { label: "Personal Armado", url: "/operaciones", icon: User, departments: ["Operaciones"] },
  { label: "Solicitudes de Compra", url: "/solicitudes-compra", icon: FileText },
  { label: "Solicitudes de Personal", url: "/solicitudes-personal", icon: User },
  { label: "BASC", url: "/basc", icon: FileText, departments: ["Calidad"] },
  { label: "Archivos Compartidos", url: "/archivos", icon: FileText },
  { label: "Procedimientos", url: "/procedimientos", icon: BookOpen },
  { label: "Wiki", url: "/wiki", icon: BookOpen },
  { label: "Encuestas", url: "/encuestas", icon: FileText, departments: ["Recursos Humanos"] },
  { label: "Gestión de Usuarios", url: "/admin/usuarios", icon: User },
];

export default function GlobalSearch() {
  const { user, allUsers, hasAccess } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim() || !user) return [];
    const q = query.toLowerCase();
    const items: SearchResult[] = [];

    // Modules — filtered by access
    MODULE_MAP.forEach((m) => {
      if (m.url === "/admin/usuarios" && !user.isAdmin) return;
      if (m.departments && !user.isAdmin) {
        const hasAny = m.departments.some((d) => hasAccess(d));
        if (!hasAny) return;
      }
      if (m.label.toLowerCase().includes(q)) {
        items.push({ id: m.url, title: m.label, subtitle: "Módulo", type: "modulo", icon: m.icon, url: m.url });
      }
    });

    // Users — only show users from departments the current user has access to
    allUsers.forEach((u) => {
      if (!user.isAdmin && !hasAccess(u.department)) return;
      const match =
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.position.toLowerCase().includes(q) ||
        (u.extension || "").includes(q);
      if (match) {
        items.push({
          id: u.id,
          title: u.fullName,
          subtitle: `${u.position} — ${u.department}`,
          type: "contacto",
          icon: User,
          url: "/directorio",
        });
      }
    });

    return items.slice(0, 12);
  }, [query, user, allUsers, hasAccess]);

  if (!user) return null;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-charcoal-light text-muted-foreground text-sm hover:text-secondary-foreground transition-colors w-full max-w-xs"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate">Buscar...</span>
        <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-charcoal-dark text-muted-foreground font-mono">
          Ctrl+K
        </kbd>
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-start justify-center pt-[15vh] p-4" onClick={() => setOpen(false)}>
          <div className="bg-card rounded-xl w-full max-w-lg shadow-2xl border border-border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="h-5 w-5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar módulos, contactos..."
                className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground"
              />
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {query.trim() && (
              <div className="max-h-80 overflow-y-auto py-2">
                {results.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin resultados para "{query}"</p>
                ) : (
                  results.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        navigate(r.url);
                        setOpen(false);
                        setQuery("");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 text-left transition-colors"
                    >
                      <r.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                      </div>
                      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                        {r.type}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {!query.trim() && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Escribe para buscar módulos o contactos
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
