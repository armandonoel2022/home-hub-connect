import { useState } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Heart, ShoppingCart, UserPlus, Eye, EyeOff } from "lucide-react";

const demos = [
  {
    label: "🚨 Alerta de Seguridad",
    icon: ShieldAlert,
    color: "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
    notification: {
      type: "info" as const,
      title: "🚨 ALERTA DE SEGURIDAD",
      message: "Juan Pérez (Operaciones) ha activado una alerta de seguridad. Situación de peligro reportada en la sucursal principal.",
      relatedId: "PANIC-DEMO-1",
      forUserId: "ALL",
      actionUrl: "/",
    },
  },
  {
    label: "🏥 Emergencia Médica",
    icon: Heart,
    color: "bg-orange-500 hover:bg-orange-600 text-white",
    notification: {
      type: "info" as const,
      title: "🏥 EMERGENCIA MÉDICA",
      message: "María García (Administración) reporta una emergencia médica. Necesita asistencia inmediata en el piso 2.",
      relatedId: "PANIC-DEMO-2",
      forUserId: "ALL",
      actionUrl: "/",
    },
  },
  {
    label: "🛒 Solicitud de Compra",
    icon: ShoppingCart,
    color: "bg-blue-600 hover:bg-blue-700 text-white",
    notification: {
      type: "purchase" as const,
      title: "Nueva Solicitud de Compra",
      message: "Operaciones ha solicitado la compra de 10 radios portátiles Motorola por RD$85,000. Requiere aprobación de Gerencia.",
      relatedId: "PR-DEMO",
      forUserId: "USR-002",
      actionUrl: "/solicitudes-compra",
    },
  },
  {
    label: "👤 Solicitud de Personal",
    icon: UserPlus,
    color: "bg-emerald-600 hover:bg-emerald-700 text-white",
    notification: {
      type: "hiring" as const,
      title: "Solicitud de Contratación Pendiente",
      message: "Gerencia Comercial solicita un Ejecutivo de Ventas con experiencia en seguridad privada. Salario propuesto: RD$45,000.",
      relatedId: "HR-DEMO",
      forUserId: "USR-002",
      actionUrl: "/solicitudes-personal",
    },
  },
];

const NotificationDemo = () => {
  const { addNotification } = useNotifications();
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed top-20 right-4 z-[90] p-2 rounded-lg bg-card border border-border shadow-lg hover:bg-muted transition-colors"
        title="Mostrar demo"
      >
        <Eye className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="fixed top-20 right-4 z-[90] w-64 rounded-xl bg-card border border-border shadow-2xl overflow-hidden animate-in slide-in-from-right-4 fade-in duration-300">
      <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
        <span className="font-heading font-bold text-xs tracking-wider uppercase text-muted-foreground">
          Demo Notificaciones
        </span>
        <button onClick={() => setVisible(false)} className="p-1 rounded hover:bg-muted transition-colors">
          <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="p-3 space-y-2">
        {demos.map((d, i) => (
          <Button
            key={i}
            size="sm"
            className={`w-full justify-start gap-2 text-xs ${d.color}`}
            onClick={() => addNotification(d.notification)}
          >
            <d.icon className="w-4 h-4 shrink-0" />
            {d.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default NotificationDemo;
