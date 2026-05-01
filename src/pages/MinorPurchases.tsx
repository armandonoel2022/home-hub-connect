import { useEffect, useMemo, useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Building2,
  Save,
  Coins,
  CheckCheck,
  Filter,
  Hash,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { isApiConfigured, minorPurchasesApi, getFileUrl, pettyCashApi, auditApi, authApi } from "@/lib/api";
import { Info, ShieldCheck, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import type { MinorPurchase, PaymentMethod, MinorPurchaseStatus, LinkedDocType } from "@/lib/types";

const AUTO_APPROVE_IDS = ["USR-100", "USR-110", "USR-101"];
const TECH_CATEGORIES = ["Tecnología"];
const APPROVER_TECH = { id: "USR-110", name: "Samuel A. Pérez" };
const APPROVER_DEFAULT = { id: "USR-101", name: "Chrisnel Fabian" };

// Único autorizado para aprobar excedentes del límite mensual de Caja Chica
const OVER_LIMIT_APPROVER_EMAIL = "cfabian@safeone.com.do";
const OVER_LIMIT_APPROVER_NAME = "Chrisnel Fabian";

// Usuarios que pueden aplicar reposiciones
const CAN_APPLY_REPOSITION_EMAILS = [
  "cfabian@safeone.com.do", // Chrisnel
  "contabilidad@safeone.com.do", // Xuxa
  "cxc@safeone.com.do", // Cristy
  "anoel@safeone.com.do", // Armando Noel
];

const FINANCE_EMAILS = [
  "cfabian@safeone.com.do",
  "cxc@safeone.com.do",
  "contabilidad@safeone.com.do",
  "anoel@safeone.com.do",
];

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
const ALERT_THRESHOLD = 0.2; // 20% disponible → alerta crítica
const WARNING_THRESHOLD_AMOUNT = 15000; // RD$ 15,000 gastados → warning preventivo (75%)

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
const DENOMINATIONS_KEY = "safeone_denominations";

interface MonthlyReposition {
  id: string;
  yearMonth: string;
  amountReposed: number;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  appliedBy?: string;
  appliedAt?: string;
  status: "pendiente" | "aprobado" | "aplicado";
  purchaseId?: string;
  purchaseDescription?: string;
  kind?: "mensual" | "transaccion";
  note?: string;
}

interface Denomination {
  value: number;
  count: number;
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

const getMonthYearDisplay = (yearMonth: string): string => {
  const [year, month] = yearMonth.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return format(date, "MMM yyyy", { locale: es });
};

const getTotalSpentInMonth = (purchases: MinorPurchase[], yearMonth: string): number => {
  return purchases
    .filter((p) => {
      const expenseMonth = getYearMonth(p.expenseDate || p.requestedAt);
      return expenseMonth === yearMonth && p.status === "Aprobado" && !p.voided && p.paymentMethod === "Caja Chica";
    })
    .reduce((s, p) => s + p.amount, 0);
};

const getAvailableForMonth = (
  purchases: MinorPurchase[],
  yearMonth: string,
  repositions: MonthlyReposition[],
): number => {
  const spent = getTotalSpentInMonth(purchases, yearMonth);

  // Si es el mes actual y la reposición del mes anterior fue aplicada, el límite se reinicia
  if (yearMonth === getCurrentYearMonth()) {
    const prevMonth = getPreviousYearMonth();
    const prevMonthReposition = repositions.find((r) => r.yearMonth === prevMonth && r.status === "aplicado");
    if (prevMonthReposition) {
      // La reposición fue aplicada, el límite es completo nuevamente
      return Math.max(0, CAJA_CHICA_LIMIT - spent);
    }
  }

  return Math.max(0, CAJA_CHICA_LIMIT - spent);
};

const canAddExpenseInMonth = (
  purchases: MinorPurchase[],
  yearMonth: string,
  amount: number,
  repositions: MonthlyReposition[],
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

const getPendingApprovals = (repositions: MonthlyReposition[]): MonthlyReposition[] => {
  return repositions.filter((r) => r.status === "pendiente");
};

const getPendingApplications = (repositions: MonthlyReposition[]): MonthlyReposition[] => {
  return repositions.filter((r) => r.status === "aprobado");
};

const getTotalRepositionsApplied = (repositions: MonthlyReposition[]): number => {
  return repositions.filter((r) => r.status === "aplicado").reduce((sum, r) => sum + r.amountReposed, 0);
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
function saveRepositionsLocal(items: MonthlyReposition[]) {
  localStorage.setItem(REPOSITION_HISTORY_KEY, JSON.stringify(items));
}

function loadDenominations(): Denomination[] {
  try {
    const saved = localStorage.getItem(DENOMINATIONS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [
    { value: 2000, count: 1 },
    { value: 1000, count: 0 },
    { value: 500, count: 0 },
    { value: 200, count: 0 },
    { value: 100, count: 0 },
    { value: 50, count: 4 },
    { value: 25, count: 0 },
    { value: 10, count: 3 },
    { value: 5, count: 3 },
    { value: 1, count: 4 },
  ];
}

function saveDenominations(items: Denomination[]) {
  localStorage.setItem(DENOMINATIONS_KEY, JSON.stringify(items));
}

function getTotalEfectivoFromDenominations(denominations: Denomination[]): number {
  return denominations.reduce((sum, d) => sum + d.value * d.count, 0);
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
const generateExcelReport = (purchases: MinorPurchase[], denominations: Denomination[], selectedMonth: string) => {
  // Filtrar gastos por el mes seleccionado
  const approvedPurchases = purchases.filter(
    (p) =>
      p.status === "Aprobado" &&
      !p.voided &&
      p.paymentMethod === "Caja Chica" &&
      getYearMonth(p.expenseDate || p.requestedAt) === selectedMonth,
  );

  const sortedPurchases = [...approvedPurchases].sort(
    (a, b) => new Date(a.expenseDate || a.requestedAt).getTime() - new Date(b.expenseDate || b.requestedAt).getTime(),
  );

  // Obtener rango de fechas del mes
  const [year, month] = selectedMonth.split("-");
  const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
  const lastDay = new Date(parseInt(year), parseInt(month), 0);
  const dateRange = `${fmtDate(format(firstDay, "yyyy-MM-dd"))} AL ${fmtDate(format(lastDay, "yyyy-MM-dd"))}`;

  // Agrupar por categoría
  const groupedByCategory: Record<string, typeof sortedPurchases> = {};
  sortedPurchases.forEach((p) => {
    let categoryKey = p.category;
    if (categoryKey === "Envío, Peaje y Parqueo") categoryKey = "ENVIO,PEAJE Y PARQUEO";
    else if (categoryKey === "Combustible") categoryKey = "COMBUSTIBLE";
    else if (categoryKey === "Reparación") categoryKey = "REPARACION";
    else categoryKey = "OTROS";

    if (!groupedByCategory[categoryKey]) groupedByCategory[categoryKey] = [];
    groupedByCategory[categoryKey].push(p);
  });

  const categoryOrder = ["COMBUSTIBLE", "ENVIO,PEAJE Y PARQUEO", "REPARACION", "OTROS"];

  // Estilos
  const borderAll = {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } },
  };
  const titleStyle = {
    font: { bold: true, sz: 12 },
    alignment: { horizontal: "center", vertical: "center" },
    border: borderAll,
  };
  const categoryStyle = {
    font: { bold: true, sz: 11 },
    fill: { patternType: "solid", fgColor: { rgb: "FFFF00" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: borderAll,
  };
  const cellStyle = { border: borderAll, alignment: { vertical: "center" } };
  const dateStyle = { ...cellStyle, alignment: { horizontal: "center", vertical: "center" } };
  const moneyStyle = { ...cellStyle, numFmt: '"$"#,##0.00;[Red]("$"#,##0.00);"$"\\ -' };
  const moneyBoldStyle = { ...moneyStyle, font: { bold: true } };
  const labelRightBold = { ...cellStyle, font: { bold: true }, alignment: { horizontal: "right", vertical: "center" } };
  const denomHeaderStyle = {
    font: { bold: true },
    fill: { patternType: "solid", fgColor: { rgb: "D9D9D9" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: borderAll,
  };

  // Build sheet as AOA (array of arrays). Columns: A=Fecha, B=Descripción, C=Monto, D=Subtotal
  const aoa: any[][] = [];
  const styles: Record<string, any> = {};
  const merges: any[] = [];

  const setCell = (r: number, c: number, value: any, style?: any) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    styles[addr] = { value, style };
  };

  // Row 0: Empresa
  aoa.push(["SAFEONE SECURITY COMPANY", "", "", ""]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
  setCell(0, 0, "SAFEONE SECURITY COMPANY", titleStyle);

  // Row 1: Reposición
  aoa.push(["REPOSICION DE CAJA CHICA", "", "", ""]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 3 } });
  setCell(1, 0, "REPOSICION DE CAJA CHICA", titleStyle);

  // Row 2: Rango fechas
  aoa.push([dateRange, "", "", ""]);
  merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 3 } });
  setCell(2, 0, dateRange, titleStyle);

  let r = 3;
  let totalGeneral = 0;

  categoryOrder.forEach((category) => {
    const items = groupedByCategory[category] || [];

    // Encabezado de categoría (merged A:C, subtotal en D vacio inicial)
    aoa.push([category, "", "", ""]);
    merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
    setCell(r, 0, category, categoryStyle);
    setCell(r, 1, "", categoryStyle);
    setCell(r, 2, "", categoryStyle);
    setCell(r, 3, "", categoryStyle);
    r++;

    let categoryTotal = 0;
    const minRows = Math.max(items.length, category === "ENVIO,PEAJE Y PARQUEO" ? 4 : 1);

    for (let i = 0; i < minRows; i++) {
      const item = items[i];
      if (item) {
        aoa.push([fmtDate(item.expenseDate || item.requestedAt), item.description, item.amount, ""]);
        setCell(r, 0, fmtDate(item.expenseDate || item.requestedAt), dateStyle);
        setCell(r, 1, item.description, cellStyle);
        setCell(r, 2, item.amount, moneyStyle);
        setCell(r, 3, "", cellStyle);
        categoryTotal += item.amount;
        totalGeneral += item.amount;
      } else {
        aoa.push(["", "", "", ""]);
        setCell(r, 0, "", cellStyle);
        setCell(r, 1, "", cellStyle);
        setCell(r, 2, "", cellStyle);
        setCell(r, 3, "", cellStyle);
      }
      r++;
    }

    // Fila de subtotal de categoría (en columna D)
    aoa.push(["", "", "", categoryTotal]);
    setCell(r, 0, "", cellStyle);
    setCell(r, 1, "", cellStyle);
    setCell(r, 2, "", moneyBoldStyle);
    setCell(r, 3, categoryTotal, moneyBoldStyle);
    r++;

    // Fila vacia separadora
    aoa.push(["", "", "", ""]);
    r++;
  });

  const efectivoEnCaja = Math.max(0, CAJA_CHICA_LIMIT - totalGeneral);

  // Totales
  aoa.push(["", "", "TOTAL GASTOS RD$", totalGeneral]);
  setCell(r, 2, "TOTAL GASTOS RD$", labelRightBold);
  setCell(r, 3, totalGeneral, moneyBoldStyle);
  r++;

  aoa.push(["", "", "TOTAL EFECTIVO EN CAJA", efectivoEnCaja]);
  setCell(r, 2, "TOTAL EFECTIVO EN CAJA", labelRightBold);
  setCell(r, 3, efectivoEnCaja, moneyBoldStyle);
  r++;

  aoa.push(["", "", "TOTAL EN CAJA RD$", CAJA_CHICA_LIMIT]);
  setCell(r, 2, "TOTAL EN CAJA RD$", labelRightBold);
  setCell(r, 3, CAJA_CHICA_LIMIT, moneyBoldStyle);
  r++;

  // Fila vacia
  aoa.push(["", "", "", ""]);
  r++;

  // Detalle de efectivo (encabezado)
  aoa.push(["Detalle de efectivo en caja", "Denominaciones", "Total", ""]);
  setCell(r, 0, "Detalle de efectivo en caja", denomHeaderStyle);
  setCell(r, 1, "Denominaciones", denomHeaderStyle);
  setCell(r, 2, "Total", denomHeaderStyle);
  r++;

  let totalDenoms = 0;
  denominations.forEach((denom) => {
    const total = denom.value * denom.count;
    totalDenoms += total;
    aoa.push([denom.value, denom.count || "", total || ""]);
    setCell(r, 0, denom.value, { ...cellStyle, numFmt: "#,##0.00", alignment: { horizontal: "right", vertical: "center" } });
    setCell(r, 1, denom.count || "", { ...cellStyle, alignment: { horizontal: "center", vertical: "center" } });
    setCell(r, 2, total || "", moneyStyle);
    r++;
  });

  // Total denominaciones
  aoa.push(["", "", totalDenoms, ""]);
  setCell(r, 1, "", { ...cellStyle, font: { bold: true } });
  setCell(r, 2, totalDenoms, moneyBoldStyle);
  r++;

  // Build worksheet
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Apply styles
  Object.entries(styles).forEach(([addr, info]) => {
    if (!ws[addr]) ws[addr] = { t: typeof info.value === "number" ? "n" : "s", v: info.value };
    if (info.style) (ws[addr] as any).s = info.style;
  });

  ws["!cols"] = [{ wch: 14 }, { wch: 50 }, { wch: 14 }, { wch: 14 }];
  ws["!merges"] = merges;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Reporte_${selectedMonth}`);
  XLSX.writeFile(wb, `reposicion_caja_chica_${selectedMonth}.xlsx`);

  toast({ title: "Reporte generado", description: `Reporte de ${getMonthDisplay(selectedMonth)} descargado.` });
};

const MinorPurchases = () => {
  const { user, allUsers } = useAuth();
  const navigate = useNavigate();
  const apiMode = isApiConfigured();
  const [purchases, setPurchases] = useState<MinorPurchase[]>(() => (apiMode ? [] : loadLocal()));
  const [repositions, setRepositions] = useState<MonthlyReposition[]>(() => loadRepositions());
  const [denominations, setDenominations] = useState<Denomination[]>(() => loadDenominations());
  const [loading, setLoading] = useState(apiMode);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [voidDialog, setVoidDialog] = useState<MinorPurchase | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [reassignDialog, setReassignDialog] = useState<MinorPurchase | null>(null);
  const [reassignNewId, setReassignNewId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [reassignBusy, setReassignBusy] = useState(false);
  const [detail, setDetail] = useState<MinorPurchase | null>(null);
  const [repositionDialogOpen, setRepositionDialogOpen] = useState(false);
  const [repositionMonth, setRepositionMonth] = useState<string>(getPreviousYearMonth());
  const [otherMonthDialogOpen, setOtherMonthDialogOpen] = useState(false);
  const [denominationsDialogOpen, setDenominationsDialogOpen] = useState(false);
  const [editingDenominations, setEditingDenominations] = useState<Denomination[]>([]);
  const [showAlert, setShowAlert] = useState(false);

  // Diálogo de política y cálculos
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);

  // Diálogo de autorización de excedente del límite mensual
  const [overLimitDialog, setOverLimitDialog] = useState<{
    open: boolean;
    requestedAmount: number;
    available: number;
    excess: number;
    yearMonth: string;
  } | null>(null);
  const [overLimitPassword, setOverLimitPassword] = useState("");
  const [overLimitJustification, setOverLimitJustification] = useState("");
  const [overLimitBusy, setOverLimitBusy] = useState(false);
  // Cuando Chrisnel ya autorizó el excedente del gasto en curso, se guarda aquí
  const [authorizedOverLimit, setAuthorizedOverLimit] = useState<{
    by: string;
    at: string;
    justification: string;
  } | null>(null);
  const [reportMonth, setReportMonth] = useState<string>(getCurrentYearMonth());

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
    requestedForDepartment: "",
    linkedDocType: "" as LinkedDocType,
    linkedDocNumber: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userEmail = user?.email || "";
  const isFinance = !!user && FINANCE_EMAILS.some((email) => userEmail.toLowerCase().includes(email.toLowerCase()));
  const canApproveReposition = !!user && (isFinance || user?.isAdmin);
  const canApplyReposition =
    !!user &&
    (isFinance ||
      user?.isAdmin ||
      CAN_APPLY_REPOSITION_EMAILS.some((email) => userEmail.toLowerCase().includes(email.toLowerCase())));

  const canAutoApprove = (userId: string) => {
    if (AUTO_APPROVE_IDS.includes(userId)) return true;
    const u = allUsers.find((x) => x.id === userId);
    return u?.isDepartmentLeader === true;
  };
  const canApprove =
    !!user && (AUTO_APPROVE_IDS.includes(user.id) || user.isDepartmentLeader || user.isAdmin || isFinance);
  const canManage = isFinance || !!user?.isAdmin;

  const isRequestedForInList = useMemo(() => {
    if (!form.requestedFor.trim()) return false;
    return allUsers.some((u) => u.fullName.toLowerCase() === form.requestedFor.trim().toLowerCase());
  }, [form.requestedFor, allUsers]);

  const getRequestedForDepartment = useMemo(() => {
    if (!form.requestedFor.trim()) return "";
    const foundUser = allUsers.find((u) => u.fullName.toLowerCase() === form.requestedFor.trim().toLowerCase());
    return foundUser?.department || "";
  }, [form.requestedFor, allUsers]);

  const finalDepartment = isRequestedForInList ? getRequestedForDepartment : form.requestedForDepartment;

  // Obtener meses disponibles para el reporte
  const availableMonthsForReport = useMemo(() => {
    const monthsSet = new Set<string>();
    purchases.forEach((p) => {
      if (p.status === "Aprobado" && !p.voided && p.paymentMethod === "Caja Chica") {
        const month = getYearMonth(p.expenseDate || p.requestedAt);
        monthsSet.add(month);
      }
    });
    if (monthsSet.size === 0) monthsSet.add(getCurrentYearMonth());
    return Array.from(monthsSet).sort().reverse();
  }, [purchases]);

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

    // Sincronizar reposiciones y denominaciones con el servidor
    pettyCashApi
      .getState()
      .then((state) => {
        if (state.repositions?.length) {
          setRepositions(state.repositions);
          saveRepositionsLocal(state.repositions);
        }
        if (state.denominations?.length) {
          setDenominations(state.denominations);
          saveDenominations(state.denominations);
        }
      })
      .catch(() => {
        /* fallback to localStorage silently */
      });
  }, [apiMode]);

  const adminOrders = useMemo(() => loadAdminOrders(), [dialogOpen]);
  const availableOrders = useMemo(() => {
    if (!form.linkedDocType) return [];
    const target = form.linkedDocType === "OC" ? "orden-compra" : "orden-servicio";
    return adminOrders.filter((o) => o.formType === target);
  }, [form.linkedDocType, adminOrders]);

  const currentYearMonth = getCurrentYearMonth();
  const previousYearMonth = getPreviousYearMonth();

  const currentMonthSpent = useMemo(
    () => getTotalSpentInMonth(purchases, currentYearMonth),
    [purchases, currentYearMonth],
  );

  const currentMonthAvailable = useMemo(
    () => getAvailableForMonth(purchases, currentYearMonth, repositions),
    [purchases, currentYearMonth, repositions],
  );

  const currentMonthPercentage = (currentMonthSpent / CAJA_CHICA_LIMIT) * 100;
  const isLowFunds = currentMonthAvailable < CAJA_CHICA_LIMIT * ALERT_THRESHOLD;

  const previousMonthSpent = useMemo(
    () => getTotalSpentInMonth(purchases, previousYearMonth),
    [purchases, previousYearMonth],
  );

  const pendingReposition = getPendingReposition(repositions);
  const pendingApprovals = getPendingApprovals(repositions);
  const pendingApplications = getPendingApplications(repositions);
  const totalRepositionsApplied = getTotalRepositionsApplied(repositions);

  const lastReposition = useMemo(() => {
    const applied = repositions.filter((r) => r.status === "aplicado");
    if (applied.length === 0) return null;
    return applied.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0];
  }, [repositions]);

  const currentMonthRequestsCount = useMemo(() => {
    return purchases.filter((p) => {
      const expenseMonth = getYearMonth(p.expenseDate || p.requestedAt);
      return (
        expenseMonth === currentYearMonth && p.paymentMethod === "Caja Chica" && p.status === "Aprobado" && !p.voided
      );
    }).length;
  }, [purchases, currentYearMonth]);

  // ─── Resumen anual (enero–diciembre del año en curso) ───
  const currentYear = currentYearMonth.slice(0, 4);
  const yearlyStats = useMemo(() => {
    const spentByMonth: Record<string, number> = {};
    let totalSpent = 0;
    purchases.forEach((p) => {
      if (p.status !== "Aprobado" || p.voided || p.paymentMethod !== "Caja Chica") return;
      const ym = getYearMonth(p.expenseDate || p.requestedAt);
      if (!ym.startsWith(currentYear)) return;
      spentByMonth[ym] = (spentByMonth[ym] || 0) + p.amount;
      totalSpent += p.amount;
    });
    const monthsWithActivity = Object.keys(spentByMonth).length;
    const monthIndex = parseInt(currentYearMonth.slice(5, 7), 10); // 1-12
    // Asignación YTD = límite mensual * meses transcurridos del año (incluye mes actual)
    const yearlyAssignedYTD = CAJA_CHICA_LIMIT * monthIndex;
    // Asignación anual completa (12 meses) — para proyección/cuadre anual
    const yearlyAssignedFull = CAJA_CHICA_LIMIT * 12;
    // Reposiciones aplicadas en el año
    const yearlyReposed = repositions
      .filter((r) => r.status === "aplicado" && r.yearMonth.startsWith(currentYear))
      .reduce((s, r) => s + (r.amountReposed || 0), 0);
    const utilizationPct = yearlyAssignedYTD > 0 ? (totalSpent / yearlyAssignedYTD) * 100 : 0;
    const utilizationFullPct = yearlyAssignedFull > 0 ? (totalSpent / yearlyAssignedFull) * 100 : 0;
    const avgPerMonth = monthsWithActivity > 0 ? totalSpent / monthsWithActivity : 0;
    return {
      totalSpent,
      yearlyAssigned: yearlyAssignedYTD,
      yearlyAssignedFull,
      yearlyReposed,
      utilizationPct,
      utilizationFullPct,
      avgPerMonth,
      monthsWithActivity,
      monthIndex,
    };
  }, [purchases, repositions, currentYear, currentYearMonth]);

  // Datos para gráfico de barras por mes
  const monthlyBarData = useMemo(() => {
    const monthsMap: Record<string, { month: string; total: number; monthKey: string }> = {};

    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = getYearMonth(date);
      monthsMap[monthKey] = {
        month: getMonthYearDisplay(monthKey),
        total: 0,
        monthKey: monthKey,
      };
    }

    purchases
      .filter((p) => p.status === "Aprobado" && !p.voided && p.paymentMethod === "Caja Chica")
      .forEach((p) => {
        const monthKey = getYearMonth(p.expenseDate || p.requestedAt);
        if (monthsMap[monthKey]) {
          monthsMap[monthKey].total += p.amount;
        } else {
          monthsMap[monthKey] = {
            month: getMonthYearDisplay(monthKey),
            total: p.amount,
            monthKey: monthKey,
          };
        }
      });

    return Object.values(monthsMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [purchases]);

  const totalEfectivoDenominaciones = getTotalEfectivoFromDenominations(denominations);

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
    setAuthorizedOverLimit(null);
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
      requestedForDepartment: p.department || "",
      linkedDocType: (p.linkedDocType || "") as LinkedDocType,
      linkedDocNumber: p.linkedDocNumber || "",
    });
    setReceiptFile(null);
    setReceiptPreview(p.receiptUrl ? getFileUrl(p.receiptUrl) : "");
    setDialogOpen(true);
  };

  // ==================== REPOSICIONES ====================
  const persistRepositions = (next: MonthlyReposition[]) => {
    setRepositions(next);
    saveRepositionsLocal(next);
  };

  const getSpentForMonth = (yearMonth: string) => getTotalSpentInMonth(purchases, yearMonth);

  const handleRequestReposition = async () => {
    if (!user) return;

    const targetMonth = repositionMonth;
    const spent = getSpentForMonth(targetMonth);

    if (spent === 0) {
      toast({
        title: "No hay gastos en ese mes",
        description: `${getMonthDisplay(targetMonth)} no registra gastos de Caja Chica aprobados.`,
        variant: "destructive",
      });
      return;
    }

    const exists = repositions.find((r) => r.yearMonth === targetMonth);
    if (exists) {
      toast({
        title: "Reposición existente",
        description: `Ya existe una reposición ${exists.status} para ${getMonthDisplay(targetMonth)}.`,
        variant: "destructive",
      });
      return;
    }

    let newReposition: MonthlyReposition = {
      id: `REP-${Date.now()}`,
      yearMonth: targetMonth,
      amountReposed: spent,
      requestedBy: user.fullName,
      requestedAt: new Date().toISOString(),
      status: "pendiente",
    };

    if (apiMode) {
      try {
        newReposition = await pettyCashApi.createReposition({
          yearMonth: targetMonth,
          amountReposed: spent,
          requestedBy: user.fullName,
        });
      } catch (e: any) {
        toast({ title: "Error", description: e.message || "No se pudo registrar.", variant: "destructive" });
        return;
      }
    }

    persistRepositions([newReposition, ...repositions]);
    setRepositionDialogOpen(false);

    toast({
      title: "Solicitud de reposición registrada",
      description: `Monto a reponer: RD$ ${spent.toLocaleString("es-DO")} para ${getMonthDisplay(targetMonth)}.`,
    });
  };

  // Reposición individual por transacción (desde el Historial)
  const handleRequestRepositionForPurchase = async (purchase: MinorPurchase) => {
    if (!user) return;
    if (purchase.paymentMethod !== "Caja Chica") {
      toast({
        title: "No aplica",
        description: "Solo los gastos pagados con Caja Chica pueden ser repuestos.",
        variant: "destructive",
      });
      return;
    }
    if (purchase.status !== "Aprobado" || purchase.voided) {
      toast({
        title: "Transacción no elegible",
        description: "Solo gastos aprobados y no anulados pueden reponerse.",
        variant: "destructive",
      });
      return;
    }
    const dup = repositions.find(
      (r) => r.purchaseId === purchase.id,
    );
    if (dup) {
      toast({
        title: "Ya solicitada",
        description: `Esta transacción ya tiene una reposición ${dup.status}.`,
        variant: "destructive",
      });
      return;
    }
    if (!confirm(`¿Solicitar reposición de RD$ ${purchase.amount.toLocaleString("es-DO")} por la transacción ${purchase.id}?`)) return;

    const targetMonth = getYearMonth(purchase.expenseDate || purchase.requestedAt);
    let newReposition: MonthlyReposition = {
      id: `REP-${Date.now()}`,
      yearMonth: targetMonth,
      amountReposed: purchase.amount,
      requestedBy: user.fullName,
      requestedAt: new Date().toISOString(),
      status: "pendiente",
      purchaseId: purchase.id,
      purchaseDescription: purchase.description,
      kind: "transaccion",
    };

    if (apiMode) {
      try {
        newReposition = await pettyCashApi.createReposition({
          yearMonth: targetMonth,
          amountReposed: purchase.amount,
          requestedBy: user.fullName,
          purchaseId: purchase.id,
          purchaseDescription: purchase.description,
        });
      } catch (e: any) {
        toast({ title: "Error", description: e.message || "No se pudo registrar.", variant: "destructive" });
        return;
      }
    }

    persistRepositions([newReposition, ...repositions]);
    toast({
      title: "Reposición solicitada",
      description: `RD$ ${purchase.amount.toLocaleString("es-DO")} · ${purchase.id}`,
    });
  };

  const handleApproveReposition = async (id: string) => {
    if (!user) return;
    if (!canApproveReposition) {
      toast({ title: "Permiso denegado", description: "No tiene permisos para aprobar.", variant: "destructive" });
      return;
    }
    const reposition = repositions.find((r) => r.id === id);
    if (!reposition || reposition.status !== "pendiente") return;

    let updatedRep: MonthlyReposition = {
      ...reposition,
      status: "aprobado",
      approvedBy: user.fullName,
      approvedAt: new Date().toISOString(),
    };
    if (apiMode) {
      try {
        updatedRep = await pettyCashApi.approveReposition(id, user.fullName);
      } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
        return;
      }
    }
    persistRepositions(repositions.map((r) => (r.id === id ? updatedRep : r)));
    toast({
      title: "✅ Reposición aprobada",
      description: "Ahora puede APLICAR la reposición con el botón 'Aplicar Reposición'.",
    });
  };

  const handleDeleteReposition = async (id: string) => {
    if (!user?.isAdmin) {
      toast({ title: "Permiso denegado", description: "Solo Administradores pueden eliminar reposiciones.", variant: "destructive" });
      return;
    }
    const reposition = repositions.find((r) => r.id === id);
    if (!reposition) return;

    const reason = window.prompt(
      `⚠️ ELIMINAR REPOSICIÓN — ${getMonthDisplay(reposition.yearMonth)}\nMonto: RD$ ${reposition.amountReposed.toLocaleString("es-DO")}\nEstado: ${reposition.status}\n\nEsta acción es PERMANENTE y se registrará en la bitácora de auditoría.\n\nIngrese la justificación (mínimo 10 caracteres):`,
      ""
    );
    if (reason === null) return;
    if (reason.trim().length < 10) {
      toast({ title: "Justificación insuficiente", description: "Debe escribir al menos 10 caracteres.", variant: "destructive" });
      return;
    }

    if (apiMode) {
      try {
        await pettyCashApi.removeReposition(id);
      } catch (e: any) {
        toast({ title: "Error", description: e.message || "No se pudo eliminar.", variant: "destructive" });
        return;
      }
      // Auditoría (best-effort, no bloquea si falla)
      try {
        await auditApi.create({
          action: "DELETE_PETTY_CASH_REPOSITION",
          entity: "petty-cash-reposition",
          entityId: id,
          performedBy: user.fullName,
          performedById: user.id,
          reason: reason.trim(),
          details: {
            yearMonth: reposition.yearMonth,
            amountReposed: reposition.amountReposed,
            status: reposition.status,
            requestedBy: reposition.requestedBy,
            approvedBy: reposition.approvedBy,
            appliedBy: reposition.appliedBy,
          },
          timestamp: new Date().toISOString(),
        });
      } catch {
        /* noop */
      }
    }

    persistRepositions(repositions.filter((r) => r.id !== id));
    toast({
      title: "🗑️ Reposición eliminada",
      description: `Se eliminó la reposición de ${getMonthDisplay(reposition.yearMonth)}.`,
    });
  };

  const handleApplyReposition = async (id: string) => {
    if (!user) return;
    if (!canApplyReposition) {
      toast({ title: "Permiso denegado", description: "No tiene permisos para aplicar.", variant: "destructive" });
      return;
    }
    const reposition = repositions.find((r) => r.id === id);
    if (!reposition || reposition.status !== "aprobado") return;

    let updatedRep: MonthlyReposition = {
      ...reposition,
      status: "aplicado",
      appliedBy: user.fullName,
      appliedAt: new Date().toISOString(),
    };
    if (apiMode) {
      try {
        updatedRep = await pettyCashApi.applyReposition(id, user.fullName);
      } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
        return;
      }
    }
    persistRepositions(repositions.map((r) => (r.id === id ? updatedRep : r)));
    toast({
      title: "💰 Reposición aplicada correctamente",
      description: `Se ha repuesto RD$ ${reposition.amountReposed.toLocaleString("es-DO")} a la Caja Chica.`,
    });
  };

  const handleOpenDenominationsDialog = () => {
    setEditingDenominations([...denominations]);
    setDenominationsDialogOpen(true);
  };

  const handleUpdateDenomination = (index: number, field: "value" | "count", newValue: number) => {
    const updated = [...editingDenominations];
    updated[index] = { ...updated[index], [field]: newValue };
    setEditingDenominations(updated);
  };

  const handleSaveDenominations = async () => {
    setDenominations(editingDenominations);
    saveDenominations(editingDenominations);
    if (apiMode) {
      try {
        await pettyCashApi.updateDenominations(editingDenominations);
      } catch {
        /* keep local copy */
      }
    }
    setDenominationsDialogOpen(false);
    toast({ title: "Denominaciones actualizadas", description: "El desglose de efectivo ha sido guardado." });
  };

  const handleAuthorizeOverLimit = async () => {
    if (!overLimitDialog) return;
    const justification = overLimitJustification.trim();
    if (justification.length < 20) {
      toast({
        title: "Justificación requerida",
        description: "Debe describir el motivo del excedente (mínimo 20 caracteres).",
        variant: "destructive",
      });
      return;
    }
    if (!overLimitPassword) {
      toast({ title: "Contraseña requerida", variant: "destructive" });
      return;
    }
    setOverLimitBusy(true);
    try {
      // Verifica las credenciales de Chrisnel sin alterar la sesión actual.
      // Guardamos y restauramos el token actual.
      const currentToken = localStorage.getItem("safeone_token");
      const currentUser = localStorage.getItem("safeone_user");
      try {
        await authApi.login(OVER_LIMIT_APPROVER_EMAIL, overLimitPassword);
      } finally {
        // Restaurar siempre la sesión original
        if (currentToken) localStorage.setItem("safeone_token", currentToken);
        else localStorage.removeItem("safeone_token");
        if (currentUser) localStorage.setItem("safeone_user", currentUser);
        else localStorage.removeItem("safeone_user");
      }
      setAuthorizedOverLimit({
        by: OVER_LIMIT_APPROVER_NAME,
        at: new Date().toISOString(),
        justification,
      });
      setOverLimitDialog(null);
      toast({
        title: "Excedente autorizado",
        description: `${OVER_LIMIT_APPROVER_NAME} autorizó el excedente. Pulse 'Guardar' nuevamente para registrar el gasto.`,
      });
    } catch (err: any) {
      toast({
        title: "Autorización fallida",
        description: err?.message || "Credenciales inválidas de Chrisnel Fabian.",
        variant: "destructive",
      });
    } finally {
      setOverLimitBusy(false);
    }
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

    if (!isRequestedForInList && !form.requestedForDepartment.trim()) {
      toast({
        title: "Departamento requerido",
        description: "Debe seleccionar un departamento para el solicitante no registrado.",
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

    if (form.paymentMethod === "Caja Chica") {
      const expenseYearMonth = getYearMonth(form.expenseDate);
      if (!canAddExpenseInMonth(purchases, expenseYearMonth, amount, repositions, editingId || undefined)) {
        const available = getAvailableForMonth(purchases, expenseYearMonth, repositions);
        const excess = amount - available;
        // Si Chrisnel ya autorizó este excedente para este gasto en curso, dejar pasar
        if (!authorizedOverLimit) {
          setOverLimitDialog({
            open: true,
            requestedAmount: amount,
            available,
            excess,
            yearMonth: expenseYearMonth,
          });
          setOverLimitPassword("");
          setOverLimitJustification("");
          return;
        }
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
          department: finalDepartment,
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
          department: finalDepartment,
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
          ...(authorizedOverLimit
            ? {
                overLimitAuthorized: true,
                overLimitAuthorizedBy: authorizedOverLimit.by,
                overLimitAuthorizedAt: authorizedOverLimit.at,
                overLimitJustification: authorizedOverLimit.justification,
              }
            : {}),
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
          description: authorizedOverLimit
            ? `Excedente autorizado por ${authorizedOverLimit.by}.`
            : autoApproved
            ? "El gasto fue registrado."
            : "Pendiente de aprobación.",
        });
        // Audit log para el excedente autorizado
        if (authorizedOverLimit && apiMode) {
          try {
            await auditApi.create({
              action: "PETTY_CASH_OVER_LIMIT_AUTHORIZED",
              performedBy: user.fullName,
              targetType: "MinorPurchase",
              targetId: created.id,
              reason: authorizedOverLimit.justification,
              details: {
                amount,
                authorizedBy: authorizedOverLimit.by,
                yearMonth: getYearMonth(form.expenseDate),
              },
            });
          } catch {
            /* no-op */
          }
        }
      }
      setAuthorizedOverLimit(null);
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
      toast({
        title: "Justificación requerida",
        description: "Debe escribir una justificación de mínimo 5 caracteres.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!apiMode) {
        const updated = {
          ...voidDialog,
          voided: true,
          voidedReason: voidReason.trim(),
          voidedBy: user.fullName,
          voidedAt: new Date().toISOString(),
          status: "Anulado" as MinorPurchaseStatus,
        };
        const next = purchases.map((p) => (p.id === voidDialog.id ? updated : p));
        setPurchases(next);
        saveLocal(next);
        toast({ title: "✅ Gasto anulado correctamente", description: `Motivo: ${voidReason.trim()}` });
        setVoidDialog(null);
        setVoidReason("");
        return;
      }

      try {
        const updated = await minorPurchasesApi.voidPurchase(voidDialog.id, {
          by: user.fullName,
          reason: voidReason.trim(),
        });
        const next = purchases.map((p) => (p.id === voidDialog.id ? updated : p));
        setPurchases(next);
        toast({ title: "✅ Gasto anulado correctamente", description: `Motivo: ${voidReason.trim()}` });
        setVoidDialog(null);
        setVoidReason("");
      } catch (apiError: any) {
        console.error("API error al anular:", apiError);
        const updated = {
          ...voidDialog,
          voided: true,
          voidedReason: voidReason.trim(),
          voidedBy: user.fullName,
          voidedAt: new Date().toISOString(),
          status: "Anulado" as MinorPurchaseStatus,
        };
        const next = purchases.map((p) => (p.id === voidDialog.id ? updated : p));
        setPurchases(next);
        saveLocal(next);
        toast({
          title: "✅ Gasto anulado (modo local)",
          description: `Motivo: ${voidReason.trim()}.`,
        });
        setVoidDialog(null);
        setVoidReason("");
      }
    } catch (err: any) {
      console.error("Error general al anular:", err);
      toast({
        title: "Error al anular",
        description: err.message || "Ocurrió un error. Intente nuevamente.",
        variant: "destructive",
      });
    }
  };

  const handleReassignId = async () => {
    if (!reassignDialog || !user) return;
    const newId = reassignNewId.trim().toUpperCase();
    const reason = reassignReason.trim();
    if (!/^MP-\d{3,}$/.test(newId)) {
      toast({ title: "Formato inválido", description: "Debe ser MP-### (ej. MP-002).", variant: "destructive" });
      return;
    }
    if (newId === reassignDialog.id) {
      toast({ title: "Sin cambios", description: "El nuevo ID es igual al actual.", variant: "destructive" });
      return;
    }
    if (reason.length < 5) {
      toast({ title: "Justificación requerida", description: "Mínimo 5 caracteres.", variant: "destructive" });
      return;
    }
    // Validación local: si existe otro registro activo (no anulado) con ese ID, bloquear.
    const conflict = purchases.find((p) => p.id === newId);
    if (conflict && !(conflict.voided || conflict.status === "Anulado")) {
      toast({
        title: "ID en uso",
        description: `${newId} pertenece a un gasto activo. Sólo se pueden reutilizar IDs anulados.`,
        variant: "destructive",
      });
      return;
    }

    setReassignBusy(true);
    try {
      const oldId = reassignDialog.id;
      let updated: MinorPurchase;
      if (apiMode) {
        updated = await minorPurchasesApi.reassignId(oldId, { newId, reason, by: user.fullName });
      } else {
        const history = Array.isArray(reassignDialog.idHistory) ? reassignDialog.idHistory.slice() : [];
        history.push({
          previousId: oldId,
          newId,
          changedBy: user.fullName,
          changedAt: new Date().toISOString(),
          reason,
        });
        updated = { ...reassignDialog, id: newId, idHistory: history };
      }
      const next = purchases.map((p) => (p.id === oldId ? updated : p));
      setPurchases(next);
      if (!apiMode) saveLocal(next);
      toast({ title: "ID reasignado", description: `${oldId} → ${newId}` });
      setReassignDialog(null);
      setReassignNewId("");
      setReassignReason("");
    } catch (err: any) {
      toast({
        title: "Error al reasignar",
        description: err?.message || "No se pudo cambiar el ID.",
        variant: "destructive",
      });
    } finally {
      setReassignBusy(false);
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
            <div className="flex items-center gap-3">
              {(() => {
                const canSeeAdminHub = !!user && (user.isAdmin || user.department === "Administración");
                const backTo = canSeeAdminHub ? "/admin/hub" : "/";
                const backLabel = canSeeAdminHub ? "Volver al Hub de Administración" : "Volver al Dashboard";
                return (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(backTo)}
                    title={backLabel}
                    className="shrink-0"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                );
              })()}
              <div>
                <h1 className="text-2xl font-heading font-bold text-foreground">Caja Chica</h1>
                <p className="text-sm text-muted-foreground">
                  Gestión de caja chica · Límite RD$ {CAJA_CHICA_LIMIT.toLocaleString("es-DO")} mensuales
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> Reporte Excel
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Exportar reporte</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => generateExcelReport(purchases, denominations, getCurrentYearMonth())}
                  >
                    Exportar mes actual ({getMonthDisplay(getCurrentYearMonth())})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Otros meses</DropdownMenuLabel>
                  {availableMonthsForReport
                    .filter((m) => m !== getCurrentYearMonth())
                    .slice(0, 12)
                    .map((month) => (
                      <DropdownMenuItem key={month} onClick={() => generateExcelReport(purchases, denominations, month)}>
                        {getMonthDisplay(month)}
                      </DropdownMenuItem>
                    ))}
                  {availableMonthsForReport.filter((m) => m !== getCurrentYearMonth()).length === 0 && (
                    <DropdownMenuItem disabled>Sin otros meses registrados</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={() => setPolicyDialogOpen(true)} className="gap-2">
                <Info className="h-4 w-4" /> Política y cálculos
              </Button>
              <Button variant="outline" onClick={handleOpenDenominationsDialog} className="gap-2">
                <Coins className="h-4 w-4" /> Denominaciones
              </Button>
              <Button
                onClick={() => setRepositionDialogOpen(true)}
                className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-md hover:shadow-lg border-0 font-semibold"
              >
                <RefreshCw className="h-4 w-4" /> Reponer Caja Chica
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
                      {authorizedOverLimit && (
                        <span className="block mt-1 text-xs font-medium text-primary">
                          ✓ Excedente autorizado por {authorizedOverLimit.by}
                        </span>
                      )}
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
                          onChange={(e) => {
                            const value = e.target.value;
                            setForm({ ...form, requestedFor: value });
                          }}
                          placeholder="Nombre de la persona que solicita el gasto"
                          className={cn(!isRequestedForInList && form.requestedFor && "border-amber-500")}
                        />
                        <datalist id="personnel-list">
                          {allUsers.map((u) => (
                            <option key={u.id} value={u.fullName}>
                              {u.department ? `(${u.department})` : ""}
                            </option>
                          ))}
                        </datalist>
                        {!isRequestedForInList && form.requestedFor && (
                          <p className="text-xs text-amber-600 mt-1">
                            ⚠️ Nombre no encontrado en la lista. Debe seleccionar un departamento manualmente.
                          </p>
                        )}
                      </div>
                    </div>

                    {!isRequestedForInList && form.requestedFor && (
                      <div>
                        <Label className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" /> Departamento * (manual)
                        </Label>
                        <Select
                          value={form.requestedForDepartment}
                          onValueChange={(v) => setForm({ ...form, requestedForDepartment: v })}
                        >
                          <SelectTrigger className={cn(!form.requestedForDepartment && "border-destructive")}>
                            <SelectValue placeholder="Seleccionar departamento" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Administración">Administración</SelectItem>
                            <SelectItem value="Contabilidad">Contabilidad</SelectItem>
                            <SelectItem value="CXC">CXC</SelectItem>
                            <SelectItem value="Técnica">Técnica</SelectItem>
                            <SelectItem value="Operaciones">Operaciones</SelectItem>
                            <SelectItem value="Ventas">Ventas</SelectItem>
                            <SelectItem value="IT">IT</SelectItem>
                            <SelectItem value="Recursos Humanos">Recursos Humanos</SelectItem>
                            <SelectItem value="Compras">Compras</SelectItem>
                            <SelectItem value="Logística">Logística</SelectItem>
                          </SelectContent>
                        </Select>
                        {!form.requestedForDepartment && (
                          <p className="text-xs text-destructive mt-1">Departamento requerido</p>
                        )}
                      </div>
                    )}

                    {/* Vincular OS/OC */}
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

          {/* Warning preventivo al alcanzar RD$ 15,000 (75% del límite) */}
          {currentMonthSpent >= WARNING_THRESHOLD_AMOUNT && !isLowFunds && (
            <Alert className="bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>⚠️ Atención: cerca del límite mensual</AlertTitle>
              <AlertDescription>
                Has gastado <strong>{fmt(currentMonthSpent)}</strong> de {fmt(CAJA_CHICA_LIMIT)} ({currentMonthPercentage.toFixed(0)}%).
                Quedan <strong>{fmt(currentMonthAvailable)}</strong> disponibles. Considera planificar una reposición.
              </AlertDescription>
            </Alert>
          )}

          {/* Alerta crítica de reposición (≤20% disponible) */}
          {showAlert && isLowFunds && (
            <Alert
              variant="destructive"
              className="bg-red-50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-800"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>¡Alerta de reposición!</AlertTitle>
              <AlertDescription>
                El disponible de Caja Chica para este mes es menor al 20% (RD${" "}
                {currentMonthAvailable.toLocaleString("es-DO")}). Por favor, solicite una reposición.
              </AlertDescription>
            </Alert>
          )}

          {/* Dashboard con indicadores mensuales + resumen anual */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">Monto Asignado (mes)</p>
                    <p className="text-base lg:text-lg font-heading font-bold truncate">{fmt(CAJA_CHICA_LIMIT)}</p>
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
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">Consumo del mes</p>
                    <p className="text-base lg:text-lg font-heading font-bold truncate">{fmt(currentMonthSpent)}</p>
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
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">% Consumido (mes)</p>
                    <p className="text-base lg:text-lg font-heading font-bold truncate">{currentMonthPercentage.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-rose-200 dark:border-rose-900/40">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-rose-500/10 shrink-0">
                    <TrendingUp className="h-5 w-5 text-rose-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">Disponible actual</p>
                    <p className={cn("text-base lg:text-lg font-heading font-bold truncate", isLowFunds && "text-destructive")}>
                      {fmt(currentMonthAvailable)}
                    </p>
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
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">Última reposición</p>
                    {lastReposition ? (
                      <>
                        <p className="text-sm font-heading font-bold truncate">{fmt(lastReposition.amountReposed)}</p>
                        <p className="text-xs text-muted-foreground truncate">{getMonthDisplay(lastReposition.yearMonth)}</p>
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
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">Solicitudes del mes</p>
                    <p className="text-base lg:text-lg font-heading font-bold truncate">{currentMonthRequestsCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-indigo-500/10 shrink-0">
                    <CheckCheck className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">Reposiciones Aplicadas</p>
                    <p className="text-base lg:text-lg font-heading font-bold truncate">
                      {repositions.filter((r) => r.status === "aplicado").length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* ─── Resumen anual ─── */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/15 shrink-0">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">Consumo anual {currentYear}</p>
                    <p className="text-base lg:text-lg font-heading font-bold truncate">{fmt(yearlyStats.totalSpent)}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      YTD: {fmt(yearlyStats.yearlyAssigned)} ({yearlyStats.monthIndex} {yearlyStats.monthIndex === 1 ? "mes" : "meses"} × {fmt(CAJA_CHICA_LIMIT)})
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Anual completo: {fmt(yearlyStats.yearlyAssignedFull)} (12 × {fmt(CAJA_CHICA_LIMIT)})
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/15 shrink-0">
                    <Percent className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">Utilización</p>
                    <p className="text-base lg:text-lg font-heading font-bold truncate">
                      {yearlyStats.utilizationPct.toFixed(1)}% <span className="text-xs font-normal text-muted-foreground">YTD</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {yearlyStats.utilizationFullPct.toFixed(1)}% del presupuesto anual
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Prom. mensual: {fmt(yearlyStats.avgPerMonth)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de gastos mensuales en BARRAS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-heading">Monto total gastado por mes</CardTitle>
              <CardDescription>Gastos de Caja Chica por mes calendario</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyBarData.length === 0 || monthlyBarData.every((d) => d.total === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos de gastos mensuales.</p>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={monthlyBarData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, "auto"]} tickFormatter={(value) => fmt(value)} />
                    <Tooltip formatter={(value: number) => fmt(value)} />
                    <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={60}>
                      {monthlyBarData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.total > CAJA_CHICA_LIMIT * 0.8 ? "hsl(0, 84%, 60%)" : "hsl(42, 100%, 50%)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <p className="text-xs text-muted-foreground text-center mt-4">
                Las barras en rojo indican que se superó el 80% del límite mensual (RD${" "}
                {CAJA_CHICA_LIMIT.toLocaleString("es-DO")})
              </p>
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
              {(canApproveReposition || canApplyReposition) && (
                <TabsTrigger value="repositions">
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reposiciones
                  {pendingApprovals.length + pendingApplications.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-blue-500 text-white">
                      {pendingApprovals.length + pendingApplications.length}
                    </span>
                  )}
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

              {/* Top usuarios y top departamentos del mes actual */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-heading">Top usuarios — {getMonthDisplay(currentYearMonth)}</CardTitle>
                    <CardDescription>Personas con más gastos de Caja Chica este mes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const monthExp = purchases.filter(
                        (p) =>
                          p.status === "Aprobado" &&
                          !p.voided &&
                          p.paymentMethod === "Caja Chica" &&
                          getYearMonth(p.expenseDate || p.requestedAt) === currentYearMonth,
                      );
                      const byUser: Record<string, number> = {};
                      monthExp.forEach((p) => {
                        const key = p.requestedFor?.trim() || p.requestedByName || "—";
                        byUser[key] = (byUser[key] || 0) + p.amount;
                      });
                      const list = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 10);
                      if (list.length === 0)
                        return <p className="text-sm text-muted-foreground text-center py-8">Sin gastos este mes.</p>;
                      return (
                        <div className="space-y-2">
                          {list.map(([name, total]) => (
                            <div key={name} className="flex items-center justify-between p-2 rounded border border-border">
                              <span className="text-sm truncate">{name}</span>
                              <span className="text-sm font-semibold">{fmt(total)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-heading">Por departamento — {getMonthDisplay(currentYearMonth)}</CardTitle>
                    <CardDescription>Departamentos con más gasto este mes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const monthExp = purchases.filter(
                        (p) =>
                          p.status === "Aprobado" &&
                          !p.voided &&
                          p.paymentMethod === "Caja Chica" &&
                          getYearMonth(p.expenseDate || p.requestedAt) === currentYearMonth,
                      );
                      const byDept: Record<string, number> = {};
                      monthExp.forEach((p) => {
                        const key = p.department?.trim() || "Sin depto";
                        byDept[key] = (byDept[key] || 0) + p.amount;
                      });
                      const list = Object.entries(byDept).sort((a, b) => b[1] - a[1]);
                      if (list.length === 0)
                        return <p className="text-sm text-muted-foreground text-center py-8">Sin gastos este mes.</p>;
                      const total = list.reduce((s, [, v]) => s + v, 0);
                      return (
                        <div className="space-y-2">
                          {list.map(([name, value]) => {
                            const pct = total > 0 ? (value / total) * 100 : 0;
                            return (
                              <div key={name} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="truncate">{name}</span>
                                  <span className="font-semibold">
                                    {fmt(value)} <span className="text-xs text-muted-foreground">({pct.toFixed(0)}%)</span>
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
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
                          <TableHead>Departamento</TableHead>
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
                            <TableCell colSpan={11} className="text-center text-muted-foreground py-6">
                              Cargando…
                            </TableCell>
                          </TableRow>
                        ) : filteredHistory.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} className="text-center text-muted-foreground py-6">
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
                              <TableCell className="text-sm">{p.department || "—"}</TableCell>
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
                                  {p.paymentMethod === "Caja Chica" &&
                                    p.status === "Aprobado" &&
                                    !p.voided &&
                                    !repositions.some(
                                      (r) => r.purchaseId === p.id,
                                    ) && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-gold"
                                        onClick={() => handleRequestRepositionForPurchase(p)}
                                        title="Solicitar reposición de esta transacción"
                                      >
                                        <RefreshCw className="h-4 w-4" />
                                      </Button>
                                    )}
                                  {canManage && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        setReassignDialog(p);
                                        setReassignNewId("");
                                        setReassignReason("");
                                      }}
                                      title="Cambiar ID"
                                    >
                                      <Hash className="h-4 w-4" />
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
                    <CardTitle className="text-base font-heading">Solicitudes Pendientes de Gastos</CardTitle>
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

            {(canApproveReposition || canApplyReposition) && (
              <TabsContent value="repositions">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-heading">Historial de Reposiciones de Caja Chica</CardTitle>
                    <CardDescription>
                      <strong>Flujo completo:</strong> Solicitar → Aprobar → Aplicar (reinicia el límite mensual)
                      <br />
                      <strong>Total repuesto:</strong> {fmt(totalRepositionsApplied)} en{" "}
                      {repositions.filter((r) => r.status === "aplicado").length} reposiciones
                      <br />
                      <strong>Personas autorizadas para aplicar:</strong> Chrisnel, Xuxa, Cristy, Armando Noel
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
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{getMonthDisplay(r.yearMonth)}</p>
                                {r.kind === "transaccion" ? (
                                  <Badge variant="outline" className="text-[10px] border-gold text-gold">
                                    Por transacción {r.purchaseId ? `· ${r.purchaseId}` : ""}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px]">Mensual</Badge>
                                )}
                              </div>
                              {r.purchaseDescription && (
                                <p className="text-xs text-muted-foreground italic">
                                  "{r.purchaseDescription}"
                                </p>
                              )}
                              <p className="text-sm">
                                Monto: <strong>{fmt(r.amountReposed)}</strong>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Solicitado por: {r.requestedBy} · {fmtDate(r.requestedAt)}
                              </p>
                              {r.approvedBy && (
                                <p className="text-xs text-muted-foreground">
                                  Aprobado por: {r.approvedBy} · {fmtDate(r.approvedAt || "")}
                                </p>
                              )}
                              {r.appliedBy && (
                                <p className="text-xs text-green-600">
                                  ✓ Aplicado por: {r.appliedBy} · {fmtDate(r.appliedAt || "")}
                                </p>
                              )}
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
                                    ? "Aprobada (pendiente aplicar)"
                                    : "Aplicada ✓"}
                              </Badge>
                              {r.status === "pendiente" && canApproveReposition && (
                                <Button size="sm" onClick={() => handleApproveReposition(r.id)}>
                                  Aprobar
                                </Button>
                              )}
                              {r.status === "aprobado" && canApplyReposition && (
                                <Button size="sm" variant="default" onClick={() => handleApplyReposition(r.id)}>
                                  <CheckCheck className="h-3 w-3 mr-1" /> Aplicar Reposición
                                </Button>
                              )}
                              {user?.isAdmin && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteReposition(r.id)}
                                  title="Eliminar reposición (requiere justificación, queda registrado en auditoría)"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" /> Eliminar
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

      {/* Diálogo de Denominaciones Editables */}
      <Dialog open={denominationsDialogOpen} onOpenChange={setDenominationsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Editar Denominaciones de Efectivo</DialogTitle>
            <DialogDescription>
              Configure el desglose de billetes y monedas actualmente en caja.
              <br />
              Total actual: <strong>{fmt(totalEfectivoDenominaciones)}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-3 gap-2 font-medium text-sm text-muted-foreground pb-2 border-b">
              <div>Denominación (RD$)</div>
              <div>Cantidad</div>
              <div>Subtotal</div>
            </div>
            {editingDenominations.map((denom, idx) => (
              <div key={denom.value} className="grid grid-cols-3 gap-2 items-center">
                <div className="font-mono">RD$ {denom.value.toLocaleString()}</div>
                <Input
                  type="number"
                  value={denom.count}
                  onChange={(e) => handleUpdateDenomination(idx, "count", parseInt(e.target.value) || 0)}
                  className="h-8 w-24"
                  min={0}
                  step={1}
                />
                <div className="text-sm font-mono">{fmt(denom.value * denom.count)}</div>
              </div>
            ))}
            <div className="pt-4 border-t">
              <div className="flex justify-between font-bold">
                <span>TOTAL EN CAJA:</span>
                <span>{fmt(getTotalEfectivoFromDenominations(editingDenominations))}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenominationsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveDenominations} className="gap-2">
              <Save className="h-4 w-4" /> Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalle del Gasto */}
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
                <strong>Departamento:</strong> {detail.department || "—"}
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

      {/* Diálogo de Anulación */}
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
                  placeholder="Ej: Gasto duplicado, error en el monto, etc."
                  className="mt-1"
                />
                {voidReason.length > 0 && voidReason.length < 5 && (
                  <p className="text-xs text-destructive mt-1">Mínimo 5 caracteres</p>
                )}
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
            <Button variant="destructive" onClick={handleVoid} disabled={voidReason.length < 5}>
              Anular Gasto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Reasignación de ID */}
      <Dialog
        open={!!reassignDialog}
        onOpenChange={(o) => {
          if (!o) {
            setReassignDialog(null);
            setReassignNewId("");
            setReassignReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Hash className="h-4 w-4" /> Cambiar ID del gasto
            </DialogTitle>
            <DialogDescription>
              Útil cuando el ID original quedó ocupado por un gasto anulado. Se conserva el historial completo.
            </DialogDescription>
          </DialogHeader>
          {reassignDialog && (
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{reassignDialog.description}</p>
                <p className="text-muted-foreground">
                  ID actual: <span className="font-mono">{reassignDialog.id}</span> · {fmt(reassignDialog.amount)}
                </p>
              </div>
              <div>
                <Label>Nuevo ID *</Label>
                <Input
                  value={reassignNewId}
                  onChange={(e) => setReassignNewId(e.target.value.toUpperCase())}
                  placeholder="Ej: MP-002"
                  className="mt-1 font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Formato MP-### · sólo se permite reutilizar IDs de gastos anulados.
                </p>
              </div>
              <div>
                <Label>Justificación * (mín 5 caracteres)</Label>
                <Textarea
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  rows={3}
                  placeholder="Ej: Reordenar numeración tras anulación de MP-002."
                  className="mt-1"
                />
              </div>
              {reassignDialog.idHistory && reassignDialog.idHistory.length > 0 && (
                <div className="border rounded-lg p-2 bg-muted/40">
                  <p className="text-xs font-semibold mb-1">Historial de cambios de ID</p>
                  <ul className="text-xs space-y-1 max-h-32 overflow-auto">
                    {reassignDialog.idHistory.map((h, i) => (
                      <li key={i} className="font-mono">
                        {h.previousId} → {h.newId}
                        <span className="text-muted-foreground"> · {fmtDate(h.changedAt)} · {h.changedBy}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReassignDialog(null);
                setReassignNewId("");
                setReassignReason("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReassignId}
              disabled={
                reassignBusy ||
                reassignReason.length < 5 ||
                !/^MP-\d{3,}$/.test(reassignNewId.trim().toUpperCase())
              }
            >
              {reassignBusy ? "Guardando..." : "Cambiar ID"}
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
              Selecciona el mes a reponer. La reposición restablece el límite mensual a {fmt(CAJA_CHICA_LIMIT)}.
              <br />
              <strong>Flujo:</strong> Solicitar → Aprobar → Aplicar
              <br />
              <strong>Autorizados para aplicar:</strong> Chrisnel, Xuxa, Cristy, Armando Noel
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mes a reponer</Label>
              <Select value={repositionMonth} onValueChange={setRepositionMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar mes" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    // Meses con gasto > 0 sin reposición aplicada (cualquier mes histórico)
                    const monthsWithSpending = Array.from(
                      new Set(
                        purchases
                          .filter((p) => p.status === "Aprobado" && !p.voided && p.paymentMethod === "Caja Chica")
                          .map((p) => getYearMonth(p.expenseDate || p.requestedAt)),
                      ),
                    ).sort().reverse();
                    if (monthsWithSpending.length === 0) {
                      return <SelectItem value={getPreviousYearMonth()} disabled>Sin meses con gastos</SelectItem>;
                    }
                    return monthsWithSpending.map((m) => {
                      const spent = getSpentForMonth(m);
                      const existing = repositions.find((r) => r.yearMonth === m);
                      return (
                        <SelectItem key={m} value={m} disabled={!!existing}>
                          {getMonthDisplay(m)} — {fmt(spent)}
                          {existing && ` (${existing.status})`}
                        </SelectItem>
                      );
                    });
                  })()}
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Monto a reponer</p>
              <p className="text-2xl font-heading font-bold text-primary">{fmt(getSpentForMonth(repositionMonth))}</p>
              <p className="text-xs text-muted-foreground mt-1">Gastado en {getMonthDisplay(repositionMonth)}</p>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Una vez aprobada, debe presionar "Aplicar Reposición" cuando se entregue el dinero físicamente.
                Esto restablece el límite del mes actual a {fmt(CAJA_CHICA_LIMIT)}.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepositionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRequestReposition}
              disabled={
                getSpentForMonth(repositionMonth) === 0 ||
                !!repositions.find((r) => r.yearMonth === repositionMonth)
              }
            >
              Solicitar Reposición
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Política y cálculos ─── */}
      <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" /> Política y cálculos de Caja Chica
            </DialogTitle>
            <DialogDescription>
              Guía de uso, fórmulas de cálculo y reglas de aprobación.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-2 text-sm">
            <section>
              <h3 className="font-semibold text-foreground mb-2">📌 Límite mensual</h3>
              <p className="text-muted-foreground">
                Cada mes calendario tiene un límite asignado de{" "}
                <strong className="text-foreground">
                  RD$ {CAJA_CHICA_LIMIT.toLocaleString("es-DO")}
                </strong>
                . El consumo se reinicia el día 1 de cada mes (o al aplicar una reposición).
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">🧮 Cómo se calculan los indicadores</h3>
              <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                <li>
                  <strong className="text-foreground">Consumo del mes</strong>: suma de gastos
                  aprobados (no anulados) cuyo método de pago es "Caja Chica" y cuya fecha de
                  gasto cae en el mes actual.
                </li>
                <li>
                  <strong className="text-foreground">Disponible actual</strong>: límite mensual −
                  consumo del mes + reposiciones aplicadas en el mes.
                </li>
                <li>
                  <strong className="text-foreground">Consumo anual {currentYear}</strong>: suma
                  de gastos de Caja Chica del año en curso (enero a hoy).
                </li>
                <li>
                  <strong className="text-foreground">YTD (Year-To-Date)</strong>: presupuesto
                  acumulado hasta el mes actual = límite mensual × meses transcurridos.
                  Hoy: {fmt(CAJA_CHICA_LIMIT)} × {yearlyStats.monthIndex}{" "}
                  {yearlyStats.monthIndex === 1 ? "mes" : "meses"} ={" "}
                  <strong className="text-foreground">{fmt(yearlyStats.yearlyAssigned)}</strong>.
                </li>
                <li>
                  <strong className="text-foreground">Anual completo</strong>: presupuesto del año
                  fiscal completo = {fmt(CAJA_CHICA_LIMIT)} × 12 ={" "}
                  <strong className="text-foreground">{fmt(yearlyStats.yearlyAssignedFull)}</strong>.
                  Sirve para cuadre contable de fin de año.
                </li>
                <li>
                  <strong className="text-foreground">Utilización YTD</strong>: consumo anual /
                  presupuesto YTD. Indica qué tan rápido se está consumiendo respecto al ritmo
                  esperado.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">🛡️ Política de aprobación</h3>
              <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                <li>
                  Gastos dentro del límite mensual: se registran normalmente. Auto-aprobados para
                  Aurelio, Samuel y Chrisnel; el resto requiere aprobación del responsable
                  (Tecnología → Samuel A. Pérez; otros → Chrisnel Fabian).
                </li>
                <li>
                  <strong className="text-foreground">Excedente del límite mensual</strong>: si un
                  gasto haría superar los {fmt(CAJA_CHICA_LIMIT)} del mes, el sistema solicita
                  autorización explícita de{" "}
                  <strong className="text-foreground">{OVER_LIMIT_APPROVER_NAME}</strong>{" "}
                  (única persona autorizada). Se requiere su contraseña y una justificación
                  obligatoria de mínimo 20 caracteres.
                </li>
                <li>
                  Cada autorización de excedente queda registrada en la{" "}
                  <strong className="text-foreground">bitácora de auditoría</strong> con el monto,
                  el motivo y la fecha/hora.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">💰 Reposiciones</h3>
              <p className="text-muted-foreground">
                Las reposiciones reinician el disponible del mes correspondiente. Flujo: Solicitar
                → Aprobar → Aplicar. Solo Chrisnel, Xuxa, Cristy y Armando Noel pueden aplicarlas.
              </p>
            </section>

            <section className="rounded-lg bg-muted/40 border p-3">
              <h3 className="font-semibold text-foreground mb-1">🔍 Cuadre contable</h3>
              <p className="text-muted-foreground text-xs">
                Para cuadrar con contabilidad: <strong>Consumo anual</strong> +{" "}
                <strong>Disponible actual</strong> + (límites de meses futuros del año) deben
                coincidir con el presupuesto anual completo de {fmt(yearlyStats.yearlyAssignedFull)}.
                Las reposiciones aplicadas se reportan por separado.
              </p>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={() => setPolicyDialogOpen(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Autorización de excedente del límite mensual ─── */}
      <Dialog
        open={!!overLimitDialog?.open}
        onOpenChange={(o) => {
          if (!o) {
            setOverLimitDialog(null);
            setOverLimitPassword("");
            setOverLimitJustification("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-600" /> Autorización requerida
            </DialogTitle>
            <DialogDescription>
              Este gasto excede el límite mensual de Caja Chica. Solo{" "}
              <strong>{OVER_LIMIT_APPROVER_NAME}</strong> puede autorizarlo.
            </DialogDescription>
          </DialogHeader>
          {overLimitDialog && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monto solicitado:</span>
                  <strong>{fmt(overLimitDialog.requestedAmount)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disponible en el mes:</span>
                  <strong>{fmt(overLimitDialog.available)}</strong>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>Excedente a autorizar:</span>
                  <strong>{fmt(overLimitDialog.excess)}</strong>
                </div>
                <div className="text-xs text-muted-foreground pt-1">
                  Mes: {getMonthDisplay(overLimitDialog.yearMonth)}
                </div>
              </div>

              <div>
                <Label>Justificación del excedente *</Label>
                <Textarea
                  value={overLimitJustification}
                  onChange={(e) => setOverLimitJustification(e.target.value)}
                  placeholder="Explique por qué se requiere superar el límite mensual..."
                  rows={3}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Mínimo 20 caracteres. Quedará registrado en la bitácora de auditoría.
                </p>
              </div>

              <div>
                <Label>Contraseña de {OVER_LIMIT_APPROVER_NAME} *</Label>
                <Input
                  type="password"
                  value={overLimitPassword}
                  onChange={(e) => setOverLimitPassword(e.target.value)}
                  placeholder="Contraseña del autorizador"
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOverLimitDialog(null);
                setOverLimitPassword("");
                setOverLimitJustification("");
              }}
              disabled={overLimitBusy}
            >
              Cancelar
            </Button>
            <Button onClick={handleAuthorizeOverLimit} disabled={overLimitBusy}>
              {overLimitBusy ? "Verificando..." : "Autorizar excedente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default MinorPurchases;
