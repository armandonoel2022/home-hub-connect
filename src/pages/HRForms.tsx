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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  ArrowLeft, Printer, CalendarIcon, Palmtree, CalendarOff, UtensilsCrossed,
  UserX, PartyPopper, Clock, Banknote, CheckCircle2,
} from "lucide-react";
import safeOneLogo from "@/assets/safeone-logo.png";
import safeOneLetterhead from "@/assets/safeone-letterhead.png";

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
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Formulario RRHH</title><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; }
      img { max-height: 56px; display: block; margin: 0 auto 8px; }
      .print-header { text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 16px; margin-bottom: 24px; }
      .print-header h2 { font-size: 18px; font-weight: 700; }
      .print-header p { font-size: 13px; color: #666; margin-top: 4px; }
      label { font-size: 13px; font-weight: 600; display: block; margin-bottom: 4px; }
      input, textarea, select, [data-radix-select-trigger] { 
        width: 100%; border: 1px solid #ccc; border-radius: 6px; padding: 8px 10px; font-size: 13px; background: #fff; 
      }
      textarea { min-height: 60px; resize: vertical; }
      .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .form-field { margin-bottom: 14px; }
      .sig-block { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 24px; border-top: 1px solid #ddd; }
      .sig-block div { text-align: center; }
      .sig-line { border-bottom: 1px solid #333; height: 60px; margin-bottom: 8px; }
      .sig-label { font-size: 12px; color: #666; }
      .footer { text-align: center; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 12px; margin-top: 24px; }
      button { display: none !important; }
      @media print { body { padding: 20px; } }
    </style></head><body>${content.innerHTML}
    <div class="footer">
      <p>Tel: 809.548.3100 • info@safeone.com.do • www.safeone.com.do | RNC: 101526752</p>
      <p>C/ Olof Palme esq. Cul de Sac 2, San Gerónimo, Santo Domingo, D.N.</p>
    </div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const handleBack = () => {
    if (formMode) { setFormMode(null); }
    else if (activeForm) { setActiveForm(null); }
    else { navigate("/"); }
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
                {formMode === "print" ? "Formulario para imprimir y firmar"
                  : formMode === "virtual" ? "Aprobación virtual (próximamente)"
                  : activeForm ? "Seleccione modalidad"
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
                  <button key={fc.key} onClick={() => { setActiveForm(fc.key); setFormMode(null); }}
                    className="group flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-card hover:border-primary transition-all text-left">
                    <div className="p-3 rounded-xl" style={{ background: fc.color + "22" }}>
                      <Icon className="h-6 w-6" style={{ color: fc.color }} />
                    </div>
                    <span className="font-heading font-bold text-card-foreground group-hover:text-primary transition-colors">{fc.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Mode selection */}
          {activeForm && !formMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
              <button onClick={() => setFormMode("print")}
                className="group flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-border bg-card hover:border-primary transition-all">
                <div className="p-4 rounded-xl bg-muted">
                  <Printer className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-center">
                  <span className="font-heading font-bold text-card-foreground group-hover:text-primary transition-colors block">Imprimir para Firmar</span>
                  <span className="text-xs text-muted-foreground mt-1 block">Genera el formulario con membrete para firma física</span>
                </div>
              </button>
              <button onClick={() => setFormMode("virtual")}
                className="group flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-border bg-card hover:border-primary transition-all">
                <div className="p-4 rounded-xl bg-muted">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-center">
                  <span className="font-heading font-bold text-card-foreground group-hover:text-primary transition-colors block">Aprobación Virtual</span>
                  <span className="text-xs text-muted-foreground mt-1 block">Envía para aprobación del supervisor y RRHH</span>
                </div>
              </button>
            </div>
          )}

          {/* Step 3a: Print mode */}
          {activeForm && formMode === "print" && (
            <div className="space-y-4">
              <div className="flex justify-end no-print">
                <Button onClick={handlePrint} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
              </div>
              <div ref={printRef} className="print-area bg-card rounded-xl border border-border p-8">
                <PrintHeader title={formConfig.find(f => f.key === activeForm)?.label || ""} />
                <RenderForm formType={activeForm} userName={user?.fullName || ""} department={user?.department || ""} />
              </div>
              <PrintFooter />
            </div>
          )}

          {/* Step 3b: Virtual mode */}
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
                    <CheckCircle2 className="h-4 w-4" /> Enviar para Aprobación (próximamente)
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

// ── Print header with SafeOne branding ──
function PrintHeader({ title }: { title: string }) {
  return (
    <div className="text-center mb-6 border-b border-border pb-4 print-header">
      <img src={safeOneLogo} alt="SafeOne" className="h-14 mx-auto mb-2" />
      <h2 className="text-xl font-heading font-bold text-card-foreground">SafeOne Group — Recursos Humanos</h2>
      <p className="text-sm text-muted-foreground mt-1">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">Fecha de generación: {format(new Date(), "dd/MM/yyyy")}</p>
    </div>
  );
}

// ── Print footer with company info ──
function PrintFooter() {
  return (
    <div className="hidden print-footer-block text-center text-xs text-muted-foreground border-t border-border pt-3 mt-6">
      <p>Tel: 809.548.3100 • info@safeone.com.do • www.safeone.com.do &nbsp;|&nbsp; RNC: 101526752</p>
      <p>C/ Olof Palme esq. Cul de Sac 2, San Gerónimo, Santo Domingo, D.N.</p>
    </div>
  );
}

// ── Form router ──
function RenderForm({ formType, userName, department, showSignature = true }: { formType: FormType; userName: string; department: string; showSignature?: boolean }) {
  switch (formType) {
    case "vacaciones": return <VacationForm userName={userName} department={department} showSignature={showSignature} />;
    case "dias-libres": return <DaysOffForm userName={userName} department={department} showSignature={showSignature} />;
    case "comida": return <MealForm userName={userName} department={department} showSignature={showSignature} />;
    case "ausencias": return <AbsenceForm userName={userName} department={department} showSignature={showSignature} />;
    case "feriados": return <HolidaysForm />;
    case "permisos": return <PermissionsForm userName={userName} department={department} showSignature={showSignature} />;
    case "prestamos": return <LoanForm userName={userName} department={department} showSignature={showSignature} />;
    default: return null;
  }
}

// ── Helpers ──
function FormField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-semibold text-card-foreground">{label}</Label>
      {children}
    </div>
  );
}

function DatePickerField({ label, date, setDate }: { label: string; date: Date | undefined; setDate: (d: Date | undefined) => void }) {
  return (
    <FormField label={label}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "dd/MM/yyyy") : "Seleccionar fecha"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </FormField>
  );
}

function SignatureBlock() {
  return (
    <div className="grid grid-cols-2 gap-8 mt-10 pt-6 border-t border-border">
      <div className="text-center">
        <div className="border-b border-foreground w-full mb-2 h-16" />
        <p className="text-sm text-muted-foreground">Firma del Solicitante</p>
      </div>
      <div className="text-center">
        <div className="border-b border-foreground w-full mb-2 h-16" />
        <p className="text-sm text-muted-foreground">Firma del Supervisor / RRHH</p>
      </div>
    </div>
  );
}

// ── Vacation form ──
function VacationForm({ userName, department, showSignature }: { userName: string; department: string; showSignature: boolean }) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre del Empleado"><Input defaultValue={userName} /></FormField>
        <FormField label="Departamento"><Input defaultValue={department} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DatePickerField label="Fecha de Inicio" date={startDate} setDate={setStartDate} />
        <DatePickerField label="Fecha de Fin" date={endDate} setDate={setEndDate} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Días Solicitados"><Input type="number" min={1} placeholder="Ej: 5" /></FormField>
        <FormField label="Días Disponibles"><Input type="number" placeholder="Según registros" /></FormField>
      </div>
      <FormField label="Motivo / Observaciones"><Textarea placeholder="Describa el motivo de sus vacaciones..." rows={3} /></FormField>
      <FormField label="Contacto durante Vacaciones"><Input placeholder="Teléfono o email de contacto" /></FormField>
      {showSignature && <SignatureBlock />}
    </div>
  );
}

// ── Days off form ──
function DaysOffForm({ userName, department, showSignature }: { userName: string; department: string; showSignature: boolean }) {
  const [date, setDate] = useState<Date>();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre del Empleado"><Input defaultValue={userName} /></FormField>
        <FormField label="Departamento"><Input defaultValue={department} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DatePickerField label="Fecha del Día Libre" date={date} setDate={setDate} />
        <FormField label="Tipo de Día Libre">
          <Select><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="compensatorio">Compensatorio</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="medico">Médico</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="Justificación"><Textarea placeholder="Motivo del día libre..." rows={3} /></FormField>
      {showSignature && <SignatureBlock />}
    </div>
  );
}

// ── Meal form ──
function MealForm({ userName, department, showSignature }: { userName: string; department: string; showSignature: boolean }) {
  const [date, setDate] = useState<Date>();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre del Empleado"><Input defaultValue={userName} /></FormField>
        <FormField label="Departamento"><Input defaultValue={department} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DatePickerField label="Fecha" date={date} setDate={setDate} />
        <FormField label="Tipo de Comida">
          <Select><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="almuerzo">Almuerzo</SelectItem>
              <SelectItem value="cena">Cena</SelectItem>
              <SelectItem value="merienda">Merienda</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="Cantidad de Personas"><Input type="number" min={1} defaultValue={1} /></FormField>
      <FormField label="Observaciones"><Textarea placeholder="Preferencias alimentarias, alergias, etc." rows={3} /></FormField>
      {showSignature && <SignatureBlock />}
    </div>
  );
}

// ── Absence form ──
function AbsenceForm({ userName, department, showSignature }: { userName: string; department: string; showSignature: boolean }) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre del Empleado"><Input defaultValue={userName} /></FormField>
        <FormField label="Departamento"><Input defaultValue={department} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DatePickerField label="Fecha de Inicio" date={startDate} setDate={setStartDate} />
        <DatePickerField label="Fecha de Fin" date={endDate} setDate={setEndDate} />
      </div>
      <FormField label="Motivo de Ausencia">
        <Select><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="enfermedad">Enfermedad</SelectItem>
            <SelectItem value="emergencia-familiar">Emergencia Familiar</SelectItem>
            <SelectItem value="cita-medica">Cita Médica</SelectItem>
            <SelectItem value="duelo">Duelo</SelectItem>
            <SelectItem value="otro">Otro</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Descripción"><Textarea placeholder="Detalle de la ausencia..." rows={3} /></FormField>
      <FormField label="¿Tiene soporte médico o documental?">
        <Select><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="si">Sí</SelectItem>
            <SelectItem value="no">No</SelectItem>
            <SelectItem value="pendiente">Pendiente de entrega</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      {showSignature && <SignatureBlock />}
    </div>
  );
}

// ── Holidays form ──
function HolidaysForm() {
  const holidays = [
    { date: "01 de Enero", name: "Año Nuevo" },
    { date: "06 de Enero", name: "Día de los Santos Reyes" },
    { date: "21 de Enero", name: "Día de la Altagracia" },
    { date: "26 de Enero", name: "Día de Duarte" },
    { date: "27 de Febrero", name: "Día de la Independencia" },
    { date: "Marzo/Abril", name: "Viernes Santo" },
    { date: "01 de Mayo", name: "Día del Trabajo" },
    { date: "Junio", name: "Corpus Christi" },
    { date: "16 de Agosto", name: "Día de la Restauración" },
    { date: "24 de Septiembre", name: "Día de la Virgen de las Mercedes" },
    { date: "06 de Noviembre", name: "Día de la Constitución" },
    { date: "25 de Diciembre", name: "Navidad" },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Calendario oficial de días feriados no laborables — República Dominicana {new Date().getFullYear()}
      </p>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="text-left px-4 py-3 font-semibold text-card-foreground">Fecha</th>
              <th className="text-left px-4 py-3 font-semibold text-card-foreground">Día Feriado</th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((h, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-2.5 text-muted-foreground">{h.date}</td>
                <td className="px-4 py-2.5 text-card-foreground font-medium">{h.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Permissions form ──
function PermissionsForm({ userName, department, showSignature }: { userName: string; department: string; showSignature: boolean }) {
  const [date, setDate] = useState<Date>();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre del Empleado"><Input defaultValue={userName} /></FormField>
        <FormField label="Departamento"><Input defaultValue={department} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DatePickerField label="Fecha del Permiso" date={date} setDate={setDate} />
        <FormField label="Tipo de Permiso">
          <Select><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="llegada-tarde">Llegada Tarde</SelectItem>
              <SelectItem value="salida-temprano">Salida Temprano</SelectItem>
              <SelectItem value="ausencia-parcial">Ausencia Parcial</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="medico">Médico</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Hora de Salida"><Input type="time" /></FormField>
        <FormField label="Hora de Regreso (estimada)"><Input type="time" /></FormField>
      </div>
      <FormField label="Motivo"><Textarea placeholder="Describa el motivo del permiso..." rows={3} /></FormField>
      {showSignature && <SignatureBlock />}
    </div>
  );
}

// ── Loan form ──
function LoanForm({ userName, department, showSignature }: { userName: string; department: string; showSignature: boolean }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre del Empleado"><Input defaultValue={userName} /></FormField>
        <FormField label="Departamento"><Input defaultValue={department} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Monto Solicitado (RD$)"><Input type="number" min={0} placeholder="Ej: 15,000" /></FormField>
        <FormField label="Plazo de Pago">
          <Select><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Mes</SelectItem>
              <SelectItem value="2">2 Meses</SelectItem>
              <SelectItem value="3">3 Meses</SelectItem>
              <SelectItem value="6">6 Meses</SelectItem>
              <SelectItem value="12">12 Meses</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="Modalidad de Descuento">
        <Select><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="quincenal">Quincenal</SelectItem>
            <SelectItem value="mensual">Mensual</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Motivo del Préstamo"><Textarea placeholder="Describa para qué necesita el préstamo..." rows={3} /></FormField>
      <FormField label="Antigüedad en la Empresa"><Input placeholder="Ej: 2 años y 3 meses" /></FormField>
      {showSignature && <SignatureBlock />}
    </div>
  );
}

export default HRForms;
