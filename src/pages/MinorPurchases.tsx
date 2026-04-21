import { useEffect, useMemo, useRef, useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Plus, DollarSign, CreditCard, Wallet, CheckCircle, Clock, XCircle, FileText, TrendingUp, CalendarIcon, Upload, Eye, Ban, Pencil, Link2, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { isApiConfigured, minorPurchasesApi, getFileUrl } from "@/lib/api";
import type { MinorPurchase, PaymentMethod, MinorPurchaseStatus, LinkedDocType } from "@/lib/types";

const AUTO_APPROVE_IDS = ["USR-100", "USR-110", "USR-101"]; // Aurelio, Samuel, Chrisnel

// Approval routing
const TECH_CATEGORIES = ["Tecnología"];
const APPROVER_TECH = { id: "USR-110", name: "Samuel A. Pérez" };
const APPROVER_DEFAULT = { id: "USR-101", name: "Chrisnel Fabian" };

// Permisos extendidos por correo (acceso completo de gestión a finanzas)
const FINANCE_EMAILS = [
  "cfabian@safeone.com.do",
  "cxc@safeone.com.do",
  "contabilidad@safeone.com.do",
];

const getApprover = (category: string) =>
  TECH_CATEGORIES.includes(category) ? APPROVER_TECH : APPROVER_DEFAULT;

// Categorías: las originales + las del Excel real (Caja Chica)
const EXPENSE_CATEGORIES = [
  "Combustible",
  "Envío, Peaje y Parqueo",
  "Reparación",
  "Otros",
  "Material de Oficina",
  "Limpieza",
  "Alimentos y Bebidas",
  "Transporte",
  "Mantenimiento",
  "Herramientas",
  "Tecnología",
];

const CAJA_CHICA_LIMIT = 20000;

const PIE_COLORS = [
  "hsl(42, 100%, 50%)",
  "hsl(220, 15%, 18%)",
  "hsl(0, 84%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(200, 80%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(30, 90%, 55%)",
  "hsl(170, 60%, 45%)",
  "hsl(340, 70%, 55%)",
  "hsl(90, 50%, 45%)",
  "hsl(15, 80%, 55%)",
];

// ── localStorage fallback (cuando no hay backend) ──
const LS_KEY = "safeone_minor_purchases";
function loadLocal(): MinorPurchase[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveLocal(items: MinorPurchase[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

// ── Cargar OS/OC existentes desde AdminForms ──
interface AdminRequestLite { orderNumber: string; formType: "orden-compra" | "orden-servicio"; status: string }
function loadAdminOrders(): AdminRequestLite[] {
  try {
    const arr = JSON.parse(localStorage.getItem("safeone_admin_requests") || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

const todayISO = () => format(new Date(), "yyyy-MM-dd");

const MinorPurchases = () => {
  const { user, allUsers } = useAuth();
  const apiMode = isApiConfigured();
  const [purchases, setPurchases] = useState<MinorPurchase[]>(() => apiMode ? [] : loadLocal());
  const [loading, setLoading] = useState(apiMode);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [voidDialog, setVoidDialog] = useState<MinorPurchase | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [detail, setDetail] = useState<MinorPurchase | null>(null);

  // Filtros historial
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("__all");
  const [filterMethod, setFilterMethod] = useState<string>("__all");
  const [showVoided, setShowVoided] = useState(false);

  // Período del gráfico por categoría
  const [chartRange, setChartRange] = useState<"week" | "month" | "year" | "custom">("month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // Form state
  const emptyForm = {
    description: "",
    amount: "",
    paymentMethod: "" as PaymentMethod | "",
    category: "",
    notes: "",
    expenseDate: todayISO(),
    requestedFor: "",
    linkedDocType: "" as LinkedDocType,
    linkedDocNumber: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Permisos ──
  const isFinance = !!user && FINANCE_EMAILS.includes((user.email || "").toLowerCase());
  const canAutoApprove = (userId: string) => {
    if (AUTO_APPROVE_IDS.includes(userId)) return true;
    const u = allUsers.find((x) => x.id === userId);
    return u?.isDepartmentLeader === true;
  };
  const canApprove = !!user && (AUTO_APPROVE_IDS.includes(user.id) || user.isDepartmentLeader || user.isAdmin || isFinance);
  const canManage = isFinance || !!user?.isAdmin; // editar gastos pasados, ver dashboard completo

  // ── Cargar datos ──
  useEffect(() => {
    if (!apiMode) { setLoading(false); return; }
    minorPurchasesApi.getAll()
      .then(setPurchases)
      .catch(() => toast({ title: "Error", description: "No se pudo cargar el listado.", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [apiMode]);

  // ── OS/OC disponibles ──
  const adminOrders = useMemo(() => loadAdminOrders(), [dialogOpen]);
  const availableOrders = useMemo(() => {
    if (!form.linkedDocType) return [];
    const target = form.linkedDocType === "OC" ? "orden-compra" : "orden-servicio";
    return adminOrders.filter(o => o.formType === target);
  }, [form.linkedDocType, adminOrders]);

  // ── Total caja chica activa (no anulada) ──
  const cajaChicaActiveTotal = useMemo(
    () => purchases
      .filter(p => p.paymentMethod === "Caja Chica" && p.status !== "Anulado" && !p.voided)
      .reduce((s, p) => s + p.amount, 0),
    [purchases]
  );

  // ── File handler ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(pdf|jpg|jpeg|png)$/i.test(file.name)) {
      toast({ title: "Formato no permitido", description: "Solo PDF, JPG o PNG.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "Máximo 5MB.", variant: "destructive" });
      return;
    }
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = ev => setReceiptPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setReceiptFile(null);
    setReceiptPreview("");
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openEdit = (p: MinorPurchase) => {
    setEditingId(p.id);
    setForm({
      description: p.description,
      amount: String(p.amount),
      paymentMethod: p.paymentMethod,
      category: p.category,
      notes: p.notes || "",
      expenseDate: p.expenseDate || p.requestedAt.slice(0, 10),
      requestedFor: p.requestedFor || "",
      linkedDocType: (p.linkedDocType || "") as LinkedDocType,
      linkedDocNumber: p.linkedDocNumber || "",
    });
    setReceiptFile(null);
    setReceiptPreview(p.receiptUrl ? getFileUrl(p.receiptUrl) : "");
    setDialogOpen(true);
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!user) return;
    if (!form.description || !form.amount || !form.paymentMethod || !form.category || !form.expenseDate || !form.requestedFor.trim()) {
      toast({ title: "Faltan campos", description: "Descripción, monto, método, categoría, fecha del gasto y solicitante son obligatorios.", variant: "destructive" });
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Monto inválido", variant: "destructive" });
      return;
    }
    // Validación fecha futura
    if (new Date(form.expenseDate) > new Date()) {
      toast({ title: "Fecha inválida", description: "La fecha del gasto no puede ser futura.", variant: "destructive" });
      return;
    }
    // Validación límite Caja Chica
    if (form.paymentMethod === "Caja Chica") {
      const currentTotal = editingId
        ? cajaChicaActiveTotal - (purchases.find(p => p.id === editingId)?.amount || 0)
        : cajaChicaActiveTotal;
      if (currentTotal + amount > CAJA_CHICA_LIMIT) {
        const disponible = Math.max(0, CAJA_CHICA_LIMIT - currentTotal);
        toast({
          title: "Límite Caja Chica excedido",
          description: `Disponible: RD$ ${disponible.toLocaleString("es-DO")}. Solicitado: RD$ ${amount.toLocaleString("es-DO")}.`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      if (editingId) {
        const updates: Partial<MinorPurchase> = {
          description: form.description,
          amount,
          paymentMethod: form.paymentMethod as PaymentMethod,
          category: form.category,
          notes: form.notes,
          expenseDate: form.expenseDate,
          requestedFor: form.requestedFor.trim(),
          linkedDocType: form.linkedDocType || undefined,
          linkedDocNumber: form.linkedDocNumber.trim() || undefined,
        };
        let updated: MinorPurchase;
        if (apiMode) {
          updated = await minorPurchasesApi.update(editingId, updates);
        } else {
          updated = { ...(purchases.find(p => p.id === editingId) as MinorPurchase), ...updates };
        }
        // subir comprobante si se cambió
        if (receiptFile && receiptPreview && receiptPreview.startsWith("data:")) {
          if (apiMode) {
            updated = await minorPurchasesApi.uploadReceipt(editingId, receiptPreview, receiptFile.name);
          } else {
            updated = { ...updated, receiptUrl: receiptPreview, receiptName: receiptFile.name };
          }
        }
        const next = purchases.map(p => p.id === editingId ? updated : p);
        setPurchases(next);
        if (!apiMode) saveLocal(next);
        toast({ title: "Gasto actualizado" });
      } else {
        const autoApproved = canAutoApprove(user.id);
        const approver = autoApproved ? null : getApprover(form.category);
        const base: Omit<MinorPurchase, "id"> = {
          description: form.description,
          amount,
          paymentMethod: form.paymentMethod as PaymentMethod,
          category: form.category,
          department: user.department,
          requestedBy: user.id,
          requestedByName: user.fullName,
          expenseDate: form.expenseDate,
          requestedAt: new Date().toISOString(),
          status: autoApproved ? "Aprobado" : "Pendiente",
          approvedBy: autoApproved ? "Auto-aprobado" : null,
          approvedAt: autoApproved ? new Date().toISOString() : null,
          assignedApprover: approver ? approver.name : null,
          receiptUrl: "",
          notes: form.notes,
          purchasedBy: "",
          requestedFor: form.requestedFor.trim(),
          linkedDocType: form.linkedDocType || undefined,
          linkedDocNumber: form.linkedDocNumber.trim() || undefined,
        };
        let created: MinorPurchase;
        if (apiMode) {
          created = await minorPurchasesApi.create(base);
          if (receiptFile && receiptPreview) {
            created = await minorPurchasesApi.uploadReceipt(created.id, receiptPreview, receiptFile.name);
          }
        } else {
          created = { ...base, id: `MP-${Date.now().toString().slice(-6)}` };
          if (receiptFile && receiptPreview) {
            created = { ...created, receiptUrl: receiptPreview, receiptName: receiptFile.name };
          }
        }
        const next = [created, ...purchases];
        setPurchases(next);
        if (!apiMode) saveLocal(next);
        toast({
          title: autoApproved ? "Gasto registrado y aprobado" : "Solicitud enviada",
          description: autoApproved ? "El gasto fue registrado." : "Pendiente de aprobación.",
        });
      }
      resetForm();
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo guardar.", variant: "destructive" });
    }
  };

  const handleApprove = async (id: string) => {
    if (!user) return;
    try {
      let updated: MinorPurchase;
      if (apiMode) {
        updated = await minorPurchasesApi.approve(id, { by: user.fullName });
      } else {
        updated = { ...(purchases.find(p => p.id === id) as MinorPurchase), status: "Aprobado", approvedBy: user.fullName, approvedAt: new Date().toISOString() };
      }
      const next = purchases.map(p => p.id === id ? updated : p);
      setPurchases(next);
      if (!apiMode) saveLocal(next);
      toast({ title: "Aprobado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (id: string) => {
    if (!user) return;
    try {
      let updated: MinorPurchase;
      if (apiMode) {
        updated = await minorPurchasesApi.reject(id, { by: user.fullName });
      } else {
        updated = { ...(purchases.find(p => p.id === id) as MinorPurchase), status: "Rechazado" };
      }
      const next = purchases.map(p => p.id === id ? updated : p);
      setPurchases(next);
      if (!apiMode) saveLocal(next);
      toast({ title: "Rechazado", variant: "destructive" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleVoid = async () => {
    if (!voidDialog || !user) return;
    if (!voidReason.trim() || voidReason.trim().length < 5) {
      toast({ title: "Justificación requerida", description: "Mínimo 5 caracteres.", variant: "destructive" });
      return;
    }
    try {
      let updated: MinorPurchase;
      if (apiMode) {
        updated = await minorPurchasesApi.voidPurchase(voidDialog.id, { by: user.fullName, reason: voidReason.trim() });
      } else {
        updated = {
          ...voidDialog,
          voided: true,
          voidedReason: voidReason.trim(),
          voidedBy: user.fullName,
          voidedAt: new Date().toISOString(),
          status: "Anulado",
        };
      }
      const next = purchases.map(p => p.id === voidDialog.id ? updated : p);
      setPurchases(next);
      if (!apiMode) saveLocal(next);
      toast({ title: "Gasto anulado" });
      setVoidDialog(null);
      setVoidReason("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ── Stats ──
  const approvedActive = purchases.filter(p => p.status === "Aprobado" && !p.voided);
  const pending = purchases.filter(p => p.status === "Pendiente");
  const totalCajaChica = approvedActive.filter(p => p.paymentMethod === "Caja Chica").reduce((s, p) => s + p.amount, 0);
  const totalTarjeta = approvedActive.filter(p => p.paymentMethod === "Tarjeta Corporativa").reduce((s, p) => s + p.amount, 0);
  const totalGeneral = totalCajaChica + totalTarjeta;
  const efectivoEnCaja = Math.max(0, CAJA_CHICA_LIMIT - totalCajaChica);

  // ── Datos del gráfico por categoría según rango ──
  const categoryChartData = useMemo(() => {
    const now = new Date();
    let from: Date, to: Date;
    if (chartRange === "week") {
      to = now;
      from = new Date(now); from.setDate(from.getDate() - 7);
    } else if (chartRange === "month") {
      to = now;
      from = new Date(now); from.setMonth(from.getMonth() - 1);
    } else if (chartRange === "year") {
      to = now;
      from = new Date(now); from.setFullYear(from.getFullYear() - 1);
    } else {
      from = customFrom ? new Date(customFrom) : new Date(0);
      to = customTo ? new Date(customTo + "T23:59:59") : now;
    }
    const map: Record<string, number> = {};
    approvedActive.forEach(p => {
      const d = new Date(p.expenseDate || p.requestedAt);
      if (d >= from && d <= to) {
        map[p.category] = (map[p.category] || 0) + p.amount;
      }
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [approvedActive, chartRange, customFrom, customTo]);

  // ── Historial filtrado ──
  const filteredHistory = useMemo(() => {
    return purchases.filter(p => {
      if (!showVoided && (p.voided || p.status === "Anulado")) return false;
      const d = p.expenseDate || p.requestedAt.slice(0, 10);
      if (filterFrom && d < filterFrom) return false;
      if (filterTo && d > filterTo) return false;
      if (filterCategory !== "__all" && p.category !== filterCategory) return false;
      if (filterMethod !== "__all" && p.paymentMethod !== filterMethod) return false;
      return true;
    }).sort((a, b) => (b.expenseDate || b.requestedAt).localeCompare(a.expenseDate || a.requestedAt));
  }, [purchases, filterFrom, filterTo, filterCategory, filterMethod, showVoided]);

  const statusBadge = (p: MinorPurchase) => {
    if (p.voided || p.status === "Anulado") return <Badge variant="outline" className="text-muted-foreground border-dashed"><Ban className="h-3 w-3 mr-1" />Anulado</Badge>;
    switch (p.status) {
      case "Aprobado": return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200"><CheckCircle className="h-3 w-3 mr-1" />Aprobado</Badge>;
      case "Pendiente": return <Badge variant="outline" className="text-amber-600 border-amber-300"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
      case "Rechazado": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rechazado</Badge>;
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(n);
  const fmtDate = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
    return format(d, "dd/MM/yyyy", { locale: es });
  };

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">Gastos Menores</h1>
              <p className="text-sm text-muted-foreground">Caja Chica y Tarjeta Corporativa</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Nuevo Gasto
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-heading">{editingId ? "Editar Gasto" : "Registrar Gasto"}</DialogTitle>
                  <DialogDescription>
                    Caja Chica disponible: <strong>{fmt(efectivoEnCaja)}</strong> de {fmt(CAJA_CHICA_LIMIT)}.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Descripción *</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Ej: Pago de gasolina - Victor Salas"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label>Monto (RD$) *</Label>
                      <Input
                        type="number"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        placeholder="0.00"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <Label>Método de Pago *</Label>
                      <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v as PaymentMethod })}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Caja Chica">Caja Chica (límite RD$20K)</SelectItem>
                          <SelectItem value="Tarjeta Corporativa">Tarjeta Corporativa (sin límite)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Fecha del gasto *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.expenseDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {form.expenseDate ? fmtDate(form.expenseDate) : "Seleccionar"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={form.expenseDate ? new Date(form.expenseDate + "T12:00:00") : undefined}
                            onSelect={(d) => d && setForm({ ...form, expenseDate: format(d, "yyyy-MM-dd") })}
                            disabled={(d) => d > new Date()}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Categoría *</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Solicitado por *</Label>
                      <Input
                        list="personnel-list"
                        value={form.requestedFor}
                        onChange={(e) => setForm({ ...form, requestedFor: e.target.value })}
                        placeholder="Persona que solicita el gasto"
                      />
                      <datalist id="personnel-list">
                        {allUsers.map(u => <option key={u.id} value={u.fullName} />)}
                      </datalist>
                    </div>
                  </div>

                  {/* Vincular OS/OC */}
                  <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Link2 className="h-4 w-4" /> Vincular a Orden (opcional)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Select value={form.linkedDocType || "__none"} onValueChange={(v) => setForm({ ...form, linkedDocType: (v === "__none" ? "" : v) as LinkedDocType, linkedDocNumber: "" })}>
                        <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Ninguno</SelectItem>
                          <SelectItem value="OC">Orden de Compra (OC)</SelectItem>
                          <SelectItem value="OS">Orden de Servicio (OS)</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.linkedDocType && (
                        <Input
                          list="orders-list"
                          value={form.linkedDocNumber}
                          onChange={(e) => setForm({ ...form, linkedDocNumber: e.target.value })}
                          placeholder={`Ej: ${form.linkedDocType}-0001`}
                        />
                      )}
                      <datalist id="orders-list">
                        {availableOrders.map(o => <option key={o.orderNumber} value={o.orderNumber}>{o.status}</option>)}
                      </datalist>
                    </div>
                  </div>

                  {/* Comprobante */}
                  <div>
                    <Label>Comprobante (PDF/JPG/PNG, máx 5MB)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        className="hidden"
                        id="receipt-input"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-1" /> {receiptFile ? "Cambiar" : "Subir"}
                      </Button>
                      {receiptFile && <span className="text-xs text-muted-foreground truncate">{receiptFile.name}</span>}
                      {!receiptFile && receiptPreview && <span className="text-xs text-muted-foreground">Comprobante actual</span>}
                    </div>
                    {receiptPreview && (
                      <div className="mt-2 border border-border rounded-lg p-2 bg-muted/30">
                        {receiptPreview.match(/\.pdf($|\?)/i) || receiptFile?.type === "application/pdf" ? (
                          <a href={receiptPreview} target="_blank" rel="noreferrer" className="text-xs underline text-primary">Ver PDF</a>
                        ) : (
                          <img src={receiptPreview} alt="Vista previa comprobante" className="max-h-40 mx-auto rounded" />
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Notas (opcional)</Label>
                    <Input
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Notas adicionales"
                    />
                  </div>

                  {user && !canAutoApprove(user.id) && !editingId && (
                    <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      Tu solicitud requerirá aprobación de tu líder.
                    </p>
                  )}
                  <Button onClick={handleSubmit} className="w-full">
                    {editingId ? "Guardar cambios" : "Registrar Gasto"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0"><DollarSign className="h-5 w-5 text-primary" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Total Gastos</p>
                    <p className="text-lg font-heading font-bold truncate">{fmt(totalGeneral)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0"><Wallet className="h-5 w-5 text-emerald-600" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Caja Chica gastada</p>
                    <p className="text-lg font-heading font-bold truncate">{fmt(totalCajaChica)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-amber-500/10 shrink-0"><Wallet className="h-5 w-5 text-amber-600" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Efectivo en caja</p>
                    <p className={cn("text-lg font-heading font-bold truncate", efectivoEnCaja < 2000 && "text-destructive")}>{fmt(efectivoEnCaja)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-blue-500/10 shrink-0"><CreditCard className="h-5 w-5 text-blue-600" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Tarjeta Corp.</p>
                    <p className="text-lg font-heading font-bold truncate">{fmt(totalTarjeta)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-amber-500/10 shrink-0"><Clock className="h-5 w-5 text-amber-600" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Pendientes</p>
                    <p className="text-lg font-heading font-bold">{pending.length}</p>
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
                  {pending.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-destructive text-destructive-foreground">
                      {pending.length}
                    </span>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-4">
              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base font-heading">Gastos por Categoría</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={chartRange} onValueChange={(v: any) => setChartRange(v)}>
                      <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Última semana</SelectItem>
                        <SelectItem value="month">Último mes</SelectItem>
                        <SelectItem value="year">Último año</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                    {chartRange === "custom" && (
                      <>
                        <Input type="date" className="h-8 w-36 text-xs" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                        <Input type="date" className="h-8 w-36 text-xs" value={customTo} onChange={e => setCustomTo(e.target.value)} />
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {categoryChartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">Sin gastos en el período seleccionado.</p>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={categoryChartData} layout="vertical" margin={{ left: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                          <Tooltip formatter={(v: number) => fmt(v)} />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {categoryChartData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie data={categoryChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {categoryChartData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmt(v)} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-3">
              <Card>
                <CardContent className="pt-5">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                    <div>
                      <Label className="text-xs">Desde</Label>
                      <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">Hasta</Label>
                      <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">Categoría</Label>
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all">Todas</SelectItem>
                          {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Método</Label>
                      <Select value={filterMethod} onValueChange={setFilterMethod}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all">Todos</SelectItem>
                          <SelectItem value="Caja Chica">Caja Chica</SelectItem>
                          <SelectItem value="Tarjeta Corporativa">Tarjeta Corporativa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button variant={showVoided ? "secondary" : "outline"} size="sm" className="w-full h-8" onClick={() => setShowVoided(v => !v)}>
                        {showVoided ? "Ocultar anulados" : "Mostrar anulados"}
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Fecha gasto</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Solicita</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>OC/OS</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Cargando…</TableCell></TableRow>
                        ) : filteredHistory.length === 0 ? (
                          <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Sin gastos.</TableCell></TableRow>
                        ) : filteredHistory.map(p => (
                          <TableRow key={p.id} className={cn(p.voided && "opacity-60")}>
                            <TableCell className="font-mono text-xs">{p.id}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap">{fmtDate(p.expenseDate || p.requestedAt)}</TableCell>
                            <TableCell className="text-sm max-w-[240px] truncate">{p.description}</TableCell>
                            <TableCell className="text-sm">{p.requestedFor || p.requestedByName}</TableCell>
                            <TableCell className="text-sm">{p.category}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {p.paymentMethod === "Caja Chica" ? <Wallet className="h-3 w-3 mr-1" /> : <CreditCard className="h-3 w-3 mr-1" />}
                                {p.paymentMethod}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono">{p.linkedDocNumber || "—"}</TableCell>
                            <TableCell className="text-right font-semibold">{fmt(p.amount)}</TableCell>
                            <TableCell>{statusBadge(p)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetail(p)} title="Ver detalle">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {canManage && !p.voided && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)} title="Editar">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {canManage && p.status === "Aprobado" && !p.voided && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setVoidDialog(p)} title="Anular">
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Approvals Tab */}
            {canApprove && (
              <TabsContent value="approvals">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-heading">Solicitudes Pendientes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pending.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No hay solicitudes pendientes.</p>
                    ) : (
                      <div className="space-y-3">
                        {pending.map((p) => (
                          <div key={p.id} className="flex items-center justify-between gap-3 p-4 border border-border rounded-lg flex-wrap">
                            <div className="space-y-1 min-w-0">
                              <p className="font-medium text-sm">{p.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.requestedByName} · {p.department} · {p.paymentMethod} · {p.category}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Fecha gasto: {fmtDate(p.expenseDate)} · Solicita: {p.requestedFor || "—"}
                                {p.linkedDocNumber ? ` · ${p.linkedDocType}: ${p.linkedDocNumber}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-heading font-bold">{fmt(p.amount)}</span>
                              {p.receiptUrl && (
                                <Button size="sm" variant="outline" onClick={() => window.open(getFileUrl(p.receiptUrl), "_blank")}>
                                  <Eye className="h-3 w-3 mr-1" /> Comprobante
                                </Button>
                              )}
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

      {/* Detalle */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Detalle del Gasto</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <p><strong>ID:</strong> <span className="font-mono">{detail.id}</span></p>
              <p><strong>Fecha del gasto:</strong> {fmtDate(detail.expenseDate)}</p>
              <p><strong>Registrado:</strong> {fmtDate(detail.requestedAt)}</p>
              <p><strong>Descripción:</strong> {detail.description}</p>
              <p><strong>Monto:</strong> {fmt(detail.amount)}</p>
              <p><strong>Método:</strong> {detail.paymentMethod}</p>
              <p><strong>Categoría:</strong> {detail.category}</p>
              <p><strong>Departamento:</strong> {detail.department}</p>
              <p><strong>Registrado por:</strong> {detail.requestedByName}</p>
              <p><strong>Solicitado por:</strong> {detail.requestedFor || "—"}</p>
              {detail.linkedDocNumber && <p><strong>Vinculado a:</strong> {detail.linkedDocType} {detail.linkedDocNumber}</p>}
              <p><strong>Estado:</strong> {statusBadge(detail)}</p>
              {detail.approvedBy && <p><strong>Aprobado por:</strong> {detail.approvedBy}</p>}
              {detail.voided && (
                <div className="p-2 rounded bg-destructive/10 text-destructive text-xs">
                  <p><strong>Anulado por:</strong> {detail.voidedBy}</p>
                  <p><strong>Motivo:</strong> {detail.voidedReason}</p>
                </div>
              )}
              {detail.notes && <p><strong>Notas:</strong> {detail.notes}</p>}
              {detail.receiptUrl && (
                <div>
                  <p className="font-medium mb-1">Comprobante:</p>
                  {detail.receiptUrl.startsWith("data:application/pdf") || /\.pdf($|\?)/i.test(detail.receiptUrl) ? (
                    <a href={getFileUrl(detail.receiptUrl)} target="_blank" rel="noreferrer" className="text-primary underline">Abrir PDF</a>
                  ) : (
                    <img src={getFileUrl(detail.receiptUrl)} alt="Comprobante" className="max-h-64 mx-auto rounded border" />
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Anulación */}
      <Dialog open={!!voidDialog} onOpenChange={(o) => { if (!o) { setVoidDialog(null); setVoidReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Anular Gasto</DialogTitle>
            <DialogDescription>
              Los gastos no se eliminan; quedan registrados como anulados con justificación obligatoria.
            </DialogDescription>
          </DialogHeader>
          {voidDialog && (
            <div className="space-y-3 text-sm">
              <p><strong>{voidDialog.description}</strong> — {fmt(voidDialog.amount)}</p>
              <div>
                <Label>Justificación * (mín 5 caracteres)</Label>
                <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={3} placeholder="Motivo de anulación…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVoidDialog(null); setVoidReason(""); }}>Cancelar</Button>
            <Button variant="destructive" onClick={handleVoid}>Anular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default MinorPurchases;
