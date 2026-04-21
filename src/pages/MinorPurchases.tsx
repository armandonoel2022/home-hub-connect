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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  Plus,
  DollarSign,
  CreditCard,
  Wallet,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  TrendingUp,
  CalendarIcon,
  Upload,
  Eye,
  Ban,
  Pencil,
  Link2,
  AlertTriangle,
  Download,
  AlertCircle,
  RefreshCw,
  Percent,
  ShoppingBag,
  History,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { isApiConfigured, minorPurchasesApi, getFileUrl } from "@/lib/api";
import * as XLSX from "xlsx";
import type { MinorPurchase, PaymentMethod, MinorPurchaseStatus, LinkedDocType } from "@/lib/types";

const AUTO_APPROVE_IDS = ["USR-100", "USR-110", "USR-101"];
const TECH_CATEGORIES = ["Tecnología"];
const APPROVER_TECH = { id: "USR-110", name: "Samuel A. Pérez" };
const APPROVER_DEFAULT = { id: "USR-101", name: "Chrisnel Fabian" };

const FINANCE_EMAILS = ["cfabian@safeone.com.do", "cxc@safeone.com.do", "contabilidad@safeone.com.do"];

const getApprover = (category: string) => (TECH_CATEGORIES.includes(category) ? APPROVER_TECH : APPROVER_DEFAULT);

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
const ALERT_THRESHOLD = 0.2; // 20%

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

const LS_KEY = "safeone_minor_purchases";
const REPOSITION_HISTORY_KEY = "safeone_reposition_history";

interface MonthlyReposition {
  id: string;
  yearMonth: string;
  amountReposed: number;
  requestedBy: string;
  requestedAt: string;
  approvedAt?: string;
  status: "pendiente" | "aprobado" | "reposado";
}

// ==================== FUNCIONES DE UTILIDAD ====================
const getYearMonth = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "yyyy-MM");
};

const getCurrentYearMonth = (): string => getYearMonth(new Date());
const getPreviousYearMonth = (): string => {
  const prevMonth = new Date();
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  return getYearMonth(prevMonth);
};

const getMonthDisplay = (yearMonth: string): string => {
  const [year, month] = yearMonth.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return format(date, "MMMM yyyy", { locale: es });
};

const getTotalSpentInMonth = (purchases: MinorPurchase[], yearMonth: string): number => {
  return purchases
    .filter((p) => {
      const expenseMonth = getYearMonth(p.expenseDate || p.requestedAt);
      return expenseMonth === yearMonth && p.status === "Aprobado" && !p.voided && p.paymentMethod === "Caja Chica";
    })
    .reduce((s, p) => s + p.amount, 0);
};

const getAvailableForMonth = (purchases: MinorPurchase[], yearMonth: string): number => {
  return Math.max(0, CAJA_CHICA_LIMIT - getTotalSpentInMonth(purchases, yearMonth));
};

const canAddExpenseInMonth = (
  purchases: MinorPurchase[],
  yearMonth: string,
  amount: number,
  excludeId?: string,
): boolean => {
  let totalSpent = getTotalSpentInMonth(purchases, yearMonth);
  if (excludeId) {
    const excludedAmount = purchases.find((p) => p.id === excludeId)?.amount || 0;
    totalSpent -= excludedAmount;
  }
  return totalSpent + amount <= CAJA_CHICA_LIMIT;
};

const getPendingReposition = (repositions: MonthlyReposition[]): MonthlyReposition | null => {
  const prevMonth = getPreviousYearMonth();
  return repositions.find((r) => r.yearMonth === prevMonth && r.status === "pendiente") || null;
};

function loadLocal(): MinorPurchase[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveLocal(items: MinorPurchase[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

function loadRepositions(): MonthlyReposition[] {
  try {
    return JSON.parse(localStorage.getItem(REPOSITION_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveRepositions(items: MonthlyReposition[]) {
  localStorage.setItem(REPOSITION_HISTORY_KEY, JSON.stringify(items));
}

interface AdminRequestLite {
  orderNumber: string;
  formType: "orden-compra" | "orden-servicio";
  status: string;
}
function loadAdminOrders(): AdminRequestLite[] {
  try {
    const arr = JSON.parse(localStorage.getItem("safeone_admin_requests") || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const fmt = (n: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(n);
const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
  return format(d, "dd/MM/yyyy", { locale: es });
};

// ==================== GENERADOR DE REPORTE EXCEL CON FORMATO EXACTO ====================
const generateExcelReport = (purchases: MinorPurchase[], periodStart?: string, periodEnd?: string) => {
  // Filtrar solo gastos aprobados de Caja Chica
  const approvedPurchases = purchases.filter(
    (p) => p.status === "Aprobado" && !p.voided && p.paymentMethod === "Caja Chica",
  );

  // Ordenar por fecha
  const sortedPurchases = [...approvedPurchases].sort(
    (a, b) => new Date(a.expenseDate || a.requestedAt).getTime() - new Date(b.expenseDate || b.requestedAt).getTime(),
  );

  // Agrupar por categoría
  const groupedByCategory: Record<string, typeof sortedPurchases> = {};
  sortedPurchases.forEach((p) => {
    let categoryKey = p.category;
    if (categoryKey === "Envío, Peaje y Parqueo") categoryKey = "ENVIO PEAJE Y PARQUEO";
    else if (categoryKey === "Combustible") categoryKey = "COMBUSTIBLE";
    else if (categoryKey === "Reparación") categoryKey = "REPARACION";
    else categoryKey = "OTROS";

    if (!groupedByCategory[categoryKey]) groupedByCategory[categoryKey] = [];
    groupedByCategory[categoryKey].push(p);
  });

  // Definir el orden de categorías
  const categoryOrder = ["COMBUSTIBLE", "ENVIO PEAJE Y PARQUEO", "REPARACION", "OTROS"];

  // Construir las filas del reporte
  const rows: any[] = [];

  // Encabezado del reporte
  rows.push({ A: "SAFEONE SECURITY COMPANY", B: "", C: "", D: "" });
  rows.push({ A: "REPOSICION DE CAJA CHICA", B: "", C: "", D: "" });

  // Rango de fechas
  const minDate =
    sortedPurchases.length > 0
      ? sortedPurchases[0].expenseDate || sortedPurchases[0].requestedAt
      : new Date().toISOString();
  const maxDate =
    sortedPurchases.length > 0
      ? sortedPurchases[sortedPurchases.length - 1].expenseDate ||
        sortedPurchases[sortedPurchases.length - 1].requestedAt
      : new Date().toISOString();
  rows.push({ A: `${fmtDate(minDate)} AL ${fmtDate(maxDate)}`, B: "", C: "", D: "" });
  rows.push({ A: "", B: "", C: "", D: "" });

  let totalGeneral = 0;

  // Recorrer cada categoría en el orden establecido
  categoryOrder.forEach((category) => {
    const items = groupedByCategory[category] || [];
    if (items.length === 0 && category !== "OTROS") {
      // Mostrar categoría vacía
      rows.push({ A: category, B: "", C: "", D: "" });
      rows.push({ A: "", B: "", C: "", D: "" });
      rows.push({ A: "", B: "", C: "", D: "" });
      return;
    }

    // Encabezado de categoría
    rows.push({ A: category, B: "", C: "", D: "" });
    rows.push({ A: "", B: "", C: "", D: "" });

    let categoryTotal = 0;

    // Filas de gastos
    items.forEach((item) => {
      rows.push({
        A: fmtDate(item.expenseDate || item.requestedAt),
        B: item.description,
        C: "",
        D: item.amount,
      });
      categoryTotal += item.amount;
      totalGeneral += item.amount;
    });

    // Espacio y subtotal
    rows.push({ A: "", B: "", C: "", D: "" });
    rows.push({ A: "", B: "", C: "", D: categoryTotal });
    rows.push({ A: "", B: "", C: "", D: "" });
  });

  // Totales finales
  const efectivoEnCaja = Math.max(0, CAJA_CHICA_LIMIT - totalGeneral);

  rows.push({ A: "", B: "", C: "TOTAL GASTOS RD$", D: totalGeneral });
  rows.push({ A: "", B: "", C: "TOTAL EFECTIVO EN CAJA", D: efectivoEnCaja });
  rows.push({ A: "", B: "", C: "TOTAL EN CAJA RD$", D: CAJA_CHICA_LIMIT });
  rows.push({ A: "", B: "", C: "", D: "" });

  // Detalle de efectivo en caja
  rows.push({ A: "Detalle de efectivo en caja", B: "Denominaciones", C: "", D: "Total" });

  const denominations = [2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1];
  let remaining = efectivoEnCaja;

  denominations.forEach((denom) => {
    const count = Math.floor(remaining / denom);
    if (count > 0 || denom === 1) {
      rows.push({
        A: "",
        B: denom.toLocaleString(),
        C: count,
        D: count * denom,
      });
      remaining = remaining % denom;
    } else {
      rows.push({ A: "", B: denom.toLocaleString(), C: "", D: "" });
    }
  });

  // Total final del detalle
  rows.push({ A: "", B: "", C: "", D: "" });
  rows.push({ A: "", B: "", C: "Total", D: efectivoEnCaja });

  // Crear y descargar el archivo Excel
  const ws = XLSX.utils.json_to_sheet(rows, { header: ["A", "B", "C", "D"], skipHeader: true });
  ws["!cols"] = [{ wch: 15 }, { wch: 50 }, { wch: 10 }, { wch: 15 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reporte Caja Chica");
  XLSX.writeFile(wb, `reporte_caja_chica_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

  toast({ title: "Reporte generado", description: "El archivo Excel ha sido descargado con el formato solicitado." });
};

const MinorPurchases = () => {
  const { user, allUsers } = useAuth();
  const apiMode = isApiConfigured();
  const [purchases, setPurchases] = useState<MinorPurchase[]>(() => (apiMode ? [] : loadLocal()));
  const [repositions, setRepositions] = useState<MonthlyReposition[]>(() => loadRepositions());
  const [loading, setLoading] = useState(apiMode);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [voidDialog, setVoidDialog] = useState<MinorPurchase | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [detail, setDetail] = useState<MinorPurchase | null>(null);
  const [repositionDialogOpen, setRepositionDialogOpen] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("__all");
  const [filterMethod, setFilterMethod] = useState<string>("__all");
  const [showVoided, setShowVoided] = useState(false);

  const [chartRange, setChartRange] = useState<"week" | "month" | "year" | "custom">("month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

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

  const isFinance = !!user && FINANCE_EMAILS.includes((user.email || "").toLowerCase());
  const canAutoApprove = (userId: string) => {
    if (AUTO_APPROVE_IDS.includes(userId)) return true;
    const u = allUsers.find((x) => x.id === userId);
    return u?.isDepartmentLeader === true;
  };
  const canApprove =
    !!user && (AUTO_APPROVE_IDS.includes(user.id) || user.isDepartmentLeader || user.isAdmin || isFinance);
  const canManage = isFinance || !!user?.isAdmin;

  useEffect(() => {
    if (!apiMode) {
      setLoading(false);
      return;
    }
    minorPurchasesApi
      .getAll()
      .then(setPurchases)
      .catch(() => toast({ title: "Error", description: "No se pudo cargar el listado.", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [apiMode]);

  const adminOrders = useMemo(() => loadAdminOrders(), [dialogOpen]);
  const availableOrders = useMemo(() => {
    if (!form.linkedDocType) return [];
    const target = form.linkedDocType === "OC" ? "orden-compra" : "orden-servicio";
    return adminOrders.filter((o) => o.formType === target);
  }, [form.linkedDocType, adminOrders]);

  // ==================== LÓGICA MENSUAL ====================
  const currentYearMonth = getCurrentYearMonth();
  const previousYearMonth = getPreviousYearMonth();

  const currentMonthSpent = useMemo(
    () => getTotalSpentInMonth(purchases, currentYearMonth),
    [purchases, currentYearMonth],
  );

  const currentMonthAvailable = CAJA_CHICA_LIMIT - currentMonthSpent;
  const currentMonthPercentage = (currentMonthSpent / CAJA_CHICA_LIMIT) * 100;
  const isLowFunds = currentMonthAvailable < CAJA_CHICA_LIMIT * ALERT_THRESHOLD;

  const previousMonthSpent = useMemo(
    () => getTotalSpentInMonth(purchases, previousYearMonth),
    [purchases, previousYearMonth],
  );

  const pendingReposition = getPendingReposition(repositions);
  const lastReposition = useMemo(() => {
    const completed = repositions.filter((r) => r.status === "aprobado" || r.status === "reposado");
    if (completed.length === 0) return null;
    return completed.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0];
  }, [repositions]);

  const currentMonthRequestsCount = useMemo(() => {
    return purchases.filter((p) => {
      const expenseMonth = getYearMonth(p.expenseDate || p.requestedAt);
      return (
        expenseMonth === currentYearMonth && p.paymentMethod === "Caja Chica" && p.status === "Aprobado" && !p.voided
      );
    }).length;
  }, [purchases, currentYearMonth]);

  const monthlyExpenses = useMemo(() => {
    const monthsMap: Record<string, number> = {};
    purchases
      .filter((p) => p.status === "Aprobado" && !p.voided && p.paymentMethod === "Caja Chica")
      .forEach((p) => {
        const monthKey = getYearMonth(p.expenseDate || p.requestedAt);
        monthsMap[monthKey] = (monthsMap[monthKey] || 0) + p.amount;
      });
    return Object.entries(monthsMap)
      .map(([month, total]) => ({ month: getMonthDisplay(month), total, monthKey: month }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [purchases]);

  useEffect(() => {
    if (isLowFunds && currentMonthAvailable >= 0) {
      setShowAlert(true);
      const timer = setTimeout(() => setShowAlert(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [isLowFunds, currentMonthAvailable]);

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
    reader.onload = (ev) => setReceiptPreview(ev.target?.result as string);
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

  const handleRequestReposition = () => {
    if (!user) return;

    if (previousMonthSpent === 0) {
      toast({
        title: "No hay gastos pendientes",
        description: "El mes anterior no tuvo gastos de Caja Chica.",
        variant: "destructive",
      });
      return;
    }

    if (pendingReposition) {
      toast({
        title: "Ya hay una reposición pendiente",
        description: `Para ${getMonthDisplay(previousYearMonth)}.`,
        variant: "destructive",
      });
      return;
    }

    const newReposition: MonthlyReposition = {
      id: `REP-${Date.now()}`,
      yearMonth: previousYearMonth,
      amountReposed: previousMonthSpent,
      requestedBy: user.fullName,
      requestedAt: new Date().toISOString(),
      status: "pendiente",
    };

    const updated = [newReposition, ...repositions];
    setRepositions(updated);
    saveRepositions(updated);
    setRepositionDialogOpen(false);

    toast({
      title: "Solicitud de reposición registrada",
      description: `Monto a reponer: RD$ ${previousMonthSpent.toLocaleString("es-DO")} (gastos de ${getMonthDisplay(previousYearMonth)})`,
    });
  };

  const handleApproveReposition = (id: string) => {
    const updated = repositions.map((r) =>
      r.id === id ? { ...r, status: "aprobado" as const, approvedAt: new Date().toISOString() } : r,
    );
    setRepositions(updated);
    saveRepositions(updated);
    toast({ title: "Reposición aprobada", description: "El monto será repuesto en la próxima liquidación." });
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (
      !form.description ||
      !form.amount ||
      !form.paymentMethod ||
      !form.category ||
      !form.expenseDate ||
      !form.requestedFor.trim()
    ) {
      toast({
        title: "Faltan campos",
        description: "Descripción, monto, método, categoría, fecha del gasto y solicitante son obligatorios.",
        variant: "destructive",
      });
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Monto inválido", variant: "destructive" });
      return;
    }
    if (new Date(form.expenseDate) > new Date()) {
      toast({
        title: "Fecha inválida",
        description: "La fecha del gasto no puede ser futura.",
        variant: "destructive",
      });
      return;
    }

    // Validación de límite mensual para Caja Chica
    if (form.paymentMethod === "Caja Chica") {
      const expenseYearMonth = getYearMonth(form.expenseDate);
      if (!canAddExpenseInMonth(purchases, expenseYearMonth, amount, editingId || undefined)) {
        const available = getAvailableForMonth(purchases, expenseYearMonth);
        toast({
          title: "Límite mensual excedido",
          description: `El límite de Caja Chica para ${getMonthDisplay(expenseYearMonth)} es RD$ ${CAJA_CHICA_LIMIT.toLocaleString("es-DO")}. Disponible: ${fmt(available)}.`,
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
          updated = { ...(purchases.find((p) => p.id === editingId) as MinorPurchase), ...updates };
        }
        if (receiptFile && receiptPreview && receiptPreview.startsWith("data:")) {
          if (apiMode) {
            updated = await minorPurchasesApi.uploadReceipt(editingId, receiptPreview, receiptFile.name);
          } else {
            updated = { ...updated, receiptUrl: receiptPreview, receiptName: receiptFile.name };
          }
        }
        const next = purchases.map((p) => (p.id === editingId ? updated : p));
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
        updated = {
          ...(purchases.find((p) => p.id === id) as MinorPurchase),
          status: "Aprobado",
          approvedBy: user.fullName,
          approvedAt: new Date().toISOString(),
        };
      }
      const next = purchases.map((p) => (p.id === id ? updated : p));
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
        updated = { ...(purchases.find((p) => p.id === id) as MinorPurchase), status: "Rechazado" };
      }
      const next = purchases.map((p) => (p.id === id ? updated : p));
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
      const next = purchases.map((p) => (p.id === voidDialog.id ? updated : p));
      setPurchases(next);
      if (!apiMode) saveLocal(next);
      toast({ title: "Gasto anulado correctamente" });
      setVoidDialog(null);
      setVoidReason("");
    } catch (err: any) {
      console.error("Error al anular:", err);
      toast({
        title: "Error al anular",
        description: err.message || "Ocurrió un error. Intente nuevamente.",
        variant: "destructive",
      });
    }
  };

  const approvedActive = purchases.filter((p) => p.status === "Aprobado" && !p.voided);
  const pending = purchases.filter((p) => p.status === "Pendiente");
  const totalCajaChica = approvedActive
    .filter((p) => p.paymentMethod === "Caja Chica")
    .reduce((s, p) => s + p.amount, 0);
  const totalTarjeta = approvedActive
    .filter((p) => p.paymentMethod === "Tarjeta Corporativa")
    .reduce((s, p) => s + p.amount, 0);
  const totalGeneral = totalCajaChica + totalTarjeta;

  const categoryChartData = useMemo(() => {
    const now = new Date();
    let from: Date, to: Date;
    if (chartRange === "week") {
      to = now;
      from = new Date(now);
      from.setDate(from.getDate() - 7);
    } else if (chartRange === "month") {
      to = now;
      from = new Date(now);
      from.setMonth(from.getMonth() - 1);
    } else if (chartRange === "year") {
      to = now;
      from = new Date(now);
      from.setFullYear(from.getFullYear() - 1);
    } else {
      from = customFrom ? new Date(customFrom) : new Date(0);
      to = customTo ? new Date(customTo + "T23:59:59") : now;
    }
    const map: Record<string, number> = {};
    approvedActive.forEach((p) => {
      const d = new Date(p.expenseDate || p.requestedAt);
      if (d >= from && d <= to) {
        map[p.category] = (map[p.category] || 0) + p.amount;
      }
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [approvedActive, chartRange, customFrom, customTo]);

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    approvedActive.forEach((p) => {
      const d = new Date(p.expenseDate || p.requestedAt);
      set.add(String(d.getFullYear()));
    });
    set.add(String(new Date().getFullYear()));
    return Array.from(set).sort().reverse();
  }, [approvedActive]);

  const monthlyData = useMemo(() => {
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return months.map((name, i) => {
      const monthPurchases = approvedActive.filter((p) => {
        const d = new Date(p.expenseDate || p.requestedAt);
        return d.getMonth() === i && d.getFullYear().toString() === selectedYear;
      });
      const cajaChica = monthPurchases
        .filter((p) => p.paymentMethod === "Caja Chica")
        .reduce((s, p) => s + p.amount, 0);
      const tarjeta = monthPurchases
        .filter((p) => p.paymentMethod === "Tarjeta Corporativa")
        .reduce((s, p) => s + p.amount, 0);
      return { name, "Caja Chica": cajaChica, "Tarjeta Corporativa": tarjeta };
    });
  }, [approvedActive, selectedYear]);

  const deptData = useMemo(() => {
    const map: Record<string, number> = {};
    approvedActive.forEach((p) => {
      const d = new Date(p.expenseDate || p.requestedAt);
      if (d.getFullYear().toString() !== selectedYear) return;
      map[p.department] = (map[p.department] || 0) + p.amount;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [approvedActive, selectedYear]);

  const filteredHistory = useMemo(() => {
    return purchases
      .filter((p) => {
        if (!showVoided && (p.voided || p.status === "Anulado")) return false;
        const d = p.expenseDate || p.requestedAt.slice(0, 10);
        if (filterFrom && d < filterFrom) return false;
        if (filterTo && d > filterTo) return false;
        if (filterCategory !== "__all" && p.category !== filterCategory) return false;
        if (filterMethod !== "__all" && p.paymentMethod !== filterMethod) return false;
        return true;
      })
      .sort((a, b) => (b.expenseDate || b.requestedAt).localeCompare(a.expenseDate || a.requestedAt));
  }, [purchases, filterFrom, filterTo, filterCategory, filterMethod, showVoided]);

  const statusBadge = (p: MinorPurchase) => {
    if (p.voided || p.status === "Anulado")
      return (
        <Badge variant="outline" className="text-muted-foreground border-dashed">
          <Ban className="h-3 w-3 mr-1" />
          Anulado
        </Badge>
      );
    switch (p.status) {
      case "Aprobado":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Aprobado
          </Badge>
        );
      case "Pendiente":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            <Clock className="h-3 w-3 mr-1" />
            Pendiente
          </Badge>
        );
      case "Rechazado":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rechazado
          </Badge>
        );
    }
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
              <p className="text-sm text-muted-foreground">
                Caja Chica (RD$ {CAJA_CHICA_LIMIT.toLocaleString("es-DO")} mensuales) y Tarjeta Corporativa
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => generateExcelReport(purchases)} className="gap-2">
                <Download className="h-4 w-4" /> Reporte Excel
              </Button>
              <Button
                variant="outline"
                onClick={() => setRepositionDialogOpen(true)}
                className="gap-2"
                disabled={previousMonthSpent === 0 || !!pendingReposition}
              >
                <RefreshCw className="h-4 w-4" /> Solicitar Reposición
              </Button>
              <Dialog
                open={dialogOpen}
                onOpenChange={(o) => {
                  setDialogOpen(o);
                  if (!o) resetForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Nuevo Gasto
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-heading">{editingId ? "Editar Gasto" : "Registrar Gasto"}</DialogTitle>
                    <DialogDescription>
                      Disponible este mes: <strong>{fmt(currentMonthAvailable)}</strong> de {fmt(CAJA_CHICA_LIMIT)}.
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
                        <Select
                          value={form.paymentMethod}
                          onValueChange={(v) => setForm({ ...form, paymentMethod: v as PaymentMethod })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Caja Chica">Caja Chica (RD$20K/mes)</SelectItem>
                            <SelectItem value="Tarjeta Corporativa">Tarjeta Corporativa (sin límite)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Fecha del gasto *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !form.expenseDate && "text-muted-foreground",
                              )}
                            >
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
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
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
                          {allUsers.map((u) => (
                            <option key={u.id} value={u.fullName} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Link2 className="h-4 w-4" /> Vincular a Orden (opcional)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Select
                          value={form.linkedDocType || "__none"}
                          onValueChange={(v) =>
                            setForm({
                              ...form,
                              linkedDocType: (v === "__none" ? "" : v) as LinkedDocType,
                              linkedDocNumber: "",
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
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
                          {availableOrders.map((o) => (
                            <option key={o.orderNumber} value={o.orderNumber}>
                              {o.status}
                            </option>
                          ))}
                        </datalist>
                      </div>
                    </div>

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
                        {receiptFile && (
                          <span className="text-xs text-muted-foreground truncate">{receiptFile.name}</span>
                        )}
                        {!receiptFile && receiptPreview && (
                          <span className="text-xs text-muted-foreground">Comprobante actual</span>
                        )}
                      </div>
                      {receiptPreview && (
                        <div className="mt-2 border border-border rounded-lg p-2 bg-muted/30">
                          {receiptPreview.match(/\.pdf($|\?)/i) || receiptFile?.type === "application/pdf" ? (
                            <a
                              href={receiptPreview}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs underline text-primary"
                            >
                              Ver PDF
                            </a>
                          ) : (
                            <img
                              src={receiptPreview}
                              alt="Vista previa comprobante"
                              className="max-h-40 mx-auto rounded"
                            />
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
          </div>

          {/* Alerta de reposición */}
          {showAlert && isLowFunds && (
            <Alert
              variant="destructive"
              className="bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>¡Alerta de reposición!</AlertTitle>
              <AlertDescription>
                El disponible de Caja Chica para este mes es menor al 20% (RD${" "}
                {currentMonthAvailable.toLocaleString("es-DO")}). Por favor, solicite una reposición para el próximo
                mes.
              </AlertDescription>
            </Alert>
          )}

          {/* Dashboard con indicadores mensuales */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Monto Asignado (mes)</p>
                    <p className="text-lg font-heading font-bold">{fmt(CAJA_CHICA_LIMIT)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                    <Wallet className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Consumo del mes</p>
                    <p className="text-lg font-heading font-bold">{fmt(currentMonthSpent)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                    <Percent className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">% Consumido</p>
                    <p className="text-lg font-heading font-bold">{currentMonthPercentage.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-purple-500/10 shrink-0">
                    <History className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Última reposición</p>
                    {lastReposition ? (
                      <>
                        <p className="text-sm font-heading font-bold">{fmt(lastReposition.amountReposed)}</p>
                        <p className="text-xs text-muted-foreground">{getMonthDisplay(lastReposition.yearMonth)}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin reposiciones</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                    <ShoppingBag className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Solicitudes del mes</p>
                    <p className="text-lg font-heading font-bold">{currentMonthRequestsCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-rose-500/10 shrink-0">
                    <TrendingUp className="h-5 w-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Disponible este mes</p>
                    <p className={cn("text-lg font-heading font-bold", isLowFunds && "text-destructive")}>
                      {fmt(currentMonthAvailable)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de gastos mensuales históricos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-heading">Monto total gastado por mes</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos de gastos mensuales.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyExpenses}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, CAJA_CHICA_LIMIT]} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="hsl(42, 100%, 50%)"
                      strokeWidth={2}
                      dot={{ fill: "hsl(42, 100%, 50%)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="dashboard" className="space-y-4">
            <TabsList>
              <TabsTrigger value="dashboard">
                <TrendingUp className="h-4 w-4 mr-1" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="history">
                <FileText className="h-4 w-4 mr-1" />
                Historial
              </TabsTrigger>
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
              {(isFinance || user?.isAdmin) && (
                <TabsTrigger value="repositions">
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reposiciones
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4">
              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base font-heading">Gastos por Categoría</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={chartRange} onValueChange={(v: any) => setChartRange(v)}>
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Última semana</SelectItem>
                        <SelectItem value="month">Último mes</SelectItem>
                        <SelectItem value="year">Último año</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                    {chartRange === "custom" && (
                      <>
                        <Input
                          type="date"
                          className="h-8 w-36 text-xs"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                        />
                        <Input
                          type="date"
                          className="h-8 w-36 text-xs"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                        />
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {categoryChartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">
                      Sin gastos en el período seleccionado.
                    </p>
                  ) : (
                    <div className="flex justify-center">
                      <ResponsiveContainer width="100%" height={400}>
                        <PieChart>
                          <Pie
                            data={categoryChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={130}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {categoryChartData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmt(v)} />
                          <Legend
                            wrapperStyle={{ fontSize: 12 }}
                            layout="horizontal"
                            verticalAlign="bottom"
                            align="center"
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center justify-end gap-2">
                <Label className="text-xs text-muted-foreground">Año:</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Caja Chica" fill="hsl(42, 100%, 50%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Tarjeta Corporativa" fill="hsl(220, 15%, 18%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-heading">Por Departamento {selectedYear}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {deptData.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-12">Sin gastos en {selectedYear}.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={deptData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {deptData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmt(v)} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-3">
              <Card>
                <CardContent className="pt-5">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                    <div>
                      <Label className="text-xs">Desde</Label>
                      <Input
                        type="date"
                        value={filterFrom}
                        onChange={(e) => setFilterFrom(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Hasta</Label>
                      <Input
                        type="date"
                        value={filterTo}
                        onChange={(e) => setFilterTo(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Categoría</Label>
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all">Todas</SelectItem>
                          {EXPENSE_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Método</Label>
                      <Select value={filterMethod} onValueChange={setFilterMethod}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all">Todos</SelectItem>
                          <SelectItem value="Caja Chica">Caja Chica</SelectItem>
                          <SelectItem value="Tarjeta Corporativa">Tarjeta Corporativa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant={showVoided ? "secondary" : "outline"}
                        size="sm"
                        className="w-full h-8"
                        onClick={() => setShowVoided((v) => !v)}
                      >
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
                          <TableRow>
                            <TableCell colSpan={10} className="text-center text-muted-foreground py-6">
                              Cargando…
                            </TableCell>
                          </TableRow>
                        ) : filteredHistory.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center text-muted-foreground py-6">
                              Sin gastos.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredHistory.map((p) => (
                            <TableRow key={p.id} className={cn(p.voided && "opacity-60")}>
                              <TableCell className="font-mono text-xs">{p.id}</TableCell>
                              <TableCell className="text-sm whitespace-nowrap">
                                {fmtDate(p.expenseDate || p.requestedAt)}
                              </TableCell>
                              <TableCell className="text-sm max-w-[240px] truncate">{p.description}</TableCell>
                              <TableCell className="text-sm">{p.requestedFor || p.requestedByName}</TableCell>
                              <TableCell className="text-sm">{p.category}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {p.paymentMethod === "Caja Chica" ? (
                                    <Wallet className="h-3 w-3 mr-1" />
                                  ) : (
                                    <CreditCard className="h-3 w-3 mr-1" />
                                  )}
                                  {p.paymentMethod}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs font-mono">{p.linkedDocNumber || "—"}</TableCell>
                              <TableCell className="text-right font-semibold">{fmt(p.amount)}</TableCell>
                              <TableCell>{statusBadge(p)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setDetail(p)}
                                    title="Ver detalle"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {canManage && !p.voided && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => openEdit(p)}
                                      title="Editar"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canManage && p.status === "Aprobado" && !p.voided && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      onClick={() => setVoidDialog(p)}
                                      title="Anular"
                                    >
                                      <Ban className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

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
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-3 p-4 border border-border rounded-lg flex-wrap"
                          >
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
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(getFileUrl(p.receiptUrl), "_blank")}
                                >
                                  <Eye className="h-3 w-3 mr-1" /> Comprobante
                                </Button>
                              )}
                              <Button size="sm" onClick={() => handleApprove(p.id)} className="gap-1">
                                <CheckCircle className="h-3 w-3" /> Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(p.id)}
                                className="gap-1"
                              >
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

            {(isFinance || user?.isAdmin) && (
              <TabsContent value="repositions">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-heading">Solicitudes de Reposición</CardTitle>
                    <CardDescription>
                      Las reposiciones son por el monto gastado en el mes anterior (máximo RD${" "}
                      {CAJA_CHICA_LIMIT.toLocaleString("es-DO")}).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {repositions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No hay solicitudes de reposición.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {repositions.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between gap-3 p-4 border border-border rounded-lg flex-wrap"
                          >
                            <div className="space-y-1">
                              <p className="font-medium">{getMonthDisplay(r.yearMonth)}</p>
                              <p className="text-sm">
                                Monto a reponer: <strong>{fmt(r.amountReposed)}</strong>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Solicitado por: {r.requestedBy} · {fmtDate(r.requestedAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  r.status === "pendiente"
                                    ? "outline"
                                    : r.status === "aprobado"
                                      ? "default"
                                      : "secondary"
                                }
                              >
                                {r.status === "pendiente"
                                  ? "Pendiente"
                                  : r.status === "aprobado"
                                    ? "Aprobada"
                                    : "Repuesta"}
                              </Badge>
                              {r.status === "pendiente" && (isFinance || user?.isAdmin) && (
                                <Button size="sm" onClick={() => handleApproveReposition(r.id)}>
                                  Aprobar
                                </Button>
                              )}
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
              <p>
                <strong>ID:</strong> <span className="font-mono">{detail.id}</span>
              </p>
              <p>
                <strong>Fecha del gasto:</strong> {fmtDate(detail.expenseDate)}
              </p>
              <p>
                <strong>Registrado:</strong> {fmtDate(detail.requestedAt)}
              </p>
              <p>
                <strong>Descripción:</strong> {detail.description}
              </p>
              <p>
                <strong>Monto:</strong> {fmt(detail.amount)}
              </p>
              <p>
                <strong>Método:</strong> {detail.paymentMethod}
              </p>
              <p>
                <strong>Categoría:</strong> {detail.category}
              </p>
              <p>
                <strong>Departamento:</strong> {detail.department}
              </p>
              <p>
                <strong>Registrado por:</strong> {detail.requestedByName}
              </p>
              <p>
                <strong>Solicitado por:</strong> {detail.requestedFor || "—"}
              </p>
              {detail.linkedDocNumber && (
                <p>
                  <strong>Vinculado a:</strong> {detail.linkedDocType} {detail.linkedDocNumber}
                </p>
              )}
              <p>
                <strong>Estado:</strong> {statusBadge(detail)}
              </p>
              {detail.approvedBy && (
                <p>
                  <strong>Aprobado por:</strong> {detail.approvedBy}
                </p>
              )}
              {detail.voided && (
                <div className="p-2 rounded bg-destructive/10 text-destructive text-xs">
                  <p>
                    <strong>Anulado por:</strong> {detail.voidedBy}
                  </p>
                  <p>
                    <strong>Motivo:</strong> {detail.voidedReason}
                  </p>
                </div>
              )}
              {detail.notes && (
                <p>
                  <strong>Notas:</strong> {detail.notes}
                </p>
              )}
              {detail.receiptUrl && (
                <div>
                  <p className="font-medium mb-1">Comprobante:</p>
                  {detail.receiptUrl.startsWith("data:application/pdf") || /\.pdf($|\?)/i.test(detail.receiptUrl) ? (
                    <a
                      href={getFileUrl(detail.receiptUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      Abrir PDF
                    </a>
                  ) : (
                    <img
                      src={getFileUrl(detail.receiptUrl)}
                      alt="Comprobante"
                      className="max-h-64 mx-auto rounded border"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Anulación */}
      <Dialog
        open={!!voidDialog}
        onOpenChange={(o) => {
          if (!o) {
            setVoidDialog(null);
            setVoidReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Anular Gasto</DialogTitle>
            <DialogDescription>
              Los gastos no se eliminan; quedan registrados como anulados con justificación obligatoria.
            </DialogDescription>
          </DialogHeader>
          {voidDialog && (
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{voidDialog.description}</p>
                <p className="text-muted-foreground">
                  {fmt(voidDialog.amount)} · {fmtDate(voidDialog.expenseDate || voidDialog.requestedAt)}
                </p>
              </div>
              <div>
                <Label>Justificación * (mín 5 caracteres)</Label>
                <Textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  rows={3}
                  placeholder="Motivo de anulación…"
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVoidDialog(null);
                setVoidReason("");
              }}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleVoid}>
              Anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de reposición */}
      <Dialog open={repositionDialogOpen} onOpenChange={setRepositionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Solicitar Reposición de Caja Chica</DialogTitle>
            <DialogDescription>
              La reposición es por el monto gastado en <strong>{getMonthDisplay(previousYearMonth)}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Monto a reponer</p>
              <p className="text-2xl font-heading font-bold text-primary">{fmt(previousMonthSpent)}</p>
              <p className="text-xs text-muted-foreground mt-1">Gastado en {getMonthDisplay(previousYearMonth)}</p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Límite mensual: {fmt(CAJA_CHICA_LIMIT)}</p>
              <p>Disponible este mes: {fmt(currentMonthAvailable)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepositionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRequestReposition} disabled={previousMonthSpent === 0 || !!pendingReposition}>
              Solicitar Reposición
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default MinorPurchases;
