import { FileText, Calendar, Mail, FolderOpen, ClipboardList, BookOpen } from "lucide-react";

const links = [
  { icon: FolderOpen, label: "Archivos Compartidos", desc: "Accede a los documentos del servidor" },
  { icon: Calendar, label: "Calendario", desc: "Eventos y reuniones programadas" },
  { icon: Mail, label: "Comunicados", desc: "Noticias y avisos internos" },
  { icon: FileText, label: "Formularios", desc: "Solicitudes y formatos internos" },
  { icon: ClipboardList, label: "Procedimientos", desc: "Manuales y guías de procesos" },
  { icon: BookOpen, label: "Directorio", desc: "Contactos del personal" },
];

const QuickLinks = () => (
  <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
    <div className="flex items-center gap-3 mb-8">
      <div className="w-1 h-8 rounded-full" style={{ background: "var(--gradient-gold)" }} />
      <h2 className="section-title text-foreground">Accesos Rápidos</h2>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {links.map(({ icon: Icon, label, desc }) => (
        <div
          key={label}
          className="card-department flex flex-col items-center text-center p-5 group"
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

export default QuickLinks;
