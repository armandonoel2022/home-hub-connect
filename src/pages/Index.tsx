import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import HeroBanner from "@/components/HeroBanner";
import DepartmentGrid from "@/components/DepartmentGrid";
import QuickLinks from "@/components/QuickLinks";
import Announcements from "@/components/Announcements";
import { GraduationCap } from "lucide-react";
import DashboardMetrics from "@/components/DashboardMetrics";
import Footer from "@/components/Footer";
import { LifeBuoy, Users } from "lucide-react";
 
const Index = () => {
  const navigate = useNavigate();

  const requestButtons = [
    {
      label: "Solicitud a IT",
      sublabel: "Tickets / Service Request",
      icon: LifeBuoy,
      to: "/tickets",
      gradient: "linear-gradient(135deg, hsl(210 80% 45%), hsl(210 80% 30%))",
    },
    {
      label: "Solicitud a RRHH",
      sublabel: "Vacaciones, permisos, préstamos",
      icon: Users,
      to: "/rrhh/formularios",
      gradient: "linear-gradient(135deg, hsl(42 95% 50%), hsl(30 90% 40%))",
    },
    {
      label: "Capacitaciones",
      sublabel: "Cursos, charlas y entrenamientos",
      icon: GraduationCap,
      to: "/capacitaciones",
      gradient: "linear-gradient(135deg, hsl(160 60% 40%), hsl(160 60% 28%))",
    },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <HeroBanner />

        {/* Quick Request Buttons */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full pt-8 pb-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {requestButtons.map((b) => {
              const Icon = b.icon;
              return (
                <button
                  key={b.to}
                  onClick={() => navigate(b.to)}
                  className="group flex items-center gap-3 px-5 py-4 rounded-xl text-left text-white transition-all hover:brightness-110 hover:-translate-y-0.5 shadow-md"
                  style={{ background: b.gradient }}
                >
                  <div className="p-2.5 rounded-lg bg-white/15 group-hover:bg-white/25 transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-sm leading-tight">{b.label}</p>
                    <p className="text-[11px] opacity-90 truncate">{b.sublabel}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Real-time Metrics */}
        <DashboardMetrics />

        <DepartmentGrid />
        <QuickLinks />
        <Announcements />
        <Footer />
      </div>
    </AppLayout>
  );
};

export default Index;
