import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { seedArmedPersonnel } from "@/lib/armedPersonnelData";
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
  ArrowLeft, Shield, Clock, CalendarIcon, UserCheck, AlertTriangle,
  Sun, Moon, Coffee, Users, PartyPopper, UserX, Repeat, Plus, Eye, CheckCircle2,
  MapPin, User,
} from "lucide-react";

type ReportType = "horas-extras" | "dia-feriado" | "dia-libre-trabajado" | "ausencia" | "cobertura";

interface OperationsReport {
  id: string;
  type: ReportType;
  agentId: string;
  agentName: string;
  date: string;
  hours?: number;
  description: string;
  coveringFor?: string;
  createdBy: string;
  createdAt: string;
  status: "Pendiente RRHH" | "Asignada" | "Procesada";
  assignedTo?: string;
}

const reportConfig: { key: ReportType; label: string; icon: any; color: string; description: string }[] = [
  { key: "horas-extras", label: "Horas Extras", icon: Clock, color: "hsl(42 100% 50%)", description: "Reportar horas extras trabajadas" },
  { key: "dia-feriado", label: "Día Feriado Trabajado", icon: PartyPopper, color: "hsl(280 50% 50%)", description: "Reportar trabajo en día feriado" },
  { key: "dia-libre-trabajado", label: "Día Libre Trabajado", icon: Sun, color: "hsl(200 70% 50%)", description: "Reportar trabajo en día libre" },
  { key: "ausencia", label: "Ausencia", icon: UserX, color: "hsl(0 60% 50%)", description: "Reportar ausencia de un agente" },
  { key: "cobertura", label: "Cobertura de Turno", icon: Repeat, color: "hsl(160 60% 40%)", description: "Reportar cobertura de turno de otro agente" },
];

const OperationsCenter = () => {
  const navigate = useNavigate();
  const { user, activeUsers, allUsers } = useAuth();
  const { addNotification } = useNotifications();

  const [activeSection, setActiveSection] = useState<"agentes" | "reportar" | "historial" | null>(null);
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [reports, setReports] = useState<OperationsReport[]>([]);
  const [showDetail, setShowDetail] = useState<OperationsReport | null>(null);

  // Form state
  const [selectedAgent, setSelectedAgent] = useState("");
  const [reportDate, setReportDate] = useState<Date | undefined>(undefined);
  const [reportHours, setReportHours] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [coveringForId, setCoveringForId] = useState("");

  // Get armed personnel (agents)
  const agents = mockArmedPersonnel.filter((a) => a.status === "Activo");

  // Group by location
  const locations = agents.reduce<Record<string, typeof agents>>((acc, agent) => {
    const loc = agent.location || "Sin Ubicación";
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(agent);
    return acc;
  }, {});

  // RRHH staff
  const rrhhStaff = activeUsers.filter((u) => u.department === "Recursos Humanos");

  const handleSubmitReport = () => {
    if (!selectedAgent || !reportDate || !activeReport) return;
    const agent = agents.find((a) => a.id === selectedAgent);
    if (!agent) return;

    const coveringForAgent = coveringForId ? agents.find((a) => a.id === coveringForId) : null;

    const newReport: OperationsReport = {
      id: `OPS-${String(Date.now()).slice(-6)}`,
      type: activeReport,
      agentId: selectedAgent,
      agentName: agent.name,
      date: format(reportDate, "yyyy-MM-dd"),
      hours: reportHours ? parseFloat(reportHours) : undefined,
      description: reportDescription || getDefaultDescription(activeReport, agent.name, coveringForAgent?.name),
      coveringFor: coveringForId || undefined,
      createdBy: user?.fullName || "",
      createdAt: new Date().toISOString(),
      status: "Pendiente RRHH",
    };

    setReports((prev) => [newReport, ...prev]);

    const typeLabel = reportConfig.find((r) => r.key === activeReport)?.label || activeReport;
    let notifMessage = `${agent.name} (Operaciones) — ${typeLabel} el ${format(reportDate, "dd/MM/yyyy")}`;
    if (newReport.hours) notifMessage += ` (${newReport.hours}h)`;
    if (coveringForAgent) notifMessage += `. Cubriendo a: ${coveringForAgent.name}`;

    // Notify RRHH (Dilia)
    addNotification({
      type: "info",
      title: `Reporte Operaciones: ${typeLabel}`,
      message: notifMessage,
      relatedId: newReport.id,
      forUserId: "USR-006",
      actionUrl: "/centro-operaciones",
    });

    if (["horas-extras", "dia-feriado", "dia-libre-trabajado"].includes(activeReport)) {
      addNotification({
        type: "info",
        title: `⚠️ REPORTE OPERACIONES: ${typeLabel.toUpperCase()}`,
        message: notifMessage,
        relatedId: newReport.id,
        forUserId: "USR-006",
        actionUrl: "/centro-operaciones",
      });
    }

    setSelectedAgent("");
    setReportDate(undefined);
    setReportHours("");
    setReportDescription("");
    setCoveringForId("");
    setActiveReport(null);
    setActiveSection("historial");
  };

  const getDefaultDescription = (type: ReportType, name: string, coveringName?: string) => {
    switch (type) {
      case "horas-extras": return `Horas extras trabajadas por ${name}`;
      case "dia-feriado": return `${name} trabajó en día feriado`;
      case "dia-libre-trabajado": return `${name} trabajó en su día libre`;
      case "ausencia": return `Ausencia reportada para ${name}`;
      case "cobertura": return `${name} cubrió el turno de ${coveringName || "otro agente"}`;
    }
  };

  const handleAssignToRRHH = (reportId: string, staffId: string) => {
    const staff = allUsers.find((u) => u.id === staffId);
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId ? { ...r, status: "Asignada", assignedTo: staff?.fullName } : r
      )
    );
    const report = reports.find((r) => r.id === reportId);
    if (report && staff) {
      addNotification({
        type: "info",
        title: "Tarea Asignada — Operaciones",
        message: `${report.agentName}: ${reportConfig.find((c) => c.key === report.type)?.label} — Asignada a ${staff.fullName}`,
        relatedId: reportId,
        forUserId: staffId,
        actionUrl: "/centro-operaciones",
      });
    }
  };

  const handleMarkProcessed = (reportId: string) => {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: "Procesada" } : r))
    );
  };

  const isRRHH = user?.department === "Recursos Humanos" || user?.isAdmin;
  const isOperaciones = user?.department === "Operaciones" || user?.isAdmin;

  const handleBack = () => {
    if (showDetail) setShowDetail(null);
    else if (activeReport) setActiveReport(null);
    else if (activeSection) setActiveSection(null);
    else navigate("/");
  };

  const pendingCount = reports.filter((r) => r.status === "Pendiente RRHH").length;
  const assignedCount = reports.filter((r) => r.status === "Asignada").length;
  const processedCount = reports.filter((r) => r.status === "Procesada").length;

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">
                Centro de Operaciones
              </h1>
              <p className="text-sm text-muted-foreground">
                Gestión de agentes, horarios y reportes
              </p>
            </div>
          </div>

          {/* Stats */}
          {reports.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pendientes RRHH</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{assignedCount}</p>
                <p className="text-xs text-muted-foreground">Asignadas</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{processedCount}</p>
                <p className="text-xs text-muted-foreground">Procesadas</p>
              </div>
            </div>
          )}

          {/* Main menu */}
          {!activeSection && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveSection("agentes")}
                className="group flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-border bg-card hover:border-primary transition-all"
              >
                <div className="p-4 rounded-xl bg-primary/10">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <span className="font-heading font-bold text-card-foreground">Agentes</span>
                <span className="text-xs text-muted-foreground text-center">
                  Ver agentes, ubicaciones y estado
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                  {agents.length} agentes activos
                </span>
              </button>
              {isOperaciones && (
                <button
                  onClick={() => setActiveSection("reportar")}
                  className="group flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-border bg-card hover:border-amber-500 transition-all"
                >
                  <div className="p-4 rounded-xl bg-amber-500/10">
                    <AlertTriangle className="h-8 w-8 text-amber-500" />
                  </div>
                  <span className="font-heading font-bold text-card-foreground">Reportar</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Horas extras, feriados, ausencias, coberturas
                  </span>
                </button>
              )}
              <button
                onClick={() => setActiveSection("historial")}
                className="group flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-border bg-card hover:border-emerald-500 transition-all"
              >
                <div className="p-4 rounded-xl bg-emerald-500/10">
                  <Eye className="h-8 w-8 text-emerald-500" />
                </div>
                <span className="font-heading font-bold text-card-foreground">Historial</span>
                <span className="text-xs text-muted-foreground text-center">
                  Ver reportes y seguimiento
                </span>
                {pendingCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-semibold">
                    {pendingCount} pendientes
                  </span>
                )}
              </button>
            </div>
          )}

          {/* ═══ AGENTES ═══ */}
          {activeSection === "agentes" && (
            <div className="space-y-6">
              {Object.entries(locations).map(([locName, members]) => (
                <div key={locName} className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="px-5 py-3 bg-muted flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h3 className="font-heading font-bold text-card-foreground text-sm">{locName}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary ml-auto">
                      {members.length} agentes
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {members.map((agent) => (
                      <div key={agent.id} className="px-5 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                          {agent.photo ? (
                            <img src={agent.photo} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-card-foreground">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.position}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{agent.supervisor}</span>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                          agent.status === "Activo" && "bg-emerald-500/10 text-emerald-600",
                          agent.status === "Licencia" && "bg-amber-500/10 text-amber-600",
                          agent.status === "Inactivo" && "bg-muted text-muted-foreground",
                        )}>
                          {agent.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ REPORTAR ═══ */}
          {activeSection === "reportar" && !activeReport && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportConfig.map((rc) => {
                const Icon = rc.icon;
                return (
                  <button
                    key={rc.key}
                    onClick={() => setActiveReport(rc.key)}
                    className="group flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-card hover:border-primary transition-all text-left"
                  >
                    <div className="p-3 rounded-xl" style={{ background: rc.color + "22" }}>
                      <Icon className="h-6 w-6" style={{ color: rc.color }} />
                    </div>
                    <div>
                      <p className="font-heading font-bold text-card-foreground text-sm">{rc.label}</p>
                      <p className="text-xs text-muted-foreground">{rc.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ═══ REPORT FORM ═══ */}
          {activeSection === "reportar" && activeReport && (
            <div className="max-w-lg mx-auto bg-card rounded-xl border border-border p-6 space-y-5">
              <div className="flex items-center gap-3 mb-2">
                {(() => {
                  const cfg = reportConfig.find((r) => r.key === activeReport)!;
                  const Icon = cfg.icon;
                  return (
                    <>
                      <div className="p-2 rounded-lg" style={{ background: cfg.color + "22" }}>
                        <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                      </div>
                      <h3 className="font-heading font-bold text-card-foreground">{cfg.label}</h3>
                    </>
                  );
                })()}
              </div>

              <div className="space-y-1.5">
                <Label>Agente</Label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar agente" /></SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — {a.location} ({a.position})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !reportDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {reportDate ? format(reportDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={reportDate} onSelect={setReportDate} />
                  </PopoverContent>
                </Popover>
              </div>

              {["horas-extras", "dia-feriado", "dia-libre-trabajado", "cobertura"].includes(activeReport) && (
                <div className="space-y-1.5">
                  <Label>Horas trabajadas</Label>
                  <Input type="number" min="0.5" step="0.5" placeholder="Ej: 8" value={reportHours} onChange={(e) => setReportHours(e.target.value)} />
                </div>
              )}

              {activeReport === "cobertura" && (
                <div className="space-y-1.5">
                  <Label>Cubriendo a</Label>
                  <Select value={coveringForId} onValueChange={setCoveringForId}>
                    <SelectTrigger><SelectValue placeholder="¿A quién cubre?" /></SelectTrigger>
                    <SelectContent>
                      {agents.filter((a) => a.id !== selectedAgent).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} — {a.location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Observaciones</Label>
                <Textarea placeholder="Detalles adicionales..." value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} rows={3} />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setActiveReport(null)}>Cancelar</Button>
                <Button className="flex-1" disabled={!selectedAgent || !reportDate} onClick={handleSubmitReport}>
                  <Plus className="h-4 w-4 mr-1" /> Enviar Reporte
                </Button>
              </div>
            </div>
          )}

          {/* ═══ HISTORIAL ═══ */}
          {activeSection === "historial" && !showDetail && (
            <div className="space-y-3">
              {reports.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No hay reportes registrados aún</p>
                </div>
              ) : (
                reports.map((r) => {
                  const cfg = reportConfig.find((c) => c.key === r.type)!;
                  const Icon = cfg.icon;
                  return (
                    <div key={r.id} onClick={() => setShowDetail(r)}
                      className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/30 cursor-pointer transition-colors">
                      <div className="p-2 rounded-lg shrink-0" style={{ background: cfg.color + "22" }}>
                        <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-card-foreground">{r.agentName}</p>
                        <p className="text-xs text-muted-foreground">
                          {cfg.label} — {format(new Date(r.date), "dd/MM/yyyy")}
                          {r.hours ? ` · ${r.hours}h` : ""}
                        </p>
                      </div>
                      <span className={cn(
                        "text-xs font-semibold px-2 py-1 rounded-full",
                        r.status === "Pendiente RRHH" && "bg-amber-500/10 text-amber-600",
                        r.status === "Asignada" && "bg-blue-500/10 text-blue-600",
                        r.status === "Procesada" && "bg-emerald-500/10 text-emerald-600",
                      )}>
                        {r.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ═══ DETAIL ═══ */}
          {activeSection === "historial" && showDetail && (
            <div className="max-w-lg mx-auto bg-card rounded-xl border border-border p-6 space-y-4">
              {(() => {
                const cfg = reportConfig.find((c) => c.key === showDetail.type)!;
                const Icon = cfg.icon;
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ background: cfg.color + "22" }}>
                        <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                      </div>
                      <div>
                        <h3 className="font-heading font-bold text-card-foreground">{cfg.label}</h3>
                        <p className="text-xs text-muted-foreground">{showDetail.id}</p>
                      </div>
                      <span className={cn(
                        "text-xs font-semibold px-2 py-1 rounded-full ml-auto",
                        showDetail.status === "Pendiente RRHH" && "bg-amber-500/10 text-amber-600",
                        showDetail.status === "Asignada" && "bg-blue-500/10 text-blue-600",
                        showDetail.status === "Procesada" && "bg-emerald-500/10 text-emerald-600",
                      )}>
                        {showDetail.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Agente</p>
                        <p className="font-semibold text-card-foreground">{showDetail.agentName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fecha</p>
                        <p className="font-semibold text-card-foreground">{format(new Date(showDetail.date), "dd/MM/yyyy")}</p>
                      </div>
                      {showDetail.hours && (
                        <div>
                          <p className="text-xs text-muted-foreground">Horas</p>
                          <p className="font-semibold text-card-foreground">{showDetail.hours}h</p>
                        </div>
                      )}
                      {showDetail.coveringFor && (
                        <div>
                          <p className="text-xs text-muted-foreground">Cubriendo a</p>
                          <p className="font-semibold text-card-foreground">
                            {agents.find((a) => a.id === showDetail.coveringFor)?.name || showDetail.coveringFor}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Reportado por</p>
                        <p className="font-semibold text-card-foreground">{showDetail.createdBy}</p>
                      </div>
                      {showDetail.assignedTo && (
                        <div>
                          <p className="text-xs text-muted-foreground">Asignada a</p>
                          <p className="font-semibold text-card-foreground">{showDetail.assignedTo}</p>
                        </div>
                      )}
                    </div>

                    {showDetail.description && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Observaciones</p>
                        <p className="text-sm text-card-foreground bg-muted rounded-lg p-3">{showDetail.description}</p>
                      </div>
                    )}

                    {isRRHH && showDetail.status === "Pendiente RRHH" && (
                      <div className="border-t border-border pt-4 space-y-2">
                        <Label className="text-xs">Asignar a personal de RRHH</Label>
                        <div className="flex gap-2 flex-wrap">
                          {rrhhStaff.map((staff) => (
                            <Button key={staff.id} variant="outline" size="sm"
                              onClick={() => {
                                handleAssignToRRHH(showDetail.id, staff.id);
                                setShowDetail({ ...showDetail, status: "Asignada", assignedTo: staff.fullName });
                              }}>
                              <UserCheck className="h-3.5 w-3.5 mr-1" /> {staff.fullName}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isRRHH && showDetail.status === "Asignada" && (
                      <Button className="w-full" onClick={() => {
                        handleMarkProcessed(showDetail.id);
                        setShowDetail({ ...showDetail, status: "Procesada" });
                      }}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar como Procesada
                      </Button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
        <Footer />
      </div>
    </AppLayout>
  );
};

export default OperationsCenter;
