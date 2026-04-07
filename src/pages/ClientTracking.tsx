import { useState, useMemo } from "react";
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
import {
  ArrowLeft, Search, Plus, Edit2, Trash2, Save, X, Eye, EyeOff,
  CheckCircle2, AlertTriangle, Clock, Radio, WifiOff, PhoneOff,
  BarChart3, PieChart, TrendingUp, DollarSign, Activity, Filter,
} from "lucide-react";
import {
  getOSMClients, saveOSMClients, addOSMClient, updateOSMClient, deleteOSMClient,
  type OSMClient, type ClientMonitoringStatus, type ClientResolutionStatus,
} from "@/lib/osmClientData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from "recharts";

const STATUS_COLORS: Record<ClientMonitoringStatus, string> = {
  "Activo": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Inactivo": "bg-red-500/20 text-red-400 border-red-500/30",
  "Investigar": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Visita Tecnica": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Sin monitoreo": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "Linea Telefonica": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Safe y Kronos": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "Suspendido": "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const STATUS_ICONS: Record<ClientMonitoringStatus, any> = {
  "Activo": CheckCircle2,
  "Inactivo": WifiOff,
  "Investigar": AlertTriangle,
  "Visita Tecnica": Clock,
  "Sin monitoreo": EyeOff,
  "Linea Telefonica": PhoneOff,
  "Safe y Kronos": Radio,
  "Suspendido": WifiOff,
};

const CHART_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#6b7280", "#8b5cf6", "#06b6d4", "#f97316"];

const ALL_STATUSES: ClientMonitoringStatus[] = ["Activo", "Inactivo", "Investigar", "Visita Tecnica", "Sin monitoreo", "Linea Telefonica", "Safe y Kronos", "Suspendido"];

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
  const [newClient, setNewClient] = useState<Partial<OSMClient>>({
    monitoringStatus: "Activo",
    resolutionStatus: "Pendiente",
    hasBilling: false,
  });

  const refresh = () => setClients(getOSMClients());

  // Filtered clients
  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch = !search || c.businessName.toLowerCase().includes(search.toLowerCase()) ||
        c.accountCode.includes(search) || c.contact.toLowerCase().includes(search.toLowerCase()) ||
        (c.billingClient || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || c.monitoringStatus === statusFilter;
      const matchResolution = resolutionFilter === "all" || c.resolutionStatus === resolutionFilter;
      const matchBilling = billingFilter === "all" ||
        (billingFilter === "con" && c.hasBilling) ||
        (billingFilter === "sin" && !c.hasBilling);
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
    const sinMonitoreo = clients.filter((c) => c.monitoringStatus === "Sin monitoreo").length;
    const investigar = clients.filter((c) => c.monitoringStatus === "Investigar").length;

    const byStatus = ALL_STATUSES.map((s) => ({
      name: s,
      count: clients.filter((c) => c.monitoringStatus === s).length,
    })).filter((d) => d.count > 0);

    const billingPie = [
      { name: "Con Facturación", value: conFacturacion },
      { name: "Sin Facturación", value: sinFacturacion },
    ];

    const resolutionPie = [
      { name: "Resuelto", value: clients.filter((c) => c.resolutionStatus === "Resuelto").length },
      { name: "Pendiente", value: pendientes },
    ];

    const complianceRate = total > 0 ? Math.round((activos / total) * 100) : 0;
    const billingCoverage = total > 0 ? Math.round((conFacturacion / total) * 100) : 0;

    return { total, activos, pendientes, conFacturacion, sinFacturacion, sinMonitoreo, investigar, byStatus, billingPie, resolutionPie, complianceRate, billingCoverage };
  }, [clients]);

  const handleSaveEdit = (id: string) => {
    updateOSMClient(id, editData);
    setEditing(null);
    setEditData({});
    refresh();
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Eliminar este cliente del seguimiento?")) {
      deleteOSMClient(id);
      refresh();
    }
  };

  const handleAdd = () => {
    if (!newClient.businessName) return;
    addOSMClient({
      accountCode: newClient.accountCode || "",
      businessName: newClient.businessName || "",
      contact: newClient.contact || "",
      phone: newClient.phone || "",
      monitoringStatus: (newClient.monitoringStatus as ClientMonitoringStatus) || "Activo",
      resolutionStatus: (newClient.resolutionStatus as ClientResolutionStatus) || "Pendiente",
      notes: newClient.notes || "",
      hasBilling: newClient.hasBilling || false,
      billingClient: newClient.billingClient || "",
      billingDescription: newClient.billingDescription || "",
      billingEmail: newClient.billingEmail || "",
      lastUpdated: new Date().toISOString().slice(0, 10),
      updatedBy: user?.fullName,
    } as OSMClient);
    setShowAddForm(false);
    setNewClient({ monitoringStatus: "Activo", resolutionStatus: "Pendiente", hasBilling: false });
    refresh();
  };

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 max-w-[1600px] mx-auto px-4 sm:px-6 py-6 w-full">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/monitoreo")} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">
                Seguimiento Clientes OSM
              </h1>
              <p className="text-sm text-muted-foreground">
                Control de servicios de monitoreo y comparación con facturación CxC
              </p>
            </div>
          </div>

          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="h-4 w-4" /> Dashboard</TabsTrigger>
              <TabsTrigger value="clients" className="gap-2"><Activity className="h-4 w-4" /> Clientes</TabsTrigger>
              <TabsTrigger value="billing" className="gap-2"><DollarSign className="h-4 w-4" /> Facturación vs Monitoreo</TabsTrigger>
            </TabsList>

            {/* ─── DASHBOARD ─── */}
            <TabsContent value="dashboard" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                  { label: "Total Clientes", value: stats.total, icon: Activity, color: "text-blue-400" },
                  { label: "Activos", value: stats.activos, icon: CheckCircle2, color: "text-emerald-400" },
                  { label: "Pendientes", value: stats.pendientes, icon: Clock, color: "text-amber-400" },
                  { label: "Investigar", value: stats.investigar, icon: AlertTriangle, color: "text-orange-400" },
                  { label: "Sin Monitoreo", value: stats.sinMonitoreo, icon: EyeOff, color: "text-red-400" },
                  { label: "Con Facturación", value: stats.conFacturacion, icon: DollarSign, color: "text-green-400" },
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

              {/* Progress Bars */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Servicios Activos</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Progress value={stats.complianceRate} className="flex-1" />
                      <span className="text-lg font-bold text-foreground">{stats.complianceRate}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{stats.activos} de {stats.total} clientes con servicio activo</p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Cobertura de Facturación</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Progress value={stats.billingCoverage} className="flex-1" />
                      <span className="text-lg font-bold text-foreground">{stats.billingCoverage}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{stats.conFacturacion} de {stats.total} clientes con facturación en CxC</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-card border-border">
                  <CardHeader><CardTitle className="text-sm">Distribución por Estado</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={stats.byStatus}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-30} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                        <Bar dataKey="count" name="Clientes" radius={[4, 4, 0, 0]}>
                          {stats.byStatus.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
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
                          <Cell fill="#10b981" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                        <Legend />
                      </RePieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Pending attention list */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    Clientes que Requieren Atención ({clients.filter((c) => c.resolutionStatus === "Pendiente").length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {clients.filter((c) => c.resolutionStatus === "Pendiente").map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{c.businessName}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.notes}</p>
                        </div>
                        <Badge variant="outline" className={STATUS_COLORS[c.monitoringStatus]}>
                          {c.monitoringStatus}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── CLIENTS TABLE ─── */}
            <TabsContent value="clients" className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por nombre, código, contacto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={resolutionFilter} onValueChange={setResolutionFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Resolución" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                    <SelectItem value="Resuelto">Resuelto</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={billingFilter} onValueChange={setBillingFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Facturación" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="con">Con facturación</SelectItem>
                    <SelectItem value="sin">Sin facturación</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => setShowAddForm(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> Agregar
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">{filtered.length} de {clients.length} clientes</p>

              {/* Add Form */}
              {showAddForm && (
                <Card className="bg-card border-border">
                  <CardHeader><CardTitle className="text-sm">Nuevo Cliente</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Código Cuenta</Label>
                      <Input placeholder="Ej: 8003" value={newClient.accountCode || ""} onChange={(e) => setNewClient({ ...newClient, accountCode: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Nombre Negocio *</Label>
                      <Input placeholder="Nombre del cliente" value={newClient.businessName || ""} onChange={(e) => setNewClient({ ...newClient, businessName: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Contacto</Label>
                      <Input placeholder="Persona de contacto" value={newClient.contact || ""} onChange={(e) => setNewClient({ ...newClient, contact: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Teléfono</Label>
                      <Input placeholder="809-xxx-xxxx" value={newClient.phone || ""} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Estado Monitoreo</Label>
                      <Select value={newClient.monitoringStatus || "Activo"} onValueChange={(v) => setNewClient({ ...newClient, monitoringStatus: v as ClientMonitoringStatus })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Resolución</Label>
                      <Select value={newClient.resolutionStatus || "Pendiente"} onValueChange={(v) => setNewClient({ ...newClient, resolutionStatus: v as ClientResolutionStatus })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pendiente">Pendiente</SelectItem>
                          <SelectItem value="Resuelto">Resuelto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <Switch checked={newClient.hasBilling || false} onCheckedChange={(v) => setNewClient({ ...newClient, hasBilling: v })} />
                      <Label className="text-xs">¿Tiene facturación en CxC?</Label>
                    </div>
                    {newClient.hasBilling && (
                      <>
                        <div>
                          <Label className="text-xs">Cliente Facturación</Label>
                          <Input placeholder="Nombre en CxC" value={newClient.billingClient || ""} onChange={(e) => setNewClient({ ...newClient, billingClient: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Email Facturación</Label>
                          <Input placeholder="email@cliente.com" value={newClient.billingEmail || ""} onChange={(e) => setNewClient({ ...newClient, billingEmail: e.target.value })} />
                        </div>
                      </>
                    )}
                    <div className="md:col-span-3">
                      <Label className="text-xs">Notas</Label>
                      <Textarea placeholder="Observaciones..." value={newClient.notes || ""} onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })} rows={2} />
                    </div>
                    <div className="md:col-span-3 flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancelar</Button>
                      <Button onClick={handleAdd} disabled={!newClient.businessName}>Guardar</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[80px]">Código</TableHead>
                        <TableHead>Negocio / Local</TableHead>
                        <TableHead>Contacto</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Resolución</TableHead>
                        <TableHead>Facturación</TableHead>
                        <TableHead className="w-[300px]">Notas</TableHead>
                        <TableHead className="w-[90px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((client) => {
                        const isEditing = editing === client.id;
                        const Icon = STATUS_ICONS[client.monitoringStatus] || Activity;
                        return (
                          <TableRow key={client.id} className="hover:bg-muted/20">
                            <TableCell className="font-mono text-xs">{isEditing ? <Input value={editData.accountCode ?? client.accountCode} onChange={(e) => setEditData({ ...editData, accountCode: e.target.value })} className="h-7 text-xs" /> : client.accountCode || "—"}</TableCell>
                            <TableCell className="font-medium text-sm max-w-[200px]">
                              {isEditing ? <Input value={editData.businessName ?? client.businessName} onChange={(e) => setEditData({ ...editData, businessName: e.target.value })} className="h-7 text-xs" /> : <span className="truncate block">{client.businessName}</span>}
                            </TableCell>
                            <TableCell className="text-sm">{isEditing ? <Input value={editData.contact ?? client.contact} onChange={(e) => setEditData({ ...editData, contact: e.target.value })} className="h-7 text-xs" /> : client.contact || "—"}</TableCell>
                            <TableCell className="text-sm">{isEditing ? <Input value={editData.phone ?? client.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} className="h-7 text-xs" /> : client.phone || "—"}</TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Select value={editData.monitoringStatus ?? client.monitoringStatus} onValueChange={(v) => setEditData({ ...editData, monitoringStatus: v as ClientMonitoringStatus })}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="outline" className={`${STATUS_COLORS[client.monitoringStatus]} gap-1 text-xs`}>
                                  <Icon className="h-3 w-3" />{client.monitoringStatus}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Select value={editData.resolutionStatus ?? client.resolutionStatus} onValueChange={(v) => setEditData({ ...editData, resolutionStatus: v as ClientResolutionStatus })}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent><SelectItem value="Pendiente">Pendiente</SelectItem><SelectItem value="Resuelto">Resuelto</SelectItem></SelectContent>
                                </Select>
                              ) : (
                                <Badge variant={client.resolutionStatus === "Resuelto" ? "default" : "secondary"} className="text-xs">
                                  {client.resolutionStatus}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {client.hasBilling ? (
                                <span className="text-xs text-emerald-400" title={client.billingClient}>✓ CxC</span>
                              ) : (
                                <span className="text-xs text-red-400">✗ Sin CxC</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[300px]">
                              {isEditing ? <Textarea value={editData.notes ?? client.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} rows={2} className="text-xs" /> : <span className="line-clamp-2">{client.notes || "—"}</span>}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {isEditing ? (
                                  <>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveEdit(client.id)}><Save className="h-3.5 w-3.5 text-emerald-400" /></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(null); setEditData({}); }}><X className="h-3.5 w-3.5" /></Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(client.id); setEditData({}); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(client.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* ─── BILLING COMPARISON ─── */}
            <TabsContent value="billing" className="space-y-4">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Comparación: Servicios Monitoreo vs Facturación CxC
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <p className="text-3xl font-bold text-emerald-400">{stats.conFacturacion}</p>
                      <p className="text-xs text-muted-foreground">Clientes con servicio Y facturación</p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                      <p className="text-3xl font-bold text-red-400">{stats.sinFacturacion}</p>
                      <p className="text-xs text-muted-foreground">Clientes sin facturación en CxC</p>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                      <p className="text-3xl font-bold text-amber-400">
                        {clients.filter((c) => c.monitoringStatus === "Activo" && !c.hasBilling).length}
                      </p>
                      <p className="text-xs text-muted-foreground">Activos sin factura (riesgo)</p>
                    </div>
                  </div>

                  <h4 className="text-sm font-medium text-foreground mb-3">Clientes activos sin facturación vinculada</h4>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {clients.filter((c) => !c.hasBilling).map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{c.businessName}</p>
                          <p className="text-xs text-muted-foreground">{c.accountCode ? `Código: ${c.accountCode}` : "Sin código"} • {c.contact || "Sin contacto"}</p>
                        </div>
                        <Badge variant="outline" className={STATUS_COLORS[c.monitoringStatus]}>
                          {c.monitoringStatus}
                        </Badge>
                      </div>
                    ))}
                    {clients.filter((c) => !c.hasBilling).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">Todos los clientes tienen facturación vinculada ✓</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Billing details table */}
              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-sm">Detalle de Facturación por Cliente</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Negocio (Monitoreo)</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Cliente (CxC)</TableHead>
                          <TableHead>Servicio</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Match</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clients.filter((c) => c.hasBilling).map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="text-sm font-medium">{c.businessName}</TableCell>
                            <TableCell><Badge variant="outline" className={`${STATUS_COLORS[c.monitoringStatus]} text-xs`}>{c.monitoringStatus}</Badge></TableCell>
                            <TableCell className="text-sm">{c.billingClient || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.billingDescription || "—"}</TableCell>
                            <TableCell className="text-xs">{c.billingEmail || "—"}</TableCell>
                            <TableCell><CheckCircle2 className="h-4 w-4 text-emerald-400" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
        <Footer />
      </div>
    </AppLayout>
  );
};

export default ClientTracking;
