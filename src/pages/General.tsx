import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Building2, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const General = () => {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md space-y-6">
            <div className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "var(--gradient-dark)" }}>
              <Building2 className="h-10 w-10 text-secondary-foreground" />
            </div>
            <h1 className="font-heading text-3xl font-bold text-foreground">Sistema General</h1>
            <p className="text-muted-foreground">
              Control operativo y administrativo, reportes de horas, rondas de seguridad, gestión de equipos, activos fijos y datos del personal.
            </p>
            <div className="flex items-center justify-center gap-2 text-primary">
              <Construction className="h-5 w-5" />
              <span className="font-heading font-semibold">Próximamente</span>
            </div>
            <Button variant="outline" onClick={() => navigate("/")}>Volver al Inicio</Button>
          </div>
        </div>
        <Footer />
      </div>
    </AppLayout>
  );
};

export default General;
