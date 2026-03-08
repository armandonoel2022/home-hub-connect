import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Plus, DollarSign, CreditCard, Wallet, CheckCircle, Clock, XCircle, FileText, TrendingUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { MinorPurchase, PaymentMethod, MinorPurchaseStatus } from "@/lib/types";

const AUTO_APPROVE_IDS = ["USR-100", "USR-110", "USR-101"]; // Aurelio, Samuel, Chrisnel

// Approval routing: Technology → Samuel A. Pérez, everything else → Chrisnel Fabian
const TECH_CATEGORIES = ["Tecnología"];
const APPROVER_TECH = { id: "USR-110", name: "Samuel A. Pérez" };
const APPROVER_DEFAULT = { id: "USR-101", name: "Chrisnel Fabian" };

const getApprover = (category: string) =>
  TECH_CATEGORIES.includes(category) ? APPROVER_TECH : APPROVER_DEFAULT;

const EXPENSE_CATEGORIES = [
  "Material de Oficina",
  "Limpieza",
  "Alimentos y Bebidas",
  "Transporte",
  "Mantenimiento",
  "Herramientas",
  "Tecnología",
  "Otros",
];

const PIE_COLORS = [
  "hsl(42, 100%, 50%)",
  "hsl(220, 15%, 18%)",
  "hsl(0, 84%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(200, 80%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(30, 90%, 55%)",
  "hsl(170, 60%, 45%)",
];

const MOCK_PURCHASES: MinorPurchase[] = [
  {
    id: "EXP-001",
    description: "Resmas de papel y tóner para impresora",
    amount: 4500,
    paymentMethod: "Caja Chica",
    category: "Material de Oficina",
    department: "Administración",
    requestedBy: "USR-101",
    requestedByName: "Chrisnel Fabian",
    requestedAt: "2026-01-15T10:00:00",
    status: "Aprobado",
    approvedBy: null,
    approvedAt: null,
    receiptUrl: "",
    notes: "",
    purchasedBy: "Victor Sala",
  },
  {
    id: "EXP-002",
    description: "Café y azúcar para oficina",
    amount: 1800,
    paymentMethod: "Caja Chica",
    category: "Alimentos y Bebidas",
    department: "Administración",
    requestedBy: "USR-160",
    requestedByName: "Carmen Sosa",
    requestedAt: "2026-01-20T14:00:00",
    status: "Aprobado",
    approvedBy: "Chrisnel Fabian",
    approvedAt: "2026-01-20T15:00:00",
    receiptUrl: "",
    notes: "",
    purchasedBy: "Victor Sala",
  },
  {
    id: "EXP-003",
    description: "Mouse y teclado para estación de monitoreo",
    amount: 3200,
    paymentMethod: "Tarjeta Corporativa",
    category: "Tecnología",
    department: "Tecnología y Monitoreo",
    requestedBy: "USR-002",
    requestedByName: "Armando Noel",
    requestedAt: "2026-02-05T09:00:00",
    status: "Aprobado",
    approvedBy: null,
    approvedAt: null,
    receiptUrl: "",
    notes: "",
    purchasedBy: "Victor Sala",
  },
  {
    id: "EXP-004",
    description: "Productos de limpieza mensual",
    amount: 2600,
    paymentMethod: "Caja Chica",
    category: "Limpieza",
    department: "Administración",
    requestedBy: "USR-161",
    requestedByName: "Jefferson Constanza",
    requestedAt: "2026-02-10T11:00:00",
    status: "Pendiente",
    approvedBy: null,
    approvedAt: null,
    receiptUrl: "",
    notes: "",
    purchasedBy: "",
  },
  {
    id: "EXP-005",
    description: "Gasolina para vehículo operativo",
    amount: 5000,
    paymentMethod: "Tarjeta Corporativa",
    category: "Transporte",
    department: "Operaciones",
    requestedBy: "USR-005",
    requestedByName: "Remit López",
    requestedAt: "2026-02-15T08:00:00",
    status: "Aprobado",
    approvedBy: null,
    approvedAt: null,
    receiptUrl: "",
    notes: "",
    purchasedBy: "Victor Sala",
  },
  {
    id: "EXP-006",
    description: "Carpetas y organizadores",
    amount: 950,
    paymentMethod: "Caja Chica",
    category: "Material de Oficina",
    department: "Recursos Humanos",
    requestedBy: "USR-006",
    requestedByName: "Dilia Aguasvivas",
    requestedAt: "2026-03-01T10:00:00",
    status: "Aprobado",
    approvedBy: null,
    approvedAt: null,
    receiptUrl: "",
    notes: "",
    purchasedBy: "Victor Sala",
  },
];

const MinorPurchases = () => {
  const { user, allUsers } = useAuth();
  const [purchases, setPurchases] = useState<MinorPurchase[]>(MOCK_PURCHASES);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState("2026");

  // Form state
  const [form, setForm] = useState({
    description: "",
    amount: "",
    paymentMethod: "" as PaymentMethod | "",
    category: "",
    notes: "",
  });

  const canAutoApprove = (userId: string) => {
    if (AUTO_APPROVE_IDS.includes(userId)) return true;
    const u = allUsers.find((x) => x.id === userId);
    return u?.isDepartmentLeader === true;
  };

  const canApprove = user
    ? AUTO_APPROVE_IDS.includes(user.id) || user.isDepartmentLeader || user.isAdmin
    : false;

  const handleSubmit = () => {
    if (!user || !form.description || !form.amount || !form.paymentMethod || !form.category) {
      toast({ title: "Error", description: "Completa todos los campos requeridos.", variant: "destructive" });
      return;
    }
    const autoApproved = canAutoApprove(user.id);
    const newPurchase: MinorPurchase = {
      id: `EXP-${String(purchases.length + 1).padStart(3, "0")}`,
      description: form.description,
      amount: parseFloat(form.amount),
      paymentMethod: form.paymentMethod as PaymentMethod,
      category: form.category,
      department: user.department,
      requestedBy: user.id,
      requestedByName: user.fullName,
      requestedAt: new Date().toISOString(),
      status: autoApproved ? "Aprobado" : "Pendiente",
      approvedBy: autoApproved ? "Auto-aprobado" : null,
      approvedAt: autoApproved ? new Date().toISOString() : null,
      receiptUrl: "",
      notes: form.notes,
      purchasedBy: "",
    };
    setPurchases([newPurchase, ...purchases]);
    setForm({ description: "", amount: "", paymentMethod: "", category: "", notes: "" });
    setDialogOpen(false);
    toast({
      title: autoApproved ? "Gasto registrado y aprobado" : "Solicitud enviada",
      description: autoApproved
        ? "El gasto fue registrado exitosamente."
        : "Tu solicitud está pendiente de aprobación.",
    });
  };

  const handleApprove = (id: string) => {
    if (!user) return;
    setPurchases((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: "Aprobado" as MinorPurchaseStatus, approvedBy: user.fullName, approvedAt: new Date().toISOString() } : p
      )
    );
    toast({ title: "Aprobado", description: "El gasto fue aprobado." });
  };

  const handleReject = (id: string) => {
    if (!user) return;
    setPurchases((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "Rechazado" as MinorPurchaseStatus } : p))
    );
    toast({ title: "Rechazado", description: "El gasto fue rechazado.", variant: "destructive" });
  };

  // Stats
  const approvedPurchases = purchases.filter((p) => p.status === "Aprobado");
  const pendingPurchases = purchases.filter((p) => p.status === "Pendiente");

  const totalCajaChica = approvedPurchases
    .filter((p) => p.paymentMethod === "Caja Chica")
    .reduce((s, p) => s + p.amount, 0);
  const totalTarjeta = approvedPurchases
    .filter((p) => p.paymentMethod === "Tarjeta Corporativa")
    .reduce((s, p) => s + p.amount, 0);
  const totalGeneral = totalCajaChica + totalTarjeta;

  // Monthly chart data
  const monthlyData = useMemo(() => {
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return months.map((name, i) => {
      const monthPurchases = approvedPurchases.filter((p) => {
        const d = new Date(p.requestedAt);
        return d.getMonth() === i && d.getFullYear().toString() === selectedYear;
      });
      const cajaChica = monthPurchases.filter((p) => p.paymentMethod === "Caja Chica").reduce((s, p) => s + p.amount, 0);
      const tarjeta = monthPurchases.filter((p) => p.paymentMethod === "Tarjeta Corporativa").reduce((s, p) => s + p.amount, 0);
      return { name, "Caja Chica": cajaChica, "Tarjeta Corporativa": tarjeta };
    });
  }, [approvedPurchases, selectedYear]);

  // Department pie data
  const deptData = useMemo(() => {
    const map: Record<string, number> = {};
    approvedPurchases.forEach((p) => {
      map[p.department] = (map[p.department] || 0) + p.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [approvedPurchases]);

  const statusBadge = (status: MinorPurchaseStatus) => {
    switch (status) {
      case "Aprobado":
        return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200"><CheckCircle className="h-3 w-3 mr-1" />Aprobado</Badge>;
      case "Pendiente":
        return <Badge variant="outline" className="text-amber-600 border-amber-300"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
      case "Rechazado":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rechazado</Badge>;
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(n);

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">Gastos Menores</h1>
              <p className="text-sm text-muted-foreground">Caja Chica y Tarjeta Corporativa</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Nuevo Gasto
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-heading">Registrar Gasto</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Descripción *</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="¿Qué se necesita comprar?"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Monto (RD$) *</Label>
                      <Input
                        type="number"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label>Método de Pago *</Label>
                      <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v as PaymentMethod })}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Caja Chica">Caja Chica</SelectItem>
                          <SelectItem value="Tarjeta Corporativa">Tarjeta Corporativa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Categoría *</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Notas (opcional)</Label>
                    <Input
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Notas adicionales"
                    />
                  </div>
                  {user && !canAutoApprove(user.id) && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                      ⚠️ Tu solicitud requerirá aprobación de tu líder de departamento.
                    </p>
                  )}
                  <Button onClick={handleSubmit} className="w-full">
                    Registrar Gasto
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total General</p>
                    <p className="text-xl font-heading font-bold text-foreground">{fmt(totalGeneral)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Wallet className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Caja Chica</p>
                    <p className="text-xl font-heading font-bold text-foreground">{fmt(totalCajaChica)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tarjeta Corporativa</p>
                    <p className="text-xl font-heading font-bold text-foreground">{fmt(totalTarjeta)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pendientes</p>
                    <p className="text-xl font-heading font-bold text-foreground">{pendingPurchases.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="dashboard" className="space-y-4">
            <TabsList>
              <TabsTrigger value="dashboard"><TrendingUp className="h-4 w-4 mr-1" />Dashboard</TabsTrigger>
              <TabsTrigger value="history"><FileText className="h-4 w-4 mr-1" />Historial</TabsTrigger>
              {canApprove && (
                <TabsTrigger value="approvals">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Aprobaciones
                  {pendingPurchases.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-destructive text-destructive-foreground">
                      {pendingPurchases.length}
                    </span>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-heading">Gastos Mensuales {selectedYear}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Bar dataKey="Caja Chica" fill="hsl(42, 100%, 50%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Tarjeta Corporativa" fill="hsl(220, 15%, 18%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-heading">Por Departamento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {deptData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history">
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Solicitante</TableHead>
                        <TableHead>Depto.</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.id}</TableCell>
                          <TableCell className="text-sm">{new Date(p.requestedAt).toLocaleDateString("es-DO")}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{p.description}</TableCell>
                          <TableCell className="text-sm">{p.requestedByName}</TableCell>
                          <TableCell className="text-sm">{p.department}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {p.paymentMethod === "Caja Chica" ? <Wallet className="h-3 w-3 mr-1" /> : <CreditCard className="h-3 w-3 mr-1" />}
                              {p.paymentMethod}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{p.category}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(p.amount)}</TableCell>
                          <TableCell>{statusBadge(p.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Approvals Tab */}
            {canApprove && (
              <TabsContent value="approvals">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-heading">Solicitudes Pendientes de Aprobación</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pendingPurchases.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No hay solicitudes pendientes.</p>
                    ) : (
                      <div className="space-y-3">
                        {pendingPurchases.map((p) => (
                          <div key={p.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                            <div className="space-y-1">
                              <p className="font-medium text-sm text-foreground">{p.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.requestedByName} · {p.department} · {p.paymentMethod}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(p.requestedAt).toLocaleDateString("es-DO")}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-heading font-bold text-foreground">{fmt(p.amount)}</span>
                              <Button size="sm" onClick={() => handleApprove(p.id)} className="gap-1">
                                <CheckCircle className="h-3 w-3" /> Aprobar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleReject(p.id)} className="gap-1">
                                <XCircle className="h-3 w-3" /> Rechazar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default MinorPurchases;
