import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Calendar, Mail, FolderOpen, ClipboardList, BookOpen, BarChart3, Shield, ListChecks } from "lucide-react";

const QuickLinks = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const links = [
    { icon: FolderOpen, label: "Archivos", desc: "Documentos del servidor", route: "/archivos" },
    { icon: Calendar, label: "Calendario", desc: "Eventos y reuniones", route: "/calendario" },
    { icon: ListChecks, label: "Procesos", desc: "Matriz de procesos", route: "/procesos" },
    { icon: BarChart3, label: "Reportes", desc: "Exportar PDF / Excel", route: "/reportes" },
    { icon: ClipboardList, label: "Procedimientos", desc: "Manuales y guías", route: "/procedimientos" },
    { icon: BookOpen, label: "Directorio", desc: "Contactos del personal", route: "/directorio" },
  ];

  // Admin-only links
  if (user?.isAdmin) {
    links.push({ icon: Shield, label: "Auditoría", desc: "Log de acciones", route: "/auditoria" });
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-1 h-8 rounded-full" style={{ background: "var(--gradient-gold)" }} />
        <h2 className="section-title text-foreground">Accesos Rápidos</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        {links.map(({ icon: Icon, label, desc, route }) => (
          <div
            key={label}
            onClick={() => navigate(route)}
            className="card-department flex flex-col items-center text-center p-5 group cursor-pointer"
          >
            <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/10 transition-colors mb-3">
              <Icon className="h-6 w-6 text-muted-foreground group-hover:text-gold transition-colors" />
            </div>
            <span className="font-heading font-semibold text-sm text-card-foreground">{label}</span>
            <span className="text-xs text-muted-foreground mt-1 hidden sm:block">{desc}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default QuickLinks;
