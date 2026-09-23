import {
  Printer, Wifi, MoveRight, Laptop, FolderTree, UserPlus, UserMinus, Mail, AppWindow,
  Cpu, Truck, LifeBuoy, Inbox, UserCheck, Loader2, Pause, CheckCircle2, XCircle,
  type LucideIcon,
} from "lucide-react";
import type { TicketStatus } from "@/lib/types";
import { normalizeStatus } from "@/lib/ticketWorkflow";

interface CatVisual { icon: LucideIcon; label: string; tone: string }

/** Detecta el tipo visual del ticket por su categoría (incluye categorías anteriores). */
export function categoryVisual(category: string = ""): CatVisual {
  const c = category.toLowerCase();
  if (/impres/.test(c)) return { icon: Printer, label: "Impresora", tone: "bg-primary/15 text-primary" };
  if (/carpeta/.test(c)) return { icon: FolderTree, label: "Carpeta de red", tone: "bg-accent text-accent-foreground" };
  if (/red/.test(c)) return { icon: Wifi, label: "Redes", tone: "bg-accent text-accent-foreground" };
  if (/mover|movimiento/.test(c)) return { icon: MoveRight, label: "Mover equipo", tone: "bg-secondary text-secondary-foreground" };
  if (/laptop|asignación de equipos/.test(c)) return { icon: Laptop, label: "Laptop", tone: "bg-secondary text-secondary-foreground" };
  if (/alta/.test(c)) return { icon: UserPlus, label: "Alta de usuario", tone: "bg-primary/15 text-primary" };
  if (/baja/.test(c)) return { icon: UserMinus, label: "Baja de usuario", tone: "bg-destructive/10 text-destructive" };
  if (/correo/.test(c)) return { icon: Mail, label: "Correo", tone: "bg-accent text-accent-foreground" };
  if (/software|intranet/.test(c)) return { icon: AppWindow, label: "Software", tone: "bg-secondary text-secondary-foreground" };
  if (/hardware/.test(c)) return { icon: Cpu, label: "Hardware", tone: "bg-secondary text-secondary-foreground" };
  if (/flot/.test(c)) return { icon: Truck, label: "Flotilla", tone: "bg-secondary text-secondary-foreground" };
  return { icon: LifeBuoy, label: "Soporte", tone: "bg-muted text-muted-foreground" };
}

export const CategoryIcon = ({ category, size = "md" }: { category: string; size?: "md" | "lg" }) => {
  const v = categoryVisual(category);
  const Icon = v.icon;
  const box = size === "lg" ? "h-14 w-14 rounded-2xl" : "h-11 w-11 rounded-xl";
  const ic = size === "lg" ? "h-7 w-7" : "h-5 w-5";
  return (
    <div className={`${box} ${v.tone} flex items-center justify-center shrink-0`} title={v.label}>
      <Icon className={ic} />
    </div>
  );
};

export const statusVisual: Record<string, { icon: LucideIcon; cls: string }> = {
  "Recibido por Tecnología": { icon: Inbox, cls: "bg-primary/15 text-primary" },
  Asignado: { icon: UserCheck, cls: "bg-accent text-accent-foreground" },
  "En Progreso": { icon: Loader2, cls: "bg-secondary text-secondary-foreground" },
  "En Espera": { icon: Pause, cls: "bg-muted text-foreground" },
  "Cerrado - Resuelto": { icon: CheckCircle2, cls: "bg-primary/20 text-primary" },
  "Cerrado - No Resuelto": { icon: XCircle, cls: "bg-destructive/10 text-destructive" },
};

export const StatusBadge = ({ status, label }: { status: TicketStatus; label?: string }) => {
  const v = statusVisual[normalizeStatus(status)];
  const Icon = v.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${v.cls}`}>
      <Icon className="h-3 w-3" /> {label || normalizeStatus(status)}
    </span>
  );
};

/** Línea de progreso del flujo */
export const StatusStepper = ({ status }: { status: TicketStatus }) => {
  const s = normalizeStatus(status);
  const steps = ["Recibido por Tecnología", "Asignado", "En Progreso", "Cerrado"];
  const idx = s.startsWith("Cerrado") ? 3 : s === "En Espera" ? 2 : steps.indexOf(s);
  return (
    <div className="flex items-center gap-1">
      {steps.map((st, i) => (
        <div key={st} className="flex-1">
          <div className={`h-1.5 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />
          <p className={`text-[10px] mt-1 ${i <= idx ? "text-foreground" : "text-muted-foreground"}`}>
            {i === 2 && s === "En Espera" ? "En Espera" : i === 3 && s.startsWith("Cerrado") ? s.replace("Cerrado - ", "Cerrado · ") : st}
          </p>
        </div>
      ))}
    </div>
  );
};
