import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, HardDrive, Smartphone, CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPendingDeviceRegistrations,
  acknowledgeDeviceRegistration,
  acknowledgeAllDeviceRegistrations,
  type DeviceRegistration,
} from "@/lib/deviceAssignment";

/**
 * Overlay de revisión de altas de dispositivos para Chrisnel Fabián (Administración).
 * Aparece cuando hay registros pendientes de validar provenientes de Flota Celular
 * o Inventario IT. Permite marcar como revisado y abrir el Registro en el Admin Hub.
 */
const DeviceRegisterOverlay = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<DeviceRegistration[]>([]);
  const [dismissed, setDismissed] = useState(false);

  const refresh = () => setPending(getPendingDeviceRegistrations());

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("safeone-device-registration", handler);
    window.addEventListener("storage", handler);
    const id = setInterval(refresh, 10000);
    return () => {
      window.removeEventListener("safeone-device-registration", handler);
      window.removeEventListener("storage", handler);
      clearInterval(id);
    };
  }, []);

  if (!user) return null;

  // Solo Chrisnel Fabián (Administración) o un administrador IT pueden validar
  const isChrisnel = (user.fullName || "").toLowerCase().includes("chrisnel");
  const canReview = isChrisnel || user.isAdmin || user.department === "Administración";
  if (!canReview) return null;

  if (dismissed || pending.length === 0) return null;

  const ackOne = (id: string) => {
    acknowledgeDeviceRegistration(id);
    refresh();
  };
  const ackAll = () => {
    acknowledgeAllDeviceRegistrations();
    setPending([]);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-gold/40 bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4">
      <div className="bg-gradient-to-r from-[hsl(217,60%,25%)] to-[hsl(217,55%,35%)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <HardDrive className="h-4 w-4" />
          <span className="text-sm font-semibold">Altas de dispositivos por revisar</span>
        </div>
        <button onClick={() => setDismissed(true)} className="text-white/80 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[320px] overflow-y-auto divide-y">
        {pending.slice(0, 8).map((r) => {
          const Icon = r.source === "Flota Celular" ? Smartphone : HardDrive;
          return (
            <div key={r.id} className="px-4 py-3 flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-muted p-1.5">
                <Icon className="h-4 w-4 text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {r.deviceType} · {r.brand} {r.model}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.source} · {r.status}
                  {r.assignedTo ? ` · ${r.assignedTo}` : ""}
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                  Registrado por {r.registeredBy} ·{" "}
                  {new Date(r.registeredAt).toLocaleDateString("es-DO")}
                </p>
                {r.evidence && r.evidence.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 mt-0.5">
                    <FileText className="h-3 w-3" /> Constancia adjunta
                  </span>
                )}
              </div>
              <button
                onClick={() => ackOne(r.id)}
                title="Marcar como revisado"
                className="text-emerald-600 hover:text-emerald-700 shrink-0"
              >
                <CheckCircle2 className="h-5 w-5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{pending.length} pendiente(s)</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/admin/hub?view=devices")}
            className="h-8 text-xs"
          >
            Ver en Admin Hub
          </Button>
          <Button size="sm" onClick={ackAll} className="h-8 text-xs bg-gold text-black hover:bg-gold/90">
            Revisar todo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeviceRegisterOverlay;
