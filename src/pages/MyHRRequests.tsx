import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import {
  getRequestsByUser, getNotificationsForUser, markNotificationRead,
} from "@/lib/hrRequestService";
import { HR_FORM_LABELS, type HRRequest } from "@/lib/hrRequestTypes";
import {
  CheckCircle2, Clock, XCircle, FileText, Bell, ArrowRight, Inbox, Printer,
} from "lucide-react";

const statusStyle: Record<string, { color: string; icon: any; label: string }> = {
  "Pendiente Supervisor": { color: "bg-amber-500/10 text-amber-700 border-amber-200", icon: Clock, label: "Pendiente Supervisor" },
  "Pendiente RRHH": { color: "bg-blue-500/10 text-blue-700 border-blue-200", icon: Clock, label: "Pendiente RRHH" },
  "Pendiente Gerencia General": { color: "bg-purple-500/10 text-purple-700 border-purple-200", icon: Clock, label: "Pendiente Gerencia" },
  "Pendiente Aplicación RRHH": { color: "bg-cyan-500/10 text-cyan-700 border-cyan-200", icon: Clock, label: "Pendiente aplicación" },
  "Aprobada": { color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", icon: CheckCircle2, label: "Aprobada" },
  "Rechazada": { color: "bg-red-500/10 text-red-700 border-red-200", icon: XCircle, label: "Rechazada" },
};

const MyHRRequests = () => {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    window.addEventListener("safeone:hr-updated", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("safeone:hr-updated", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  const requests = useMemo<HRRequest[]>(() => (user ? getRequestsByUser(user.id) : []), [user, tick]);
  const notifs = useMemo(() => (user ? getNotificationsForUser(user.id) : []), [user, tick]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      `${r.id} ${HR_FORM_LABELS[r.formType] || r.formType} ${r.status}`.toLowerCase().includes(q)
    );
  }, [requests, filter]);

  const stats = useMemo(() => ({
    total: requests.length,
    aprobadas: requests.filter((r) => r.status === "Aprobada").length,
    pendientes: requests.filter((r) => r.status.startsWith("Pendiente")).length,
    rechazadas: requests.filter((r) => r.status === "Rechazada").length,
  }), [requests]);

  if (!user) return null;

  return (
    <AppLayout>
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" /> Mis Solicitudes
            </h1>
            <p className="text-sm text-muted-foreground">
              Estado de todas las solicitudes que has enviado a RRHH.
            </p>
          </div>
          <Link to="/rrhh/formularios">
            <Button size="sm" className="gap-2">
              <ArrowRight className="h-4 w-4" /> Crear nueva solicitud
            </Button>
          </Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{stats.total}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Pendientes</div><div className="text-2xl font-bold text-amber-600">{stats.pendientes}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Aprobadas</div><div className="text-2xl font-bold text-emerald-600">{stats.aprobadas}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Rechazadas</div><div className="text-2xl font-bold text-red-600">{stats.rechazadas}</div></Card>
        </div>

        {/* Recent notifications */}
        {notifs.filter((n) => !n.read).length > 0 && (
          <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
            <div className="font-semibold mb-2 flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-emerald-600" />
              Respuestas recientes ({notifs.filter((n) => !n.read).length} sin leer)
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notifs.slice(0, 6).map((n) => (
                <div key={n.id} className={`text-xs p-2 rounded border ${n.read ? "bg-background" : "bg-emerald-500/10 border-emerald-500/30"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p>{n.message}</p>
                    {!n.read && (
                      <button
                        className="text-[10px] text-emerald-700 hover:underline shrink-0"
                        onClick={() => { markNotificationRead(n.id); setTick((t) => t + 1); }}
                      >
                        marcar leída
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Input placeholder="Filtrar por ID, tipo o estado…" value={filter} onChange={(e) => setFilter(e.target.value)} />

        {/* Requests */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12 border rounded-lg">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No tienes solicitudes registradas aún.
            </div>
          )}
          {filtered.map((r) => {
            const st = statusStyle[r.status] || statusStyle["Pendiente RRHH"];
            const StatusIcon = st.icon;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-[10px]">{r.id}</Badge>
                      <span className="font-semibold text-sm">{HR_FORM_LABELS[r.formType] || r.formType}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Enviada el {new Date(r.requestedAt).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  </div>
                  <Badge className={`gap-1 border ${st.color}`}>
                    <StatusIcon className="h-3 w-3" /> {st.label}
                  </Badge>
                </div>

                {/* Timeline */}
                <div className="mt-3 space-y-1.5 text-xs">
                  <TimelineStep
                    done={!!r.supervisorApproval}
                    label={`Supervisor (${r.supervisorName})`}
                    detail={r.supervisorApproval ? `Aprobada el ${new Date(r.supervisorApproval.at).toLocaleDateString("es-DO")}` : "Pendiente"}
                  />
                  <TimelineStep
                    done={!!r.rrhhApproval}
                    label="RRHH"
                    detail={r.rrhhApproval ? `${r.rrhhApproval.byName} · ${new Date(r.rrhhApproval.at).toLocaleDateString("es-DO")}` : "Pendiente"}
                  />
                  {r.formType === "prestamos" && (
                    <TimelineStep
                      done={!!r.gerenciaApproval}
                      label="Gerencia General"
                      detail={r.gerenciaApproval ? `${r.gerenciaApproval.byName} · ${new Date(r.gerenciaApproval.at).toLocaleDateString("es-DO")}` : "Pendiente"}
                    />
                  )}
                  <TimelineStep
                    done={r.status === "Aprobada"}
                    label="Resultado"
                    detail={
                      r.status === "Aprobada" ? "Aprobada ✓"
                      : r.status === "Rechazada" ? `Rechazada: ${r.rejectionReason || ""}`
                      : "En proceso…"
                    }
                  />
                </div>

                {r.rejectionReason && (
                  <div className="mt-2 text-xs p-2 rounded bg-red-500/5 border border-red-500/20 text-red-700">
                    <strong>Motivo de rechazo:</strong> {r.rejectionReason}
                  </div>
                )}
                {r.formType === "prestamos" && r.loanDetails && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => generateAmortizationPDF(amortizationInputFromRequest(r), { open: true }).catch(() => {})}
                    >
                      <FileText className="h-3 w-3" /> Previsualizar tabla de amortización
                    </Button>
                  </div>
                )}
                {r.status === "Aprobada" && (
                  <div className="mt-3">
                    <Link to={`/rrhh/imprimir/${r.id}`}>
                      <Button size="sm" variant="outline" className="gap-2">
                        <Printer className="h-3 w-3" /> Descargar / Imprimir orden
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
      <Footer />
    </AppLayout>
  );
};

function TimelineStep({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${done ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
      <div className="flex-1">
        <span className="font-medium">{label}:</span>{" "}
        <span className="text-muted-foreground">{detail}</span>
      </div>
    </div>
  );
}

export default MyHRRequests;
