import { useState, useMemo, useRef, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import {
  ArrowLeft, Search, Plus, Edit2, Trash2, Save, X, Eye, EyeOff,
  CheckCircle2, AlertTriangle, Clock, Radio, WifiOff, PhoneOff,
  BarChart3, PieChart, TrendingUp, DollarSign, Activity, Filter,
  FileWarning, Phone, Camera, Video, Mic, Send, MessageSquare,
  Calendar, Download, FileText, Users, Bell,
} from "lucide-react";
import {
  getOSMClients, saveOSMClients, addOSMClient, updateOSMClient, deleteOSMClient,
  type OSMClient, type ClientMonitoringStatus, type ClientResolutionStatus,
} from "@/lib/osmClientData";
import {
  getIncidents, addIncident, updateIncident, addIncidentComment, addIncidentEvidence,
  canEditIncident, getCSRequests, addCSRequest, completeCSRequest, generateDailyReport, generateWeeklyReport,
  CS_RECIPIENT, BROADCAST_RECIPIENTS,
  type OSMIncident, type IncidentStatus, type IncidentPriority, type CSRequest as CSRequestType,
} from "@/lib/osmIncidentData";
import CustomerServiceOverlay from "@/components/osm/CustomerServiceOverlay";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from "recharts";
import { toast } from "sonner";

const STATUS_COLORS: Record<ClientMonitoringStatus, string> = {
  "Activo": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Inactivo": "bg-red-500/20 text-red-400 border-red-500/30",
  "Investigar": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Visita Tecnica": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Sin monitoreo": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "Linea Telefonica": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Safe y Kronos": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "Suspendido": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Sin notificaciones": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Sin sistema": "bg-rose-500/20 text-rose-400 border-rose-500/30",
  "Prueba": "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const STATUS_ICONS: Record<ClientMonitoringStatus, any> = {
  "Activo": CheckCircle2, "Inactivo": WifiOff, "Investigar": AlertTriangle,
  "Visita Tecnica": Clock, "Sin monitoreo": EyeOff, "Linea Telefonica": PhoneOff,
  "Safe y Kronos": Radio, "Suspendido": WifiOff, "Sin notificaciones": Bell,
  "Sin sistema": FileWarning, "Prueba": Eye,
};

const INC_STATUS_LABELS: Record<IncidentStatus, string> = {
  abierta: "Abierta", en_progreso: "En Progreso", esperando_cliente: "Esperando Cliente",
  esperando_servicio_al_cliente: "Esperando Serv. al Cliente", resuelta: "Resuelta", cerrada: "Cerrada",
};

const INC_PRIORITY_COLORS: Record<IncidentPriority, string> = {
  critica: "bg-red-500/20 text-red-400", alta: "bg-orange-500/20 text-orange-400",
  media: "bg-amber-500/20 text-amber-400", baja: "bg-blue-500/20 text-blue-400",
};

const CHART_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#6b7280", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899", "#84cc16", "#14b8a6"];

const ALL_STATUSES: ClientMonitoringStatus[] = ["Activo", "Inactivo", "Investigar", "Visita Tecnica", "Sin monitoreo", "Linea Telefonica", "Safe y Kronos", "Suspendido", "Sin notificaciones", "Sin sistema", "Prueba"];

const ClientTracking = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clients, setClients] = useState<OSMClient[]>(getOSMClients());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [resolutionFilter, setResolutionFilter] = useState<string>("all");
  const [billingFilter, setBillingFilter] = useState<string>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<OSMClient>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClient, setNewClient] = useState<Partial<OSMClient>>({ monitoringStatus: "Activo", resolutionStatus: "Pendiente", hasBilling: false });

  // Incidents state
  const [incidents, setIncidents] = useState<OSMIncident[]>(getIncidents());
  const [incSearch, setIncSearch] = useState("");
  const [incStatusFilter, setIncStatusFilter] = useState<string>("all");
  const [showNewIncident, setShowNewIncident] = useState(false);
  const [editingIncident, setEditingIncident] = useState<OSMIncident | null>(null);
  const [newIncident, setNewIncident] = useState<Partial<OSMIncident>>({ priority: "media", status: "abierta" });
  const [commentText, setCommentText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CS state
  const [csRequests, setCsRequests] = useState<CSRequestType[]>(getCSRequests());
  const [csOverlayOpen, setCsOverlayOpen] = useState(false);
  const [selectedCSRequest, setSelectedCSRequest] = useState<CSRequestType | null>(null);
  const [csMessage, setCsMessage] = useState("");

  // Reports
  const [reportType, setReportType] = useState<"diario" | "semanal">("diario");

  const userEmail = user?.email || "";
  const isCSUser = userEmail.toLowerCase() === "pgonzalez@safeone.com.do" || userEmail.toLowerCase() === CS_RECIPIENT.email.toLowerCase();
  const canEdit = canEditIncident(userEmail) || (user as any)?.role === "admin";
  const canTestCS = canEdit; // Allow editors (monitoreo, anoel, lovalle) to also view/test CS tab

  const refresh = () => { setClients(getOSMClients()); setIncidents(getIncidents()); setCsRequests(getCSRequests()); };

  // Filtered clients
  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch = !search || c.businessName.toLowerCase().includes(search.toLowerCase()) ||
        c.accountCode.includes(search) || c.contact.toLowerCase().includes(search.toLowerCase()) ||
        (c.billingClient || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || c.monitoringStatus === statusFilter;
      const matchResolution = resolutionFilter === "all" || c.resolutionStatus === resolutionFilter;
      const matchBilling = billingFilter === "all" || (billingFilter === "con" && c.hasBilling) || (billingFilter === "sin" && !c.hasBilling);
      return matchSearch && matchStatus && matchResolution && matchBilling;
    });
  }, [clients, search, statusFilter, resolutionFilter, billingFilter]);

  // Dashboard stats
  const stats = useMemo(() => {
    const total = clients.length;
    const activos = clients.filter((c) => c.monitoringStatus === "Activo").length;
    const pendientes = clients.filter((c) => c.resolutionStatus === "Pendiente").length;
    const conFacturacion = clients.filter((c) => c.hasBilling).length;
    const sinFacturacion = clients.filter((c) => !c.hasBilling).length;
    const sinMonitoreo = clients.filter((c) => c.monitoringStatus === "Sin monitoreo" || c.monitoringStatus === "Sin sistema").length;
    const investigar = clients.filter((c) => c.monitoringStatus === "Investigar").length;
    const byStatus = ALL_STATUSES.map((s) => ({ name: s, count: clients.filter((c) => c.monitoringStatus === s).length })).filter((d) => d.count > 0);
    const billingPie = [{ name: "Con Facturación", value: conFacturacion }, { name: "Sin Facturación", value: sinFacturacion }];
    const complianceRate = total > 0 ? Math.round((activos / total) * 100) : 0;
    const billingCoverage = total > 0 ? Math.round((conFacturacion / total) * 100) : 0;
    return { total, activos, pendientes, conFacturacion, sinFacturacion, sinMonitoreo, investigar, byStatus, billingPie, complianceRate, billingCoverage };
  }, [clients]);

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter(i => {
      const ms = !incSearch || i.clientName.toLowerCase().includes(incSearch.toLowerCase()) || i.title.toLowerCase().includes(incSearch.toLowerCase());
      const ss = incStatusFilter === "all" || i.status === incStatusFilter;
      return ms && ss;
    });
  }, [incidents, incSearch, incStatusFilter]);

  // Report data
  const report = useMemo(() => {
    if (reportType === "diario") return { daily: generateDailyReport(new Date()), weekly: null };
    return { daily: null, weekly: generateWeeklyReport(new Date()) };
  }, [reportType, incidents]);

  const handleSaveEdit = (id: string) => { updateOSMClient(id, editData); setEditing(null); setEditData({}); refresh(); };
  const handleDelete = (id: string) => { if (confirm("¿Eliminar este cliente?")) { deleteOSMClient(id); refresh(); } };
  const handleAdd = () => {
    if (!newClient.businessName) return;
    addOSMClient({ accountCode: newClient.accountCode || "", businessName: newClient.businessName, contact: newClient.contact || "", phone: newClient.phone || "", monitoringStatus: (newClient.monitoringStatus as ClientMonitoringStatus) || "Activo", resolutionStatus: (newClient.resolutionStatus as ClientResolutionStatus) || "Pendiente", notes: newClient.notes || "", hasBilling: newClient.hasBilling || false, billingClient: newClient.billingClient || "", billingDescription: newClient.billingDescription || "", billingEmail: newClient.billingEmail || "", lastUpdated: new Date().toISOString().slice(0, 10), updatedBy: user?.fullName } as OSMClient);
    setShowAddForm(false); setNewClient({ monitoringStatus: "Activo", resolutionStatus: "Pendiente", hasBilling: false }); refresh();
  };

  // Incident handlers
  const handleCreateIncident = () => {
    if (!newIncident.clientName || !newIncident.title) { toast.error("Complete el cliente y título"); return; }
    addIncident({
      clientId: "", clientName: newIncident.clientName || "", accountCode: newIncident.accountCode || "",
      title: newIncident.title || "", description: newIncident.description || "",
      status: (newIncident.status as IncidentStatus) || "abierta",
      priority: (newIncident.priority as IncidentPriority) || "media",
      contact: newIncident.contact || "", phone: newIncident.phone || "",
      csRequestSent: false, csBroadcastSent: false,
      evidence: [], comments: [],
      createdAt: new Date().toISOString(), createdBy: user?.fullName || "Sistema",
      createdByEmail: userEmail, updatedAt: new Date().toISOString(),
    });
    setShowNewIncident(false); setNewIncident({ priority: "media", status: "abierta" });
    toast.success("Incidencia registrada"); refresh();
  };

  const handleUpdateIncidentStatus = (id: string, status: IncidentStatus) => {
    const updates: Partial<OSMIncident> = { status, updatedBy: user?.fullName };
    if (status === "resuelta" || status === "cerrada") { updates.resolvedAt = new Date().toISOString(); updates.resolvedBy = user?.fullName; }
    updateIncident(id, updates); toast.success("Estado actualizado"); refresh();
  };

  const handleAddComment = (incId: string) => {
    if (!commentText.trim()) return;
    addIncidentComment(incId, { text: commentText, author: user?.fullName || "Sistema", authorEmail: userEmail, createdAt: new Date().toISOString() });
    setCommentText(""); toast.success("Comentario agregado"); refresh();
  };

  const handleFileUpload = useCallback((incId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const type = file.type.startsWith("image") ? "photo" : file.type.startsWith("video") ? "video" : "audio";
      addIncidentEvidence(incId, { type, name: file.name, dataUrl: reader.result as string, uploadedAt: new Date().toISOString(), uploadedBy: user?.fullName || "Sistema" });
      toast.success(`${type === "photo" ? "Foto" : type === "video" ? "Video" : "Audio"} agregado`); refresh();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [user]);

  // CS workflow
  const handleSendCSRequest = (incident: OSMIncident) => {
    if (!csMessage.trim()) { toast.error("Escriba el mensaje para Servicio al Cliente"); return; }
    addCSRequest({
      incidentId: incident.id, clientName: incident.clientName, accountCode: incident.accountCode,
      message: csMessage, requestedBy: user?.fullName || "Sistema", requestedAt: new Date().toISOString(),
      completed: false, broadcastSent: false,
    });
    updateIncident(incident.id, { csRequestSent: true, csRequestDate: new Date().toISOString(), status: "esperando_servicio_al_cliente" });
    setCsMessage(""); toast.success(`Solicitud enviada a ${CS_RECIPIENT.name}`); refresh();
  };

  const handleCSComplete = (notes: string) => {
    if (!selectedCSRequest) return;
    completeCSRequest(selectedCSRequest.id, user?.fullName || CS_RECIPIENT.name, notes);
    // Update the linked incident
    updateIncident(selectedCSRequest.incidentId, { csCompletedDate: new Date().toISOString(), csCompletedBy: user?.fullName, csNotes: notes, csBroadcastSent: true, status: "en_progreso" });
    toast.success("Gestión completada. Notificación enviada al equipo.");
    setCsOverlayOpen(false); setSelectedCSRequest(null); refresh();
  };

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 max-w-[1600px] mx-auto px-4 sm:px-6 py-6 w-full">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">Seguimiento Clientes Monitoreo</h1>
              <p className="text-sm text-muted-foreground">Control de servicios, incidencias y facturación CxC</p>
            </div>
          </div>

          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="bg-card border border-border flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="dashboard" className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" /> Dashboard</TabsTrigger>
              <TabsTrigger value="clients" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> Clientes</TabsTrigger>
              <TabsTrigger value="incidents" className="gap-1.5 text-xs"><AlertTriangle className="h-3.5 w-3.5" /> Incidencias</TabsTrigger>
              <TabsTrigger value="billing" className="gap-1.5 text-xs"><DollarSign className="h-3.5 w-3.5" /> Facturación</TabsTrigger>
              <TabsTrigger value="reports" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Reportes</TabsTrigger>
              {(isCSUser || canTestCS) && <TabsTrigger value="cs" className="gap-1.5 text-xs"><Phone className="h-3.5 w-3.5" /> {isCSUser ? "Mis Solicitudes" : "Solicitudes CS"}</TabsTrigger>}
            </TabsList>

            {/* ── DASHBOARD ── */}
            <TabsContent value="dashboard" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                  { label: "Total Clientes", value: stats.total, icon: Activity, color: "text-blue-400" },
                  { label: "Activos", value: stats.activos, icon: CheckCircle2, color: "text-emerald-400" },
                  { label: "Pendientes", value: stats.pendientes, icon: Clock, color: "text-amber-400" },
                  { label: "Investigar", value: stats.investigar, icon: AlertTriangle, color: "text-orange-400" },
                  { label: "Sin Monitor/Sistema", value: stats.sinMonitoreo, icon: EyeOff, color: "text-red-400" },
                  { label: "Con Facturación", value: stats.conFacturacion, icon: DollarSign, color: "text-emerald-400" },
                  { label: "Sin Facturación", value: stats.sinFacturacion, icon: DollarSign, color: "text-red-400" },
                ].map((kpi) => (
                  <Card key={kpi.label} className="bg-card border-border">
                    <CardContent className="p-4 text-center">
                      <kpi.icon className={`h-5 w-5 mx-auto mb-1 ${kpi.color}`} />
                      <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Servicios Activos</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3"><Progress value={stats.complianceRate} className="flex-1" /><span className="text-lg font-bold text-foreground">{stats.complianceRate}%</span></div>
                    <p className="text-xs text-muted-foreground mt-1">{stats.activos} de {stats.total} clientes con servicio activo</p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Cobertura de Facturación</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3"><Progress value={stats.billingCoverage} className="flex-1" /><span className="text-lg font-bold text-foreground">{stats.billingCoverage}%</span></div>
                    <p className="text-xs text-muted-foreground mt-1">{stats.conFacturacion} de {stats.total} clientes con facturación en CxC</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-card border-border">
                  <CardHeader><CardTitle className="text-sm">Distribución por Estado</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={stats.byStatus}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} angle={-35} textAnchor="end" height={70} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                        <Bar dataKey="count" name="Clientes" radius={[4, 4, 0, 0]}>
                          {stats.byStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardHeader><CardTitle className="text-sm">Facturación vs Sin Facturación</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <RePieChart>
                        <Pie data={stats.billingPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          <Cell fill="#10b981" /><Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                        <Legend />
                      </RePieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Incident summary in dashboard */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    Incidencias Activas ({incidents.filter(i => i.status !== "resuelta" && i.status !== "cerrada").length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {incidents.filter(i => i.status !== "resuelta" && i.status !== "cerrada").slice(0, 8).map(i => (
                      <div key={i.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{i.clientName} — {i.title}</p>
                          <p className="text-xs text-muted-foreground">{INC_STATUS_LABELS[i.status]}</p>
                        </div>
                        <Badge className={`${INC_PRIORITY_COLORS[i.priority]} text-xs`}>{i.priority}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── CLIENTS TABLE ── */}
            <TabsContent value="clients" className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={resolutionFilter} onValueChange={setResolutionFilter}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="Pendiente">Pendiente</SelectItem><SelectItem value="Resuelto">Resuelto</SelectItem></SelectContent>
                </Select>
                <Select value={billingFilter} onValueChange={setBillingFilter}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="con">Con facturación</SelectItem><SelectItem value="sin">Sin facturación</SelectItem></SelectContent>
                </Select>
                <Button onClick={() => setShowAddForm(true)} className="gap-2"><Plus className="h-4 w-4" /> Agregar</Button>
              </div>

              <p className="text-xs text-muted-foreground">{filtered.length} de {clients.length} clientes</p>

              {showAddForm && (
                <Card className="bg-card border-border">
                  <CardHeader><CardTitle className="text-sm">Nuevo Cliente</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Código</Label><Input placeholder="Ej: 8003" value={newClient.accountCode || ""} onChange={(e) => setNewClient({ ...newClient, accountCode: e.target.value })} /></div>
                    <div><Label className="text-xs">Nombre *</Label><Input value={newClient.businessName || ""} onChange={(e) => setNewClient({ ...newClient, businessName: e.target.value })} /></div>
                    <div><Label className="text-xs">Contacto</Label><Input value={newClient.contact || ""} onChange={(e) => setNewClient({ ...newClient, contact: e.target.value })} /></div>
                    <div><Label className="text-xs">Teléfono</Label><Input value={newClient.phone || ""} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></div>
                    <div><Label className="text-xs">Estado</Label>
                      <Select value={newClient.monitoringStatus || "Activo"} onValueChange={(v) => setNewClient({ ...newClient, monitoringStatus: v as ClientMonitoringStatus })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pt-5"><Switch checked={newClient.hasBilling || false} onCheckedChange={(v) => setNewClient({ ...newClient, hasBilling: v })} /><Label className="text-xs">¿CxC?</Label></div>
                    <div className="md:col-span-3"><Label className="text-xs">Notas</Label><Textarea value={newClient.notes || ""} onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })} rows={2} /></div>
                    <div className="md:col-span-3 flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancelar</Button>
                      <Button onClick={handleAdd} disabled={!newClient.businessName}>Guardar</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[80px]">Código</TableHead>
                        <TableHead>Negocio</TableHead>
                        <TableHead>Contacto</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Resolución</TableHead>
                        <TableHead>CxC</TableHead>
                        <TableHead className="w-[250px]">Notas</TableHead>
                        <TableHead className="w-[80px]">Acc.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.slice(0, 100).map((client) => {
                        const isEditing = editing === client.id;
                        const Icon = STATUS_ICONS[client.monitoringStatus] || Activity;
                        return (
                          <TableRow key={client.id} className="hover:bg-muted/20">
                            <TableCell className="font-mono text-xs">{isEditing ? <Input value={editData.accountCode ?? client.accountCode} onChange={(e) => setEditData({ ...editData, accountCode: e.target.value })} className="h-7 text-xs" /> : client.accountCode || "—"}</TableCell>
                            <TableCell className="font-medium text-sm max-w-[200px]">{isEditing ? <Input value={editData.businessName ?? client.businessName} onChange={(e) => setEditData({ ...editData, businessName: e.target.value })} className="h-7 text-xs" /> : <span className="truncate block">{client.businessName}</span>}</TableCell>
                            <TableCell className="text-xs">{client.contact || "—"}</TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Select value={editData.monitoringStatus ?? client.monitoringStatus} onValueChange={(v) => setEditData({ ...editData, monitoringStatus: v as ClientMonitoringStatus })}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                              ) : <Badge variant="outline" className={`${STATUS_COLORS[client.monitoringStatus]} gap-1 text-xs`}><Icon className="h-3 w-3" />{client.monitoringStatus}</Badge>}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Select value={editData.resolutionStatus ?? client.resolutionStatus} onValueChange={(v) => setEditData({ ...editData, resolutionStatus: v as ClientResolutionStatus })}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent><SelectItem value="Pendiente">Pendiente</SelectItem><SelectItem value="Resuelto">Resuelto</SelectItem></SelectContent>
                                </Select>
                              ) : <Badge variant={client.resolutionStatus === "Resuelto" ? "default" : "secondary"} className="text-xs">{client.resolutionStatus}</Badge>}
                            </TableCell>
                            <TableCell>{client.hasBilling ? <span className="text-xs text-emerald-400">✓</span> : <span className="text-xs text-red-400">✗</span>}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[250px]">{isEditing ? <Textarea value={editData.notes ?? client.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} rows={2} className="text-xs" /> : <span className="line-clamp-2">{client.notes || "—"}</span>}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {isEditing ? (
                                  <><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveEdit(client.id)}><Save className="h-3.5 w-3.5 text-emerald-400" /></Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(null); setEditData({}); }}><X className="h-3.5 w-3.5" /></Button></>
                                ) : (
                                  <><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(client.id); setEditData({}); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(client.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button></>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {filtered.length > 100 && <p className="text-xs text-muted-foreground text-center py-2">Mostrando 100 de {filtered.length}. Use filtros para refinar.</p>}
              </div>
            </TabsContent>

            {/* ── INCIDENTS ── */}
            <TabsContent value="incidents" className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar incidencia..." value={incSearch} onChange={(e) => setIncSearch(e.target.value)} className="pl-9" />
                  </div>
                </div>
                <Select value={incStatusFilter} onValueChange={setIncStatusFilter}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(INC_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                {canEdit && <Button onClick={() => setShowNewIncident(true)} className="gap-2"><Plus className="h-4 w-4" /> Nueva Incidencia</Button>}
              </div>

              {/* New incident form */}
              {showNewIncident && (
                <Card className="bg-card border-border">
                  <CardHeader><CardTitle className="text-sm">Nueva Incidencia</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Cliente *</Label><Input placeholder="Nombre del cliente" value={newIncident.clientName || ""} onChange={(e) => setNewIncident({ ...newIncident, clientName: e.target.value })} /></div>
                    <div><Label className="text-xs">Código Cuenta</Label><Input placeholder="Ej: 8003" value={newIncident.accountCode || ""} onChange={(e) => setNewIncident({ ...newIncident, accountCode: e.target.value })} /></div>
                    <div><Label className="text-xs">Título *</Label><Input placeholder="Resumen de la incidencia" value={newIncident.title || ""} onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })} /></div>
                    <div><Label className="text-xs">Contacto</Label><Input value={newIncident.contact || ""} onChange={(e) => setNewIncident({ ...newIncident, contact: e.target.value })} /></div>
                    <div><Label className="text-xs">Teléfono</Label><Input value={newIncident.phone || ""} onChange={(e) => setNewIncident({ ...newIncident, phone: e.target.value })} /></div>
                    <div><Label className="text-xs">Prioridad</Label>
                      <Select value={newIncident.priority || "media"} onValueChange={(v) => setNewIncident({ ...newIncident, priority: v as IncidentPriority })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="critica">Crítica</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="baja">Baja</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-3"><Label className="text-xs">Descripción</Label><Textarea value={newIncident.description || ""} onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })} rows={3} /></div>
                    <div className="md:col-span-3 flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowNewIncident(false)}>Cancelar</Button>
                      <Button onClick={handleCreateIncident}>Registrar</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Incidents list */}
              <div className="space-y-3">
                {filteredIncidents.map(inc => (
                  <Card key={inc.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground text-sm">{inc.clientName}</h3>
                            {inc.accountCode && <span className="text-xs text-muted-foreground font-mono">#{inc.accountCode}</span>}
                            <Badge className={`${INC_PRIORITY_COLORS[inc.priority]} text-xs`}>{inc.priority}</Badge>
                          </div>
                          <p className="text-sm text-foreground mt-0.5">{inc.title}</p>
                          {inc.description && <p className="text-xs text-muted-foreground mt-1">{inc.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <Select value={inc.status} onValueChange={(v) => handleUpdateIncidentStatus(inc.id, v as IncidentStatus)}>
                              <SelectTrigger className="h-7 text-xs w-[180px]"><SelectValue /></SelectTrigger>
                              <SelectContent>{Object.entries(INC_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                            </Select>
                          )}
                          {!canEdit && <Badge variant="outline" className="text-xs">{INC_STATUS_LABELS[inc.status]}</Badge>}
                        </div>
                      </div>

                      {/* Contact info */}
                      {(inc.contact || inc.phone) && (
                        <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                          {inc.contact && <span>👤 {inc.contact}</span>}
                          {inc.phone && <span>📞 {inc.phone}</span>}
                        </div>
                      )}

                      {/* Evidence */}
                      {inc.evidence.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {inc.evidence.map(ev => (
                            <div key={ev.id} className="flex items-center gap-1 text-xs bg-muted/30 rounded px-2 py-1 border border-border">
                              {ev.type === "photo" && <Camera className="h-3 w-3" />}
                              {ev.type === "video" && <Video className="h-3 w-3" />}
                              {ev.type === "audio" && <Mic className="h-3 w-3" />}
                              <a href={ev.dataUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{ev.name}</a>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comments */}
                      {inc.comments.length > 0 && (
                        <div className="space-y-1 mb-2 pl-3 border-l-2 border-border">
                          {inc.comments.map(c => (
                            <div key={c.id} className="text-xs">
                              <span className="font-medium text-foreground">{c.author}</span>
                              <span className="text-muted-foreground"> • {new Date(c.createdAt).toLocaleString("es-DO")}</span>
                              <p className="text-muted-foreground">{c.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                        {/* Add comment */}
                        <Dialog>
                          <DialogTrigger asChild><Button variant="outline" size="sm" className="h-7 text-xs gap-1"><MessageSquare className="h-3 w-3" /> Comentar</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Agregar Comentario</DialogTitle>
                              <DialogDescription>Agregue un comentario a la incidencia de {inc.clientName}</DialogDescription>
                            </DialogHeader>
                            <Textarea placeholder="Escriba su comentario..." value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={3} />
                            <Button onClick={() => handleAddComment(inc.id)} className="gap-2"><Send className="h-4 w-4" /> Enviar</Button>
                          </DialogContent>
                        </Dialog>

                        {/* Upload evidence */}
                        {canEdit && (
                          <>
                            <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={(e) => handleFileUpload(inc.id, e)} />
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
                              <Camera className="h-3 w-3" /> Evidencia
                            </Button>
                          </>
                        )}

                        {/* Send CS request */}
                        {canEdit && !inc.csRequestSent && (
                          <Dialog>
                            <DialogTrigger asChild><Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Phone className="h-3 w-3" /> Solicitar a Serv. al Cliente</Button></DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Solicitud a {CS_RECIPIENT.name}</DialogTitle>
                                <DialogDescription>Indique qué debe gestionar con el cliente {inc.clientName}</DialogDescription>
                              </DialogHeader>
                              <Textarea placeholder="Describa lo que debe comunicar o gestionar con el cliente..." value={csMessage} onChange={(e) => setCsMessage(e.target.value)} rows={4} />
                              <Button onClick={() => handleSendCSRequest(inc)} className="gap-2"><Send className="h-4 w-4" /> Enviar Solicitud</Button>
                            </DialogContent>
                          </Dialog>
                        )}
                        {inc.csRequestSent && (
                          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
                            📨 Solicitud CS enviada {inc.csCompletedDate ? "✓ Completada" : "⏳ Pendiente"}
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-2">
                        Creado: {new Date(inc.createdAt).toLocaleDateString("es-DO")} por {inc.createdBy}
                        {inc.resolvedAt && ` • Resuelto: ${new Date(inc.resolvedAt).toLocaleDateString("es-DO")} por ${inc.resolvedBy}`}
                      </p>
                    </CardContent>
                  </Card>
                ))}
                {filteredIncidents.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No hay incidencias que coincidan con los filtros.</p>}
              </div>
            </TabsContent>

            {/* ── BILLING ── */}
            <TabsContent value="billing" className="space-y-4">
              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Facturación vs Monitoreo</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <p className="text-3xl font-bold text-emerald-400">{stats.conFacturacion}</p>
                      <p className="text-xs text-muted-foreground">Con facturación CxC</p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                      <p className="text-3xl font-bold text-red-400">{stats.sinFacturacion}</p>
                      <p className="text-xs text-muted-foreground">Sin facturación CxC</p>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                      <p className="text-3xl font-bold text-amber-400">{clients.filter(c => c.monitoringStatus === "Activo" && !c.hasBilling).length}</p>
                      <p className="text-xs text-muted-foreground">Activos sin factura (riesgo)</p>
                    </div>
                  </div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Clientes sin facturación</h4>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {clients.filter(c => !c.hasBilling).map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex-1"><p className="text-sm font-medium text-foreground">{c.businessName}</p><p className="text-xs text-muted-foreground">{c.accountCode ? `#${c.accountCode}` : "Sin código"}</p></div>
                        <Badge variant="outline" className={STATUS_COLORS[c.monitoringStatus]}>{c.monitoringStatus}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-sm">Detalle Facturación</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Negocio</TableHead><TableHead>Estado</TableHead><TableHead>Cliente CxC</TableHead><TableHead>Servicio</TableHead><TableHead>Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clients.filter(c => c.hasBilling).slice(0, 80).map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="text-sm font-medium">{c.businessName}</TableCell>
                            <TableCell><Badge variant="outline" className={`${STATUS_COLORS[c.monitoringStatus]} text-xs`}>{c.monitoringStatus}</Badge></TableCell>
                            <TableCell className="text-sm">{c.billingClient || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.billingDescription || "—"}</TableCell>
                            <TableCell className="text-xs">{c.billingEmail || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── REPORTS ── */}
            <TabsContent value="reports" className="space-y-4">
              <div className="flex gap-3 items-center">
                <Select value={reportType} onValueChange={(v: "diario" | "semanal") => setReportType(v)}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="diario">Reporte Diario</SelectItem><SelectItem value="semanal">Reporte Semanal</SelectItem></SelectContent>
                </Select>
              </div>

              {reportType === "diario" && report.daily && (
                <div className="space-y-4">
                  <Card className="bg-card border-border">
                    <CardHeader><CardTitle className="text-sm">Reporte del {report.daily.date}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-muted/30 text-center"><p className="text-2xl font-bold text-foreground">{report.daily.total}</p><p className="text-xs text-muted-foreground">Total Incidencias</p></div>
                        <div className="p-3 rounded-lg bg-muted/30 text-center"><p className="text-2xl font-bold text-emerald-400">{report.daily.resolved}</p><p className="text-xs text-muted-foreground">Resueltas Hoy</p></div>
                        <div className="p-3 rounded-lg bg-muted/30 text-center"><p className="text-2xl font-bold text-blue-400">{report.daily.opened}</p><p className="text-xs text-muted-foreground">Abiertas Hoy</p></div>
                        <div className="p-3 rounded-lg bg-muted/30 text-center"><p className="text-2xl font-bold text-amber-400">{report.daily.pending}</p><p className="text-xs text-muted-foreground">Pendientes Totales</p></div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Card className="bg-card border-border">
                      <CardHeader><CardTitle className="text-sm">Por Prioridad</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(report.daily.byPriority).map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between">
                              <Badge className={`${INC_PRIORITY_COLORS[k as IncidentPriority]} text-xs`}>{k}</Badge>
                              <span className="text-sm font-medium text-foreground">{v as number}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                      <CardHeader><CardTitle className="text-sm">Por Estado</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(report.daily.byStatus).filter(([, v]) => (v as number) > 0).map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">{INC_STATUS_LABELS[k as IncidentStatus]}</span>
                              <span className="text-sm font-medium text-foreground">{v as number}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {reportType === "semanal" && report.weekly && (
                <div className="space-y-4">
                  <Card className="bg-card border-border">
                    <CardHeader><CardTitle className="text-sm">Reporte Semanal: {report.weekly.startDate} al {report.weekly.endDate}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="p-3 rounded-lg bg-muted/30 text-center"><p className="text-2xl font-bold text-foreground">{report.weekly.totalIncidents}</p><p className="text-xs text-muted-foreground">Total</p></div>
                        <div className="p-3 rounded-lg bg-muted/30 text-center"><p className="text-2xl font-bold text-emerald-400">{report.weekly.totalResolved}</p><p className="text-xs text-muted-foreground">Resueltas</p></div>
                        <div className="p-3 rounded-lg bg-muted/30 text-center"><p className="text-2xl font-bold text-amber-400">{report.weekly.totalPending}</p><p className="text-xs text-muted-foreground">Pendientes</p></div>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={report.weekly.dailyReports.map(d => ({ date: d.date.slice(5), opened: d.opened, resolved: d.resolved }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                          <Bar dataKey="opened" name="Abiertas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="resolved" name="Resueltas" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Legend />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* ── CS REQUESTS (for Perla) ── */}
            {(isCSUser || canTestCS) && (
              <TabsContent value="cs" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Phone className="h-5 w-5 text-primary" /> Solicitudes de Contacto con Clientes</h2>
                  {canTestCS && !isCSUser && (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                      const demoReq: CSRequestType = {
                        id: "demo-" + Date.now(),
                        incidentId: "demo",
                        clientName: "FARMAMED (Demo)",
                        accountCode: "8003",
                        message: "Contactar al cliente para verificar el estado del sensor. Necesita visita técnica.",
                        requestedBy: user?.fullName || "Sistema",
                        requestedAt: new Date().toISOString(),
                        completed: false,
                        broadcastSent: false,
                      };
                      setSelectedCSRequest(demoReq);
                      setCsOverlayOpen(true);
                    }}>
                      <Eye className="h-4 w-4" /> Probar Overlay CS
                    </Button>
                  )}
                </div>
                {csRequests.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No hay solicitudes pendientes.</p>}
                {csRequests.map(req => (
                  <Card key={req.id} className={`border-border ${!req.completed ? "bg-amber-500/5 border-amber-500/20" : "bg-card"}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-foreground">{req.clientName}</p>
                          {req.accountCode && <p className="text-xs text-muted-foreground font-mono">#{req.accountCode}</p>}
                        </div>
                        <Badge variant={req.completed ? "default" : "secondary"}>{req.completed ? "Completado" : "Pendiente"}</Badge>
                      </div>
                      <p className="text-sm text-foreground bg-muted/30 rounded p-2 mb-2">{req.message}</p>
                      <p className="text-xs text-muted-foreground">Solicitado por {req.requestedBy} • {new Date(req.requestedAt).toLocaleString("es-DO")}</p>
                      {req.completionNotes && (
                        <div className="mt-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                          <p className="text-xs font-medium text-emerald-400">Resultado:</p>
                          <p className="text-sm text-foreground">{req.completionNotes}</p>
                        </div>
                      )}
                      {!req.completed && (
                        <Button className="mt-3 gap-2" size="sm" onClick={() => { setSelectedCSRequest(req); setCsOverlayOpen(true); }}>
                          <CheckCircle2 className="h-4 w-4" /> Gestionar
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            )}
          </Tabs>
        </main>
        <Footer />
      </div>

      <CustomerServiceOverlay
        request={selectedCSRequest}
        open={csOverlayOpen}
        onClose={() => setCsOverlayOpen(false)}
        onComplete={handleCSComplete}
        isCSUser={isCSUser}
        canManage={canEdit}
      />
    </AppLayout>
  );
};

export default ClientTracking;
