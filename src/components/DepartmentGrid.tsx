import {
  Building2,
  Briefcase,
  TrendingUp,
  Headphones,
  CheckCircle,
  DollarSign,
  Calculator,
  Monitor,
  Settings,
} from "lucide-react";

const departments = [
  { name: "Administración", icon: Building2, description: "Gestión administrativa y recursos", color: "42 100% 50%" },
  { name: "Gerencia General", icon: Briefcase, description: "Dirección y estrategia corporativa", color: "220 15% 30%" },
  { name: "Gerencia Comercial", icon: TrendingUp, description: "Ventas y desarrollo de negocio", color: "160 60% 40%" },
  { name: "Servicio al Cliente", icon: Headphones, description: "Atención y soporte al cliente", color: "200 70% 50%" },
  { name: "Calidad", icon: CheckCircle, description: "Control y aseguramiento de calidad", color: "280 50% 50%" },
  { name: "Cuentas por Cobrar", icon: DollarSign, description: "Gestión de cobros y facturación", color: "15 80% 55%" },
  { name: "Contabilidad", icon: Calculator, description: "Finanzas y registros contables", color: "340 60% 50%" },
  { name: "Tecnología y Monitoreo", icon: Monitor, description: "Sistemas, CCTV y monitoreo", color: "190 70% 45%" },
  { name: "Operaciones", icon: Settings, description: "Logística y operaciones de campo", color: "100 50% 40%" },
];

const DepartmentGrid = () => {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-1 h-8 rounded-full" style={{ background: "var(--gradient-gold)" }} />
        <h2 className="section-title text-foreground">Departamentos</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {departments.map((dept) => {
          const Icon = dept.icon;
          return (
            <div key={dept.name} className="card-department group" id={`dept-${dept.name.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="h-1 w-full" style={{ background: `hsl(${dept.color})` }} />
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div
                    className="p-3 rounded-xl transition-transform duration-300 group-hover:scale-110"
                    style={{ background: `hsla(${dept.color}, 0.1)` }}
                  >
                    <Icon className="h-6 w-6" style={{ color: `hsl(${dept.color})` }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-heading font-bold text-card-foreground text-base">{dept.name}</h3>
                    <p className="text-muted-foreground text-sm mt-1">{dept.description}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold gold-accent-text opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Acceder al departamento</span>
                  <span>→</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default DepartmentGrid;
