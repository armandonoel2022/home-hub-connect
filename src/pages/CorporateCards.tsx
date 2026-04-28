import { useEffect, useMemo, useState, useRef } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, CreditCard, Upload, Eye, Ban, Trash2, AlertCircle, Wallet, Receipt, TrendingUp, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { isApiConfigured, corporateCardsApi, getFileUrl, type CorporateCard, type CardCharge } from "@/lib/api";

const FINANCE_EMAILS = [
  "cfabian@safeone.com.do",
  "cxc@safeone.com.do",
  "contabilidad@safeone.com.do",
  "anoel@safeone.com.do",
];

const CARD_CATEGORIES = [
  "Combustible", "Suministros", "Viajes", "Alimentación", "Tecnología", "Servicios", "Otros",
];

const LS_CARDS = "safeone_corp_cards";
const LS_CHARGES = "safeone_corp_charges";

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const fmt = (n: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(n);
const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
  return format(d, "dd/MM/yyyy", { locale: es });
};
const getYearMonth = (d: string) => format(new Date(d.length <= 10 ? d + "T12:00:00" : d), "yyyy-MM");
const currentYearMonth = () => format(new Date(), "yyyy-MM");

const loadLocal = <T,>(key: string): T[] => {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
};
const saveLocal = <T,>(key: string, items: T[]) => localStorage.setItem(key, JSON.stringify(items));

const CorporateCards = () => {
  const { user, allUsers } = useAuth();
  const apiMode = isApiConfigured();

  const [cards, setCards] = useState<CorporateCard[]>(() => loadLocal<CorporateCard>(LS_CARDS));
  const [charges, setCharges] = useState<CardCharge[]>(() => loadLocal<CardCharge>(LS_CHARGES));
  const [loading, setLoading] = useState(apiMode);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [voidDialog, setVoidDialog] = useState<CardCharge | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>(currentYearMonth());
  const [filterCardId, setFilterCardId] = useState<string>("__all");

  const userEmail = user?.email || "";
  const isFinance = !!user && FINANCE_EMAILS.some((e) => userEmail.toLowerCase().includes(e.toLowerCase()));
  const canManage = isFinance || !!user?.isAdmin;

  // Card form
  const emptyCard = { holder: "", holderUserId: "", last4: "", brand: "Visa", monthlyLimit: "", department: "", notes: "" };
  const [cardForm, setCardForm] = useState(emptyCard);

  // Charge form
  const emptyCharge = {
    cardId: "", expenseDate: todayISO(), description: "", amount: "", category: "Otros", merchant: "", notes: "",
  };
  const [chargeForm, setChargeForm] = useState(emptyCharge);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!apiMode) { setLoading(false); return; }
    corporateCardsApi.getState()
      .then((s) => {
        setCards(s.cards || []);
        setCharges(s.charges || []);
        saveLocal(LS_CARDS, s.cards || []);
        saveLocal(LS_CHARGES, s.charges || []);
      })
      .catch(() => toast({ title: "Aviso", description: "Trabajando con datos locales." }))
      .finally(() => setLoading(false));
  }, [apiMode]);

  // ─── Computed ───
  const activeCards = useMemo(() => cards.filter((c) => c.active !== false), [cards]);

  const monthsAvailable = useMemo(() => {
    const set = new Set<string>();
    charges.forEach((c) => set.add(getYearMonth(c.expenseDate)));
    set.add(currentYearMonth());
    return Array.from(set).sort().reverse();
  }, [charges]);

  const filteredCharges = useMemo(() => {
    return charges.filter((c) => {
      if (getYearMonth(c.expenseDate) !== filterMonth) return false;
      if (filterCardId !== "__all" && c.cardId !== filterCardId) return false;
      return true;
    });
  }, [charges, filterMonth, filterCardId]);

  const cardUsage = (cardId: string, yearMonth: string) =>
    charges
      .filter((c) => c.cardId === cardId && !c.voided && getYearMonth(c.expenseDate) === yearMonth)
      .reduce((s, c) => s + c.amount, 0);

  const totalMonthAll = useMemo(
    () => charges.filter((c) => !c.voided && getYearMonth(c.expenseDate) === filterMonth).reduce((s, c) => s + c.amount, 0),
    [charges, filterMonth],
  );

  // ─── Handlers ───
  const handleSaveCard = async () => {
    if (!cardForm.holder.trim() || !cardForm.last4.trim()) {
      toast({ title: "Datos requeridos", description: "Titular y últimos 4 dígitos.", variant: "destructive" });
      return;
    }
    const payload = {
      holder: cardForm.holder.trim(),
      holderUserId: cardForm.holderUserId || null,
      last4: cardForm.last4.replace(/\D/g, "").slice(-4),
      brand: cardForm.brand,
      monthlyLimit: Number(cardForm.monthlyLimit) || 0,
      department: cardForm.department,
      notes: cardForm.notes,
    };
    let next: CorporateCard;
    if (apiMode) {
      try { next = await corporateCardsApi.createCard(payload); }
      catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); return; }
    } else {
      next = {
        id: `CC-${Date.now()}`, ...payload, active: true,
        createdAt: new Date().toISOString(),
      } as CorporateCard;
    }
    const updated = [next, ...cards];
    setCards(updated);
    saveLocal(LS_CARDS, updated);
    setCardDialogOpen(false);
    setCardForm(emptyCard);
    toast({ title: "Tarjeta registrada", description: `${next.holder} · ****${next.last4}` });
  };

  const handleDeleteCard = async (id: string) => {
    if (!canManage) return;
    if (!confirm("¿Eliminar esta tarjeta? Si tiene cargos se desactivará en su lugar.")) return;
    if (apiMode) {
      try { await corporateCardsApi.removeCard(id); }
      catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); return; }
    }
    const hasCharges = charges.some((c) => c.cardId === id);
    const updated = hasCharges
      ? cards.map((c) => (c.id === id ? { ...c, active: false } : c))
      : cards.filter((c) => c.id !== id);
    setCards(updated);
    saveLocal(LS_CARDS, updated);
    toast({ title: hasCharges ? "Tarjeta desactivada" : "Tarjeta eliminada" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(pdf|jpg|jpeg|png)$/i.test(f.name)) {
      toast({ title: "Formato no permitido", description: "Solo PDF/JPG/PNG", variant: "destructive" });
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "Máximo 5MB", variant: "destructive" });
      return;
    }
    setReceiptFile(f);
    const reader = new FileReader();
    reader.onload = () => setReceiptPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleSaveCharge = async () => {
    if (!user) return;
    if (!chargeForm.cardId || !chargeForm.description.trim() || !chargeForm.amount) {
      toast({ title: "Datos requeridos", description: "Tarjeta, descripción y monto.", variant: "destructive" });
      return;
    }
    const amount = Number(chargeForm.amount);
    if (amount <= 0) {
      toast({ title: "Monto inválido", variant: "destructive" }); return;
    }
    // Validar fecha no futura
    if (new Date(chargeForm.expenseDate) > new Date(new Date().toISOString().slice(0, 10) + "T23:59:59")) {
      toast({ title: "Fecha inválida", description: "No se permiten fechas futuras.", variant: "destructive" });
      return;
    }

    let receiptDataUrl = "";
    if (receiptFile && receiptPreview) receiptDataUrl = receiptPreview;

    let next: CardCharge;
    if (apiMode) {
      try {
        next = await corporateCardsApi.createCharge({
          cardId: chargeForm.cardId,
          expenseDate: chargeForm.expenseDate,
          description: chargeForm.description.trim(),
          amount,
          category: chargeForm.category,
          merchant: chargeForm.merchant.trim(),
          notes: chargeForm.notes.trim(),
          registeredBy: user.fullName,
          receiptDataUrl: receiptDataUrl || undefined,
          receiptName: receiptFile?.name,
        });
      } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); return; }
    } else {
      next = {
        id: `CCH-${Date.now()}`,
        cardId: chargeForm.cardId,
        expenseDate: chargeForm.expenseDate,
        description: chargeForm.description.trim(),
        amount,
        category: chargeForm.category,
        merchant: chargeForm.merchant.trim(),
        notes: chargeForm.notes.trim(),
        registeredBy: user.fullName,
        registeredAt: new Date().toISOString(),
        receiptUrl: "",
        receiptName: receiptFile?.name || "",
        voided: false,
      };
    }

    const updated = [next, ...charges];
    setCharges(updated);
    saveLocal(LS_CHARGES, updated);
    setChargeDialogOpen(false);
    setChargeForm(emptyCharge);
    setReceiptFile(null);
    setReceiptPreview("");
    if (fileRef.current) fileRef.current.value = "";
    toast({ title: "Cargo registrado", description: `${fmt(amount)} · ${next.description}` });
  };

  const handleVoid = async () => {
    if (!voidDialog || !user) return;
    if (voidReason.trim().length < 5) {
      toast({ title: "Justificación requerida", description: "Mínimo 5 caracteres.", variant: "destructive" });
      return;
    }
    let updated: CardCharge;
    if (apiMode) {
      try { updated = await corporateCardsApi.voidCharge(voidDialog.id, user.fullName, voidReason.trim()); }
      catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); return; }
    } else {
      updated = {
        ...voidDialog, voided: true, voidedReason: voidReason.trim(),
        voidedBy: user.fullName, voidedAt: new Date().toISOString(),
      };
    }
    const next = charges.map((c) => (c.id === updated.id ? updated : c));
    setCharges(next);
    saveLocal(LS_CHARGES, next);
    setVoidDialog(null);
    setVoidReason("");
    toast({ title: "Cargo anulado" });
  };

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-primary" /> Tarjetas Corporativas
              </h1>
              <p className="text-sm text-muted-foreground">
                Gestión de tarjetas asignadas, límites mensuales y cargos
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {canManage && (
                <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" /> Nueva tarjeta
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="font-heading">Registrar tarjeta corporativa</DialogTitle>
                      <DialogDescription>
                        Por seguridad, solo se almacenan los últimos 4 dígitos.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Titular</Label>
                        <Select
                          value={cardForm.holderUserId}
                          onValueChange={(v) => {
                            const u = allUsers.find((x) => x.id === v);
                            setCardForm({
                              ...cardForm,
                              holderUserId: v,
                              holder: u?.fullName || cardForm.holder,
                              department: u?.department || cardForm.department,
                            });
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                          <SelectContent>
                            {allUsers.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.fullName} — {u.department}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="mt-2"
                          placeholder="O escribir nombre manualmente"
                          value={cardForm.holder}
                          onChange={(e) => setCardForm({ ...cardForm, holder: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Marca</Label>
                          <Select value={cardForm.brand} onValueChange={(v) => setCardForm({ ...cardForm, brand: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Visa">Visa</SelectItem>
                              <SelectItem value="Mastercard">Mastercard</SelectItem>
                              <SelectItem value="American Express">American Express</SelectItem>
                              <SelectItem value="Otra">Otra</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Últimos 4 dígitos</Label>
                          <Input
                            maxLength={4}
                            placeholder="1234"
                            value={cardForm.last4}
                            onChange={(e) => setCardForm({ ...cardForm, last4: e.target.value.replace(/\D/g, "") })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Límite mensual (RD$)</Label>
                          <Input
                            type="number"
                            placeholder="0 = sin límite"
                            value={cardForm.monthlyLimit}
                            onChange={(e) => setCardForm({ ...cardForm, monthlyLimit: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Departamento</Label>
                          <Input
                            value={cardForm.department}
                            onChange={(e) => setCardForm({ ...cardForm, department: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Notas</Label>
                        <Textarea
                          rows={2}
                          value={cardForm.notes}
                          onChange={(e) => setCardForm({ ...cardForm, notes: e.target.value })}
                        />
                      </div>
                      <Button onClick={handleSaveCard} className="w-full">Guardar tarjeta</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              <Dialog open={chargeDialogOpen} onOpenChange={(o) => {
                setChargeDialogOpen(o);
                if (!o) { setChargeForm(emptyCharge); setReceiptFile(null); setReceiptPreview(""); }
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2" disabled={activeCards.length === 0}>
                    <Plus className="h-4 w-4" /> Registrar cargo
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-heading">Registrar cargo a tarjeta</DialogTitle>
                    <DialogDescription>
                      Adjuntar voucher/factura es opcional pero recomendado.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Tarjeta</Label>
                      <Select value={chargeForm.cardId} onValueChange={(v) => setChargeForm({ ...chargeForm, cardId: v })}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>
                          {activeCards.map((c) => {
                            const used = cardUsage(c.id, currentYearMonth());
                            return (
                              <SelectItem key={c.id} value={c.id}>
                                {c.holder} ({c.brand} ****{c.last4})
                                {c.monthlyLimit > 0 && ` — Usado ${fmt(used)} de ${fmt(c.monthlyLimit)}`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Fecha del cargo</Label>
                        <Input
                          type="date"
                          value={chargeForm.expenseDate}
                          max={todayISO()}
                          onChange={(e) => setChargeForm({ ...chargeForm, expenseDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Monto (RD$)</Label>
                        <Input
                          type="number"
                          value={chargeForm.amount}
                          onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Descripción</Label>
                      <Input
                        value={chargeForm.description}
                        onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Categoría</Label>
                        <Select value={chargeForm.category} onValueChange={(v) => setChargeForm({ ...chargeForm, category: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CARD_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Comercio (opcional)</Label>
                        <Input
                          value={chargeForm.merchant}
                          onChange={(e) => setChargeForm({ ...chargeForm, merchant: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Voucher/Factura (opcional, max 5MB)</Label>
                      <Input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
                      {receiptFile && <p className="text-xs text-muted-foreground mt-1">{receiptFile.name}</p>}
                    </div>
                    <div>
                      <Label>Notas</Label>
                      <Textarea rows={2} value={chargeForm.notes} onChange={(e) => setChargeForm({ ...chargeForm, notes: e.target.value })} />
                    </div>
                    <Button onClick={handleSaveCharge} className="w-full">Guardar cargo</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* KPIs del mes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-5 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><CreditCard className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Tarjetas activas</p>
                  <p className="text-lg font-heading font-bold">{activeCards.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10"><Wallet className="h-5 w-5 text-emerald-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Cargos del mes</p>
                  <p className="text-lg font-heading font-bold">
                    {charges.filter((c) => !c.voided && getYearMonth(c.expenseDate) === currentYearMonth()).length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10"><Receipt className="h-5 w-5 text-amber-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total mes actual</p>
                  <p className="text-lg font-heading font-bold">
                    {fmt(charges.filter((c) => !c.voided && getYearMonth(c.expenseDate) === currentYearMonth()).reduce((s, c) => s + c.amount, 0))}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10"><TrendingUp className="h-5 w-5 text-blue-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Límite total mensual</p>
                  <p className="text-lg font-heading font-bold">
                    {fmt(activeCards.reduce((s, c) => s + (c.monthlyLimit || 0), 0))}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="cards" className="space-y-4">
            <TabsList>
              <TabsTrigger value="cards">Tarjetas</TabsTrigger>
              <TabsTrigger value="charges">Cargos</TabsTrigger>
            </TabsList>

            <TabsContent value="cards" className="space-y-3">
              {activeCards.length === 0 ? (
                <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground text-center py-8">No hay tarjetas registradas.</p></CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeCards.map((c) => {
                    const used = cardUsage(c.id, currentYearMonth());
                    const pct = c.monthlyLimit > 0 ? (used / c.monthlyLimit) * 100 : 0;
                    const overLimit = c.monthlyLimit > 0 && used > c.monthlyLimit;
                    return (
                      <Card key={c.id} className="relative overflow-hidden">
                        <CardContent className="pt-5 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">{c.brand}</p>
                              <p className="font-heading font-bold text-lg">**** {c.last4}</p>
                              <p className="text-sm">{c.holder}</p>
                              {c.department && <p className="text-xs text-muted-foreground">{c.department}</p>}
                            </div>
                            {canManage && (
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteCard(c.id)} title="Eliminar/desactivar">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Usado este mes</span>
                              <span className={overLimit ? "text-destructive font-semibold" : "font-semibold"}>
                                {fmt(used)}{c.monthlyLimit > 0 && ` / ${fmt(c.monthlyLimit)}`}
                              </span>
                            </div>
                            {c.monthlyLimit > 0 && (
                              <div className="h-2 bg-muted rounded overflow-hidden">
                                <div
                                  className={overLimit ? "h-full bg-destructive" : pct > 80 ? "h-full bg-amber-500" : "h-full bg-primary"}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                            )}
                          </div>
                          {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="charges" className="space-y-3">
              <Card>
                <CardContent className="pt-5">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                    <div>
                      <Label className="text-xs">Mes</Label>
                      <Select value={filterMonth} onValueChange={setFilterMonth}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {monthsAvailable.map((m) => (
                            <SelectItem key={m} value={m}>
                              {format(new Date(m + "-01T12:00:00"), "MMMM yyyy", { locale: es })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Tarjeta</Label>
                      <Select value={filterCardId} onValueChange={setFilterCardId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all">Todas</SelectItem>
                          {cards.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.holder} ****{c.last4}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <p className="text-sm">
                        <strong>Total filtro:</strong> {fmt(filteredCharges.filter((c) => !c.voided).reduce((s, c) => s + c.amount, 0))}
                      </p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tarjeta</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Voucher</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCharges.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                            Sin cargos en este filtro.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCharges.map((c) => {
                          const card = cards.find((x) => x.id === c.cardId);
                          return (
                            <TableRow key={c.id} className={c.voided ? "opacity-60" : ""}>
                              <TableCell>{fmtDate(c.expenseDate)}</TableCell>
                              <TableCell className="text-xs">
                                {card ? `${card.holder} ****${card.last4}` : c.cardId}
                              </TableCell>
                              <TableCell className="max-w-xs truncate" title={c.description}>{c.description}</TableCell>
                              <TableCell><Badge variant="outline">{c.category}</Badge></TableCell>
                              <TableCell className="text-right font-semibold">{fmt(c.amount)}</TableCell>
                              <TableCell>
                                {c.receiptUrl ? (
                                  <a href={getFileUrl(c.receiptUrl)} target="_blank" rel="noreferrer">
                                    <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                                  </a>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell>
                                {c.voided ? <Badge variant="destructive">Anulado</Badge> : <Badge variant="default">Activo</Badge>}
                              </TableCell>
                              <TableCell>
                                {!c.voided && canManage && (
                                  <Button size="sm" variant="ghost" onClick={() => setVoidDialog(c)} title="Anular">
                                    <Ban className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Anular */}
      <Dialog open={!!voidDialog} onOpenChange={(o) => { if (!o) { setVoidDialog(null); setVoidReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anular cargo</DialogTitle>
            <DialogDescription>Indique la justificación. El cargo no se elimina, solo se marca como anulado.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Justificación..."
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVoidDialog(null); setVoidReason(""); }}>Cancelar</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={voidReason.trim().length < 5}>Anular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default CorporateCards;
