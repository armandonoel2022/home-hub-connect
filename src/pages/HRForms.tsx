import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft, Printer, CalendarIcon, Palmtree, CalendarOff, UtensilsCrossed,
  UserX, PartyPopper, Clock, Banknote, CheckCircle2,
} from "lucide-react";
import safeOneLogo from "@/assets/safeone-logo.png";

type FormType = "vacaciones" | "dias-libres" | "comida" | "ausencias" | "feriados" | "permisos" | "prestamos";
type FormMode = "print" | "virtual";

const formConfig: { key: FormType; label: string; icon: any; color: string }[] = [
  { key: "vacaciones", label: "Vacaciones", icon: Palmtree, color: "hsl(160 60% 40%)" },
  { key: "dias-libres", label: "Días Libres", icon: CalendarOff, color: "hsl(200 70% 50%)" },
  { key: "comida", label: "Comida", icon: UtensilsCrossed, color: "hsl(30 80% 55%)" },
  { key: "ausencias", label: "Ausencias", icon: UserX, color: "hsl(0 60% 50%)" },
  { key: "feriados", label: "Días Feriados", icon: PartyPopper, color: "hsl(280 50% 50%)" },
  { key: "permisos", label: "Permisos", icon: Clock, color: "hsl(42 100% 50%)" },
  { key: "prestamos", label: "Solicitud de Préstamos", icon: Banknote, color: "hsl(220 15% 30%)" },
];

const HRForms = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeForm, setActiveForm] = useState<FormType | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleSelectForm = (key: FormType) => {
    setActiveForm(key);
    setFormMode(null);
  };

  const handleBack = () => {
    if (formMode) {
      setFormMode(null);
    } else if (activeForm) {
      setActiveForm(null);
      setFormMode(null);
    } else {
      navigate("/");
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full">
          <div className="flex items-center gap-3 mb-6 no-print">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">
                {activeForm ? formConfig.find(f => f.key === activeForm)?.label : "Recursos Humanos — Formularios"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {formMode === "print"
                  ? "Formulario para imprimir y firmar"
                  : formMode === "virtual"
                  ? "Aprobación virtual (próximamente con backend)"
                  : activeForm
                  ? "Seleccione modalidad"
                  : "Seleccione un formulario"}
              </p>
            </div>
          </div>

          {/* Step 1: Form selection */}
          {!activeForm && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {formConfig.map(fc => {
                const Icon = fc.icon;
                return (
                  <button
                    key={fc.key}
                    onClick={() => handleSelectForm(fc.key)}
                    className="group flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-card hover:border-primary transition-all text-left"
                  >
                    <div className="p-3 rounded-xl" style={{ background: fc.color + "22" }}>
                      <Icon className="h-6 w-6" style={{ color: fc.color }} />
                    </div>
                    <span className="font-heading font-bold text-card-foreground group-hover:text-primary transition-colors">
                      {fc.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Mode selection */}
          {activeForm && !formMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
              <button
                onClick={() => setFormMode("print")}
                className="group flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-border bg-card hover:border-primary transition-all"
              >
                <div className="p-4 rounded-xl bg-muted">
                  <Printer className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-center">
                  <span className="font-heading font-bold text-card-foreground group-hover:text-primary transition-colors block">
                    Imprimir para Firmar
                  </span>
                  <span className="text-xs text-muted-foreground mt-1 block">
                    Genera el formulario con membrete para firma física
                  </span>
                </div>
              </button>
              <button
                onClick={() => setFormMode("virtual")}
                className="group flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-border bg-card hover:border-primary transition-all"
              >
                <div className="p-4 rounded-xl bg-muted">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-center">
                  <span className="font-heading font-bold text-card-foreground group-hover:text-primary transition-colors block">
                    Aprobación Virtual
                  </span>
                  <span className="text-xs text-muted-foreground mt-1 block">
                    Envía para aprobación del supervisor y RRHH
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Step 3: Form */}
          {activeForm && formMode === "print" && (
            <div className="space-y-4">
              <div className="flex justify-end no-print">
                <Button onClick={handlePrint} className="gap-2">
                  <Printer className="h-4 w-4" /> Imprimir
                </Button>
              </div>
              <div ref={printRef} className="print-area bg-card rounded-xl border border-border p-8">
                {/* Print header with logo */}
                <div className="text-center mb-6 border-b border-border pb-4">
                  <img src={safeOneLogo} alt="SafeOne" className="h-12 mx-auto mb-2" />
                  <h2 className="text-xl font-heading font-bold text-card-foreground">SafeOne Group — Recursos Humanos</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formConfig.find(f => f.key === activeForm)?.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fecha de generación: {format(new Date(), "dd/MM/yyyy")}
                  </p>
                </div>
                <RenderForm formType={activeForm} userName={user?.fullName || ""} department={user?.department || ""} />
              </div>
            </div>
          )}

          {activeForm && formMode === "virtual" && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-card rounded-xl border border-border p-8">
                <div className="text-center mb-6 border-b border-border pb-4">
                  <img src={safeOneLogo} alt="SafeOne" className="h-12 mx-auto mb-2" />
                  <h2 className="text-xl font-heading font-bold text-card-foreground">
                    {formConfig.find(f => f.key === activeForm)?.label}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">Aprobación Virtual</p>
                </div>
                <RenderForm formType={activeForm} userName={user?.fullName || ""} department={user?.department || ""} showSignature={false} />
                <div className="mt-6 pt-4 border-t border-border">
                  <Button className="w-full gap-2" disabled>
                    <CheckCircle2 className="h-4 w-4" />
                    Enviar para Aprobación (próximamente)
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Esta funcionalidad estará disponible cuando se active el backend. La solicitud será enviada al supervisor inmediato y a RRHH para aprobación.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        <Footer />
      </div>
    </AppLayout>
  );
};
