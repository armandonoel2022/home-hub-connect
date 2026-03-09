import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Calculator, BookOpen, FileText, CreditCard, Receipt, ShoppingCart,
  BarChart3, Plus, Search, Printer, Download, ArrowLeft, Trash2, Edit,
  ChevronRight, DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  CheckCircle, Clock, AlertTriangle,
} from "lucide-react";

// ─── Types ───
interface Account {
  code: string;
  name: string;
  type: "Activo" | "Pasivo" | "Capital" | "Ingreso" | "Gasto";
  balance: number;
  parentCode?: string;
}

interface JournalEntry {
  id: string;
  date: string;
  description: string;
  lines: JournalLine[];
  status: "Borrador" | "Registrado";
  createdAt: string;
}

interface JournalLine {
  accountCode: string;
  description: string;
  debit: number;
  credit: number;
}

interface Invoice {
  id: string;
  type: "Cuenta por Cobrar" | "Cuenta por Pagar";
  number: string;
  date: string;
  dueDate: string;
  clientOrVendor: string;
  rnc: string;
  items: InvoiceItem[];
  subtotal: number;
  itbis: number;
  total: number;
  status: "Pendiente" | "Pagada" | "Anulada";
  ncf: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  itbisRate: number;
  amount: number;
}

interface Check {
  id: string;
  number: string;
  date: string;
  payTo: string;
  amount: number;
  concept: string;
  bankAccount: string;
  status: "Emitido" | "Cobrado" | "Anulado";
  invoiceId?: string;
}

interface PurchaseOrder {
  id: string;
  number: string;
  date: string;
  vendor: string;
  items: { description: string; quantity: number; unitPrice: number; amount: number }[];
  total: number;
  status: "Borrador" | "Aprobada" | "Recibida" | "Facturada" | "Cancelada";
  sourceType: "Intranet" | "Adonis";
  sourceId?: string;
}

// ─── Initial Data ───
const initialAccounts: Account[] = [
  { code: "1", name: "Activos", type: "Activo", balance: 0 },
  { code: "1.1", name: "Activos Corrientes", type: "Activo", balance: 0, parentCode: "1" },
  { code: "1.1.1", name: "Efectivo y Equivalentes", type: "Activo", balance: 500000 },
  { code: "1.1.2", name: "Cuentas por Cobrar", type: "Activo", balance: 250000 },
  { code: "1.1.3", name: "Inventario", type: "Activo", balance: 180000 },
  { code: "1.2", name: "Activos No Corrientes", type: "Activo", balance: 0, parentCode: "1" },
  { code: "1.2.1", name: "Propiedad, Planta y Equipo", type: "Activo", balance: 1200000 },
  { code: "1.2.2", name: "Depreciación Acumulada", type: "Activo", balance: -300000 },
  { code: "2", name: "Pasivos", type: "Pasivo", balance: 0 },
  { code: "2.1", name: "Pasivos Corrientes", type: "Pasivo", balance: 0, parentCode: "2" },
  { code: "2.1.1", name: "Cuentas por Pagar", type: "Pasivo", balance: 180000 },
  { code: "2.1.2", name: "Impuestos por Pagar", type: "Pasivo", balance: 45000 },
  { code: "2.1.3", name: "Nómina por Pagar", type: "Pasivo", balance: 120000 },
  { code: "2.2", name: "Pasivos No Corrientes", type: "Pasivo", balance: 0, parentCode: "2" },
  { code: "2.2.1", name: "Préstamos Bancarios LP", type: "Pasivo", balance: 400000 },
  { code: "3", name: "Capital", type: "Capital", balance: 0 },
  { code: "3.1", name: "Capital Social", type: "Capital", balance: 800000 },
  { code: "3.2", name: "Utilidades Retenidas", type: "Capital", balance: 285000 },
  { code: "4", name: "Ingresos", type: "Ingreso", balance: 0 },
  { code: "4.1", name: "Ingresos por Servicios", type: "Ingreso", balance: 950000 },
  { code: "4.2", name: "Otros Ingresos", type: "Ingreso", balance: 35000 },
  { code: "5", name: "Gastos", type: "Gasto", balance: 0 },
  { code: "5.1", name: "Gastos de Nómina", type: "Gasto", balance: 420000 },
  { code: "5.2", name: "Gastos de Alquiler", type: "Gasto", balance: 96000 },
  { code: "5.3", name: "Gastos de Servicios", type: "Gasto", balance: 48000 },
  { code: "5.4", name: "Depreciación", type: "Gasto", balance: 60000 },
  { code: "5.5", name: "Otros Gastos", type: "Gasto", balance: 25000 },
];

const initialEntries: JournalEntry[] = [
  {
    id: "DE-001", date: "2026-03-01", description: "Registro de nómina quincenal",
    lines: [
      { accountCode: "5.1", description: "Nómina 1ra quincena marzo", debit: 210000, credit: 0 },
      { accountCode: "2.1.3", description: "Nómina por pagar", debit: 0, credit: 210000 },
    ],
    status: "Registrado", createdAt: "2026-03-01T08:00:00",
  },
  {
    id: "DE-002", date: "2026-03-03", description: "Cobro factura cliente ABC Corp",
    lines: [
      { accountCode: "1.1.1", description: "Depósito recibido", debit: 150000, credit: 0 },
      { accountCode: "1.1.2", description: "CxC ABC Corp", debit: 0, credit: 150000 },
    ],
    status: "Registrado", createdAt: "2026-03-03T10:30:00",
  },
];

const initialInvoices: Invoice[] = [
  {
    id: "FAC-001", type: "Cuenta por Cobrar", number: "B0100000001", date: "2026-03-01", dueDate: "2026-03-31",
    clientOrVendor: "ABC Corp", rnc: "101-12345-6",
    items: [{ description: "Servicio de seguridad marzo 2026", quantity: 1, unitPrice: 350000, itbisRate: 18, amount: 350000 }],
    subtotal: 350000, itbis: 63000, total: 413000, status: "Pendiente", ncf: "B0100000001",
  },
  {
    id: "FAC-002", type: "Cuenta por Pagar", number: "PROV-2026-015", date: "2026-03-05", dueDate: "2026-04-05",
    clientOrVendor: "Uniformes RD", rnc: "401-98765-4",
    items: [{ description: "Uniformes personal operativo", quantity: 50, unitPrice: 2500, itbisRate: 18, amount: 125000 }],
    subtotal: 125000, itbis: 22500, total: 147500, status: "Pendiente", ncf: "B0100000045",
  },
];

const initialChecks: Check[] = [
  { id: "CHK-001", number: "0001523", date: "2026-03-05", payTo: "Uniformes RD", amount: 147500, concept: "Pago factura uniformes", bankAccount: "Banco Popular 1234-5678", status: "Emitido", invoiceId: "FAC-002" },
];

const initialPOs: PurchaseOrder[] = [
  {
    id: "OC-001", number: "OC-2026-001", date: "2026-03-02", vendor: "Tech Supply SRL",
    items: [{ description: "Cámaras de seguridad HD", quantity: 10, unitPrice: 8500, amount: 85000 }],
    total: 85000, status: "Aprobada", sourceType: "Adonis",
  },
];

// ─── Helpers ───
const fmt = (n: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(n);
const typeColor = (t: string) => {
  const map: Record<string, string> = { Activo: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", Pasivo: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", Capital: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", Ingreso: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", Gasto: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" };
  return map[t] || "bg-muted text-muted-foreground";
};
const statusColor = (s: string) => {
  const map: Record<string, string> = { Pendiente: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", Pagada: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", Anulada: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", Emitido: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", Cobrado: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", Borrador: "bg-muted text-muted-foreground", Registrado: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", Aprobada: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", Recibida: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", Facturada: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", Cancelada: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" };
  return map[s] || "bg-muted text-muted-foreground";
};

let nextId = 100;
const genId = (prefix: string) => `${prefix}-${String(++nextId).padStart(3, "0")}`;

// ─── Component ───
const Adonis = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [entries, setEntries] = useState<JournalEntry[]>(initialEntries);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [checks, setChecks] = useState<Check[]>(initialChecks);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(initialPOs);
  const [search, setSearch] = useState("");

  // ─── New Entry Form ───
  const [newEntry, setNewEntry] = useState<Partial<JournalEntry>>({ date: new Date().toISOString().split("T")[0], description: "", lines: [{ accountCode: "", description: "", debit: 0, credit: 0 }, { accountCode: "", description: "", debit: 0, credit: 0 }] });

  const addEntryLine = () => setNewEntry(p => ({ ...p, lines: [...(p.lines || []), { accountCode: "", description: "", debit: 0, credit: 0 }] }));

  const updateEntryLine = (idx: number, field: keyof JournalLine, value: string | number) => {
    setNewEntry(p => {
      const lines = [...(p.lines || [])];
      lines[idx] = { ...lines[idx], [field]: value };
      return { ...p, lines };
    });
  };

  const removeEntryLine = (idx: number) => {
    setNewEntry(p => ({ ...p, lines: (p.lines || []).filter((_, i) => i !== idx) }));
  };

  const entryTotalDebit = (newEntry.lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const entryTotalCredit = (newEntry.lines || []).reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const entryBalanced = entryTotalDebit > 0 && entryTotalDebit === entryTotalCredit;

  const saveEntry = () => {
    if (!entryBalanced || !newEntry.description) {
      toast({ title: "Error", description: "Asiento debe estar cuadrado y tener descripción", variant: "destructive" });
      return;
    }
    const entry: JournalEntry = {
      id: genId("DE"), date: newEntry.date!, description: newEntry.description!,
      lines: newEntry.lines as JournalLine[], status: "Registrado", createdAt: new Date().toISOString(),
    };
    setEntries(prev => [entry, ...prev]);
    // Update balances
    setAccounts(prev => {
      const updated = [...prev];
      entry.lines.forEach(line => {
        const idx = updated.findIndex(a => a.code === line.accountCode);
        if (idx >= 0) {
          const acc = updated[idx];
          if (acc.type === "Activo" || acc.type === "Gasto") {
            updated[idx] = { ...acc, balance: acc.balance + line.debit - line.credit };
          } else {
            updated[idx] = { ...acc, balance: acc.balance + line.credit - line.debit };
          }
        }
      });
      return updated;
    });
    setNewEntry({ date: new Date().toISOString().split("T")[0], description: "", lines: [{ accountCode: "", description: "", debit: 0, credit: 0 }, { accountCode: "", description: "", debit: 0, credit: 0 }] });
    toast({ title: "Asiento registrado", description: `${entry.id} guardado exitosamente` });
  };

  // ─── New Invoice Form ───
  const [newInvoice, setNewInvoice] = useState<Partial<Invoice>>({
    type: "Cuenta por Cobrar", date: new Date().toISOString().split("T")[0], dueDate: "",
    clientOrVendor: "", rnc: "", ncf: "", items: [{ description: "", quantity: 1, unitPrice: 0, itbisRate: 18, amount: 0 }],
  });

  const addInvoiceItem = () => setNewInvoice(p => ({ ...p, items: [...(p.items || []), { description: "", quantity: 1, unitPrice: 0, itbisRate: 18, amount: 0 }] }));

  const updateInvoiceItem = (idx: number, field: string, value: string | number) => {
    setNewInvoice(p => {
      const items = [...(p.items || [])];
      items[idx] = { ...items[idx], [field]: value };
      items[idx].amount = items[idx].quantity * items[idx].unitPrice;
      return { ...p, items };
    });
  };

  const invoiceSubtotal = (newInvoice.items || []).reduce((s, i) => s + i.amount, 0);
  const invoiceItbis = (newInvoice.items || []).reduce((s, i) => s + (i.amount * i.itbisRate / 100), 0);

  const saveInvoice = () => {
    if (!newInvoice.clientOrVendor || invoiceSubtotal === 0) {
      toast({ title: "Error", description: "Complete los datos de la factura", variant: "destructive" });
      return;
    }
    const inv: Invoice = {
      id: genId("FAC"), type: newInvoice.type as Invoice["type"],
      number: newInvoice.ncf || genId("B01"), date: newInvoice.date!, dueDate: newInvoice.dueDate!,
      clientOrVendor: newInvoice.clientOrVendor!, rnc: newInvoice.rnc || "",
      items: newInvoice.items as InvoiceItem[], subtotal: invoiceSubtotal, itbis: invoiceItbis,
      total: invoiceSubtotal + invoiceItbis, status: "Pendiente", ncf: newInvoice.ncf || "",
    };
    setInvoices(prev => [inv, ...prev]);
    setNewInvoice({ type: "Cuenta por Cobrar", date: new Date().toISOString().split("T")[0], dueDate: "", clientOrVendor: "", rnc: "", ncf: "", items: [{ description: "", quantity: 1, unitPrice: 0, itbisRate: 18, amount: 0 }] });
    toast({ title: "Factura creada", description: `${inv.id} - ${fmt(inv.total)}` });
  };

  // ─── New Check Form ───
  const [newCheck, setNewCheck] = useState<Partial<Check>>({ date: new Date().toISOString().split("T")[0], payTo: "", amount: 0, concept: "", bankAccount: "Banco Popular 1234-5678" });

  const saveCheck = () => {
    if (!newCheck.payTo || !newCheck.amount) {
      toast({ title: "Error", description: "Complete los datos del cheque", variant: "destructive" });
      return;
    }
    const chk: Check = {
      id: genId("CHK"), number: String(Math.floor(Math.random() * 9000000) + 1000000),
      date: newCheck.date!, payTo: newCheck.payTo!, amount: Number(newCheck.amount),
      concept: newCheck.concept || "", bankAccount: newCheck.bankAccount!, status: "Emitido",
    };
    setChecks(prev => [chk, ...prev]);
    setNewCheck({ date: new Date().toISOString().split("T")[0], payTo: "", amount: 0, concept: "", bankAccount: "Banco Popular 1234-5678" });
    toast({ title: "Cheque emitido", description: `#${chk.number} - ${fmt(chk.amount)}` });
  };

  // ─── New PO Form ───
  const [newPO, setNewPO] = useState<Partial<PurchaseOrder>>({
    date: new Date().toISOString().split("T")[0], vendor: "", sourceType: "Adonis",
    items: [{ description: "", quantity: 1, unitPrice: 0, amount: 0 }],
  });

  const addPOItem = () => setNewPO(p => ({ ...p, items: [...(p.items || []), { description: "", quantity: 1, unitPrice: 0, amount: 0 }] }));

  const updatePOItem = (idx: number, field: string, value: string | number) => {
    setNewPO(p => {
      const items = [...(p.items || [])];
      items[idx] = { ...items[idx], [field]: value };
      items[idx].amount = items[idx].quantity * items[idx].unitPrice;
      return { ...p, items };
    });
  };

  const poTotal = (newPO.items || []).reduce((s, i) => s + i.amount, 0);

  const savePO = () => {
    if (!newPO.vendor || poTotal === 0) {
      toast({ title: "Error", description: "Complete los datos de la orden", variant: "destructive" });
      return;
    }
    const po: PurchaseOrder = {
      id: genId("OC"), number: `OC-2026-${String(purchaseOrders.length + 2).padStart(3, "0")}`,
      date: newPO.date!, vendor: newPO.vendor!,
      items: newPO.items as PurchaseOrder["items"], total: poTotal,
      status: "Borrador", sourceType: newPO.sourceType as "Intranet" | "Adonis",
    };
    setPurchaseOrders(prev => [po, ...prev]);
    setNewPO({ date: new Date().toISOString().split("T")[0], vendor: "", sourceType: "Adonis", items: [{ description: "", quantity: 1, unitPrice: 0, amount: 0 }] });
    toast({ title: "Orden creada", description: `${po.number} - ${fmt(po.total)}` });
  };

  // ─── New Account Form ───
  const [newAccount, setNewAccount] = useState<Partial<Account>>({ code: "", name: "", type: "Activo", balance: 0 });

  const saveAccount = () => {
    if (!newAccount.code || !newAccount.name) {
      toast({ title: "Error", description: "Código y nombre son requeridos", variant: "destructive" });
      return;
    }
    if (accounts.find(a => a.code === newAccount.code)) {
      toast({ title: "Error", description: "Código ya existe", variant: "destructive" });
      return;
    }
    setAccounts(prev => [...prev, { code: newAccount.code!, name: newAccount.name!, type: newAccount.type as Account["type"], balance: Number(newAccount.balance) || 0 }]);
    setNewAccount({ code: "", name: "", type: "Activo", balance: 0 });
    toast({ title: "Cuenta creada", description: `${newAccount.code} - ${newAccount.name}` });
  };

  // ─── Financial Summaries ───
  const leafAccounts = accounts.filter(a => !accounts.some(b => b.parentCode === a.code));
  const totalActivos = leafAccounts.filter(a => a.type === "Activo").reduce((s, a) => s + a.balance, 0);
  const totalPasivos = leafAccounts.filter(a => a.type === "Pasivo").reduce((s, a) => s + a.balance, 0);
  const totalCapital = leafAccounts.filter(a => a.type === "Capital").reduce((s, a) => s + a.balance, 0);
  const totalIngresos = leafAccounts.filter(a => a.type === "Ingreso").reduce((s, a) => s + a.balance, 0);
  const totalGastos = leafAccounts.filter(a => a.type === "Gasto").reduce((s, a) => s + a.balance, 0);
  const utilidadNeta = totalIngresos - totalGastos;
  const pendingInvoices = invoices.filter(i => i.status === "Pendiente");
  const cxc = pendingInvoices.filter(i => i.type === "Cuenta por Cobrar").reduce((s, i) => s + i.total, 0);
  const cxp = pendingInvoices.filter(i => i.type === "Cuenta por Pagar").reduce((s, i) => s + i.total, 0);

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="p-2.5 rounded-xl" style={{ background: "var(--gradient-gold)" }}>
              <Calculator className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">ADONIS</h1>
              <p className="text-sm text-muted-foreground">Sistema de Contabilidad</p>
            </div>
          </div>

          {/* Dashboard KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Total Activos</p>
                  <p className="text-lg font-bold text-foreground truncate">{fmt(totalActivos)}</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0"><TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Utilidad Neta</p>
                  <p className="text-lg font-bold text-foreground truncate">{fmt(utilidadNeta)}</p>
                </div>
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 shrink-0"><DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" /></div>
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">CxC Pendiente</p>
                  <p className="text-lg font-bold text-foreground truncate">{fmt(cxc)}</p>
                </div>
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 shrink-0"><ArrowUpRight className="h-4 w-4 text-yellow-600 dark:text-yellow-400" /></div>
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">CxP Pendiente</p>
                  <p className="text-lg font-bold text-foreground truncate">{fmt(cxp)}</p>
                </div>
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 shrink-0"><ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" /></div>
              </div>
            </CardContent></Card>
          </div>

          {/* Main Tabs */}
          <Tabs defaultValue="catalogo" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1">
              <TabsTrigger value="catalogo" className="text-xs"><BookOpen className="h-3.5 w-3.5 mr-1" />Catálogo</TabsTrigger>
              <TabsTrigger value="diario" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1" />Diario</TabsTrigger>
              <TabsTrigger value="facturas" className="text-xs"><Receipt className="h-3.5 w-3.5 mr-1" />Facturas</TabsTrigger>
              <TabsTrigger value="cheques" className="text-xs"><CreditCard className="h-3.5 w-3.5 mr-1" />Cheques</TabsTrigger>
              <TabsTrigger value="ordenes" className="text-xs"><ShoppingCart className="h-3.5 w-3.5 mr-1" />Órdenes Compra</TabsTrigger>
              <TabsTrigger value="reportes" className="text-xs"><BarChart3 className="h-3.5 w-3.5 mr-1" />Reportes</TabsTrigger>
            </TabsList>

            {/* ═══ CATÁLOGO DE CUENTAS ═══ */}
            <TabsContent value="catalogo">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg">Catálogo de Cuentas</CardTitle>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nueva Cuenta</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Nueva Cuenta Contable</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div><Label>Código</Label><Input value={newAccount.code} onChange={e => setNewAccount(p => ({ ...p, code: e.target.value }))} placeholder="1.1.4" /></div>
                            <div><Label>Tipo</Label>
                              <Select value={newAccount.type} onValueChange={v => setNewAccount(p => ({ ...p, type: v as Account["type"] }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {["Activo", "Pasivo", "Capital", "Ingreso", "Gasto"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div><Label>Nombre</Label><Input value={newAccount.name} onChange={e => setNewAccount(p => ({ ...p, name: e.target.value }))} placeholder="Bancos" /></div>
                          <div><Label>Balance Inicial</Label><Input type="number" value={newAccount.balance} onChange={e => setNewAccount(p => ({ ...p, balance: Number(e.target.value) }))} /></div>
                        </div>
                        <DialogFooter>
                          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                          <DialogClose asChild><Button onClick={saveAccount}>Guardar</Button></DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Buscar cuenta..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <div className="overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accounts
                          .filter(a => !search || a.code.includes(search) || a.name.toLowerCase().includes(search.toLowerCase()))
                          .sort((a, b) => a.code.localeCompare(b.code))
                          .map(acc => (
                            <TableRow key={acc.code}>
                              <TableCell className="font-mono text-xs">{acc.code}</TableCell>
                              <TableCell className={acc.code.split(".").length <= 2 ? "font-semibold" : "pl-8"}>{acc.name}</TableCell>
                              <TableCell><Badge className={typeColor(acc.type)} variant="secondary">{acc.type}</Badge></TableCell>
                              <TableCell className="text-right font-mono">{acc.balance !== 0 ? fmt(acc.balance) : "—"}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══ DIARIO GENERAL ═══ */}
            <TabsContent value="diario">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Nuevo Asiento de Diario</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>Fecha</Label><Input type="date" value={newEntry.date} onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))} /></div>
                      <div><Label>Descripción</Label><Input value={newEntry.description} onChange={e => setNewEntry(p => ({ ...p, description: e.target.value }))} placeholder="Descripción del asiento" /></div>
                    </div>
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-1">
                        <div className="col-span-3">Cuenta</div>
                        <div className="col-span-4">Descripción</div>
                        <div className="col-span-2 text-right">Débito</div>
                        <div className="col-span-2 text-right">Crédito</div>
                        <div className="col-span-1" />
                      </div>
                      {(newEntry.lines || []).map((line, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-3">
                            <Select value={line.accountCode} onValueChange={v => updateEntryLine(idx, "accountCode", v)}>
                              <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Cuenta" /></SelectTrigger>
                              <SelectContent>
                                {accounts.filter(a => !accounts.some(b => b.parentCode === a.code)).sort((a, b) => a.code.localeCompare(b.code)).map(a => (
                                  <SelectItem key={a.code} value={a.code} className="text-xs">{a.code} - {a.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-4"><Input className="h-9 text-xs" value={line.description} onChange={e => updateEntryLine(idx, "description", e.target.value)} placeholder="Detalle" /></div>
                          <div className="col-span-2"><Input className="h-9 text-xs text-right" type="number" value={line.debit || ""} onChange={e => updateEntryLine(idx, "debit", Number(e.target.value))} placeholder="0.00" /></div>
                          <div className="col-span-2"><Input className="h-9 text-xs text-right" type="number" value={line.credit || ""} onChange={e => updateEntryLine(idx, "credit", Number(e.target.value))} placeholder="0.00" /></div>
                          <div className="col-span-1 flex justify-center">
                            {(newEntry.lines || []).length > 2 && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeEntryLine(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <Button variant="outline" size="sm" onClick={addEntryLine}><Plus className="h-3.5 w-3.5 mr-1" />Línea</Button>
                      <div className="flex items-center gap-4 text-sm">
                        <span>Débitos: <strong>{fmt(entryTotalDebit)}</strong></span>
                        <span>Créditos: <strong>{fmt(entryTotalCredit)}</strong></span>
                        <Badge className={entryBalanced ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"}>
                          {entryBalanced ? "Cuadrado" : "Descuadrado"}
                        </Badge>
                      </div>
                      <Button onClick={saveEntry} disabled={!entryBalanced}><CheckCircle className="h-4 w-4 mr-1" />Registrar</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-lg">Asientos Registrados</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {entries.map(entry => (
                        <div key={entry.id} className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">{entry.id}</Badge>
                              <span className="text-sm font-semibold text-foreground">{entry.description}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{entry.date}</span>
                              <Badge className={statusColor(entry.status)}>{entry.status}</Badge>
                            </div>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Cuenta</TableHead>
                                <TableHead className="text-xs">Descripción</TableHead>
                                <TableHead className="text-xs text-right">Débito</TableHead>
                                <TableHead className="text-xs text-right">Crédito</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {entry.lines.map((l, i) => {
                                const acc = accounts.find(a => a.code === l.accountCode);
                                return (
                                  <TableRow key={i}>
                                    <TableCell className="text-xs font-mono">{l.accountCode} - {acc?.name || ""}</TableCell>
                                    <TableCell className="text-xs">{l.description}</TableCell>
                                    <TableCell className="text-xs text-right font-mono">{l.debit ? fmt(l.debit) : ""}</TableCell>
                                    <TableCell className="text-xs text-right font-mono">{l.credit ? fmt(l.credit) : ""}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ═══ FACTURAS ═══ */}
            <TabsContent value="facturas">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-lg">Facturación</CardTitle>
                      <Dialog>
                        <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nueva Factura</Button></DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader><DialogTitle>Nueva Factura</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div><Label>Tipo</Label>
                                <Select value={newInvoice.type} onValueChange={v => setNewInvoice(p => ({ ...p, type: v as Invoice["type"] }))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Cuenta por Cobrar">Cuenta por Cobrar</SelectItem>
                                    <SelectItem value="Cuenta por Pagar">Cuenta por Pagar</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div><Label>NCF</Label><Input value={newInvoice.ncf} onChange={e => setNewInvoice(p => ({ ...p, ncf: e.target.value }))} placeholder="B0100000000" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div><Label>{newInvoice.type === "Cuenta por Cobrar" ? "Cliente" : "Proveedor"}</Label><Input value={newInvoice.clientOrVendor} onChange={e => setNewInvoice(p => ({ ...p, clientOrVendor: e.target.value }))} /></div>
                              <div><Label>RNC</Label><Input value={newInvoice.rnc} onChange={e => setNewInvoice(p => ({ ...p, rnc: e.target.value }))} placeholder="000-00000-0" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div><Label>Fecha</Label><Input type="date" value={newInvoice.date} onChange={e => setNewInvoice(p => ({ ...p, date: e.target.value }))} /></div>
                              <div><Label>Vencimiento</Label><Input type="date" value={newInvoice.dueDate} onChange={e => setNewInvoice(p => ({ ...p, dueDate: e.target.value }))} /></div>
                            </div>
                            <div className="space-y-2">
                              <Label>Artículos</Label>
                              {(newInvoice.items || []).map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-5"><Input className="h-9 text-xs" value={item.description} onChange={e => updateInvoiceItem(idx, "description", e.target.value)} placeholder="Descripción" /></div>
                                  <div className="col-span-2"><Input className="h-9 text-xs" type="number" value={item.quantity} onChange={e => updateInvoiceItem(idx, "quantity", Number(e.target.value))} placeholder="Cant." /></div>
                                  <div className="col-span-2"><Input className="h-9 text-xs" type="number" value={item.unitPrice || ""} onChange={e => updateInvoiceItem(idx, "unitPrice", Number(e.target.value))} placeholder="Precio" /></div>
                                  <div className="col-span-2"><Input className="h-9 text-xs" type="number" value={item.itbisRate} onChange={e => updateInvoiceItem(idx, "itbisRate", Number(e.target.value))} placeholder="ITBIS%" /></div>
                                  <div className="col-span-1 text-xs text-right font-mono">{fmt(item.amount)}</div>
                                </div>
                              ))}
                              <Button variant="outline" size="sm" onClick={addInvoiceItem}><Plus className="h-3 w-3 mr-1" />Artículo</Button>
                            </div>
                            <div className="border-t border-border pt-3 text-right space-y-1">
                              <p className="text-sm">Subtotal: <strong>{fmt(invoiceSubtotal)}</strong></p>
                              <p className="text-sm">ITBIS: <strong>{fmt(invoiceItbis)}</strong></p>
                              <p className="text-lg font-bold">Total: {fmt(invoiceSubtotal + invoiceItbis)}</p>
                            </div>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                            <DialogClose asChild><Button onClick={saveInvoice}>Crear Factura</Button></DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>NCF / No.</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Cliente/Proveedor</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Vencimiento</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map(inv => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-mono text-xs">{inv.ncf || inv.number}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{inv.type}</Badge></TableCell>
                            <TableCell className="text-sm">{inv.clientOrVendor}</TableCell>
                            <TableCell className="text-xs">{inv.date}</TableCell>
                            <TableCell className="text-xs">{inv.dueDate}</TableCell>
                            <TableCell className="text-right font-mono font-semibold">{fmt(inv.total)}</TableCell>
                            <TableCell><Badge className={statusColor(inv.status)}>{inv.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ═══ CHEQUES ═══ */}
            <TabsContent value="cheques">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-lg">Emisión de Cheques</CardTitle>
                      <Dialog>
                        <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo Cheque</Button></DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Emitir Cheque</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <div><Label>Fecha</Label><Input type="date" value={newCheck.date} onChange={e => setNewCheck(p => ({ ...p, date: e.target.value }))} /></div>
                            <div><Label>A la orden de</Label><Input value={newCheck.payTo} onChange={e => setNewCheck(p => ({ ...p, payTo: e.target.value }))} /></div>
                            <div><Label>Monto (DOP)</Label><Input type="number" value={newCheck.amount || ""} onChange={e => setNewCheck(p => ({ ...p, amount: Number(e.target.value) }))} /></div>
                            <div><Label>Concepto</Label><Textarea value={newCheck.concept} onChange={e => setNewCheck(p => ({ ...p, concept: e.target.value }))} /></div>
                            <div><Label>Cuenta Bancaria</Label>
                              <Select value={newCheck.bankAccount} onValueChange={v => setNewCheck(p => ({ ...p, bankAccount: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Banco Popular 1234-5678">Banco Popular 1234-5678</SelectItem>
                                  <SelectItem value="Banreservas 9876-5432">Banreservas 9876-5432</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                            <DialogClose asChild><Button onClick={saveCheck}><Printer className="h-4 w-4 mr-1" />Emitir</Button></DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {checks.map(chk => (
                        <div key={chk.id} className="border border-border rounded-lg p-4 bg-card">
                          {/* Check preview */}
                          <div className="border-2 border-dashed border-muted rounded-lg p-4 mb-3 bg-background">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <p className="font-heading font-bold text-sm text-foreground">SafeOne Security SRL</p>
                                <p className="text-[10px] text-muted-foreground">{chk.bankAccount}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">No. <span className="font-mono font-bold text-foreground">{chk.number}</span></p>
                                <p className="text-xs text-muted-foreground">{chk.date}</p>
                              </div>
                            </div>
                            <div className="mb-2">
                              <p className="text-[10px] text-muted-foreground">PÁGUESE A LA ORDEN DE:</p>
                              <p className="font-semibold text-sm text-foreground border-b border-border pb-1">{chk.payTo}</p>
                            </div>
                            <div className="flex justify-between items-center">
                              <p className="text-xs text-muted-foreground italic max-w-[60%] truncate">{chk.concept}</p>
                              <div className="border border-border rounded px-3 py-1 bg-muted">
                                <p className="font-mono font-bold text-foreground">{fmt(chk.amount)}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge className={statusColor(chk.status)}>{chk.status}</Badge>
                            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 mr-1" />Imprimir</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ═══ ÓRDENES DE COMPRA ═══ */}
            <TabsContent value="ordenes">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-lg">Órdenes de Compra</CardTitle>
                      <Dialog>
                        <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nueva Orden</Button></DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader><DialogTitle>Nueva Orden de Compra</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div><Label>Proveedor</Label><Input value={newPO.vendor} onChange={e => setNewPO(p => ({ ...p, vendor: e.target.value }))} /></div>
                              <div><Label>Origen</Label>
                                <Select value={newPO.sourceType} onValueChange={v => setNewPO(p => ({ ...p, sourceType: v as "Intranet" | "Adonis" }))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Adonis">Adonis</SelectItem>
                                    <SelectItem value="Intranet">Intranet (Solicitud)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div><Label>Fecha</Label><Input type="date" value={newPO.date} onChange={e => setNewPO(p => ({ ...p, date: e.target.value }))} /></div>
                            <div className="space-y-2">
                              <Label>Artículos</Label>
                              {(newPO.items || []).map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-5"><Input className="h-9 text-xs" value={item.description} onChange={e => updatePOItem(idx, "description", e.target.value)} placeholder="Descripción" /></div>
                                  <div className="col-span-2"><Input className="h-9 text-xs" type="number" value={item.quantity} onChange={e => updatePOItem(idx, "quantity", Number(e.target.value))} /></div>
                                  <div className="col-span-3"><Input className="h-9 text-xs" type="number" value={item.unitPrice || ""} onChange={e => updatePOItem(idx, "unitPrice", Number(e.target.value))} placeholder="Precio" /></div>
                                  <div className="col-span-2 text-xs text-right font-mono">{fmt(item.amount)}</div>
                                </div>
                              ))}
                              <Button variant="outline" size="sm" onClick={addPOItem}><Plus className="h-3 w-3 mr-1" />Artículo</Button>
                            </div>
                            <p className="text-right text-lg font-bold">Total: {fmt(poTotal)}</p>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                            <DialogClose asChild><Button onClick={savePO}>Crear Orden</Button></DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No. Orden</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Origen</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchaseOrders.map(po => (
                          <TableRow key={po.id}>
                            <TableCell className="font-mono text-xs">{po.number}</TableCell>
                            <TableCell className="text-sm">{po.vendor}</TableCell>
                            <TableCell className="text-xs">{po.date}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{po.sourceType}</Badge></TableCell>
                            <TableCell className="text-right font-mono font-semibold">{fmt(po.total)}</TableCell>
                            <TableCell><Badge className={statusColor(po.status)}>{po.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ═══ REPORTES FINANCIEROS ═══ */}
            <TabsContent value="reportes">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Balance General */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Balance General</CardTitle>
                    <CardDescription>Al {new Date().toLocaleDateString("es-DO")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-heading font-bold text-sm text-foreground mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />ACTIVOS
                      </h4>
                      {leafAccounts.filter(a => a.type === "Activo").map(a => (
                        <div key={a.code} className="flex justify-between text-xs py-1 border-b border-border/50">
                          <span className="text-muted-foreground">{a.name}</span>
                          <span className="font-mono text-foreground">{fmt(a.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold pt-1 mt-1 border-t border-border">
                        <span>Total Activos</span><span className="font-mono">{fmt(totalActivos)}</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-sm text-foreground mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />PASIVOS
                      </h4>
                      {leafAccounts.filter(a => a.type === "Pasivo").map(a => (
                        <div key={a.code} className="flex justify-between text-xs py-1 border-b border-border/50">
                          <span className="text-muted-foreground">{a.name}</span>
                          <span className="font-mono text-foreground">{fmt(a.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold pt-1 mt-1 border-t border-border">
                        <span>Total Pasivos</span><span className="font-mono">{fmt(totalPasivos)}</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-sm text-foreground mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />CAPITAL
                      </h4>
                      {leafAccounts.filter(a => a.type === "Capital").map(a => (
                        <div key={a.code} className="flex justify-between text-xs py-1 border-b border-border/50">
                          <span className="text-muted-foreground">{a.name}</span>
                          <span className="font-mono text-foreground">{fmt(a.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold pt-1 mt-1 border-t border-border">
                        <span>Total Capital</span><span className="font-mono">{fmt(totalCapital)}</span>
                      </div>
                    </div>
                    <div className="border-t-2 border-primary pt-2">
                      <div className="flex justify-between font-heading font-bold">
                        <span>Pasivo + Capital</span>
                        <span className="font-mono">{fmt(totalPasivos + totalCapital)}</span>
                      </div>
                      {Math.abs(totalActivos - (totalPasivos + totalCapital)) < 1 ? (
                        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1"><CheckCircle className="h-3 w-3" />Balance cuadrado</p>
                      ) : (
                        <p className="text-xs text-destructive flex items-center gap-1 mt-1"><AlertTriangle className="h-3 w-3" />Diferencia: {fmt(totalActivos - totalPasivos - totalCapital)}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Estado de Resultados */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Estado de Resultados</CardTitle>
                    <CardDescription>Período actual</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-heading font-bold text-sm text-foreground mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />INGRESOS
                      </h4>
                      {leafAccounts.filter(a => a.type === "Ingreso").map(a => (
                        <div key={a.code} className="flex justify-between text-xs py-1 border-b border-border/50">
                          <span className="text-muted-foreground">{a.name}</span>
                          <span className="font-mono text-foreground">{fmt(a.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold pt-1 mt-1 border-t border-border">
                        <span>Total Ingresos</span><span className="font-mono">{fmt(totalIngresos)}</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-sm text-foreground mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />GASTOS
                      </h4>
                      {leafAccounts.filter(a => a.type === "Gasto").map(a => (
                        <div key={a.code} className="flex justify-between text-xs py-1 border-b border-border/50">
                          <span className="text-muted-foreground">{a.name}</span>
                          <span className="font-mono text-foreground">{fmt(a.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold pt-1 mt-1 border-t border-border">
                        <span>Total Gastos</span><span className="font-mono">{fmt(totalGastos)}</span>
                      </div>
                    </div>
                    <div className="border-t-2 border-primary pt-2">
                      <div className="flex justify-between font-heading font-bold text-lg">
                        <span>Utilidad Neta</span>
                        <span className={`font-mono ${utilidadNeta >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                          {fmt(utilidadNeta)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Margen: {totalIngresos > 0 ? ((utilidadNeta / totalIngresos) * 100).toFixed(1) : 0}%</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <Footer />
      </div>
    </AppLayout>
  );
};

export default Adonis;
