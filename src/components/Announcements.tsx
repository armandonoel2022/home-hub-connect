import { Megaphone, ArrowRight } from "lucide-react";

const announcements = [
  {
    date: "05 Mar 2026",
    title: "Actualización de políticas de seguridad",
    excerpt: "Se han actualizado los protocolos de seguridad para todos los turnos. Revisar el documento adjunto.",
    priority: true,
  },
  {
    date: "03 Mar 2026",
    title: "Mantenimiento programado del servidor",
    excerpt: "El servidor estará en mantenimiento el sábado 8 de marzo de 22:00 a 02:00.",
    priority: false,
  },
  {
    date: "01 Mar 2026",
    title: "Bienvenida a nuevos colaboradores",
    excerpt: "Damos la bienvenida al equipo de Operaciones a los nuevos oficiales que se integran este mes.",
    priority: false,
  },
];

const Announcements = () => (
  <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
    <div className="flex items-center gap-3 mb-8">
      <div className="w-1 h-8 rounded-full" style={{ background: "var(--gradient-gold)" }} />
      <h2 className="section-title text-foreground">Comunicados</h2>
    </div>
    <div className="grid gap-4">
      {announcements.map((a) => (
        <div key={a.title} className="card-department p-5 flex gap-4 items-start">
          <div className={`p-2 rounded-lg shrink-0 ${a.priority ? "bg-primary/15" : "bg-muted"}`}>
            <Megaphone className={`h-5 w-5 ${a.priority ? "text-gold" : "text-muted-foreground"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">{a.date}</span>
              {a.priority && (
                <span className="text-xs font-bold gold-accent-text uppercase tracking-wider">Importante</span>
              )}
            </div>
            <h3 className="font-heading font-bold text-card-foreground text-sm">{a.title}</h3>
            <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{a.excerpt}</p>
          </div>
          <button className="shrink-0 p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      ))}
    </div>
  </section>
);

export default Announcements;
