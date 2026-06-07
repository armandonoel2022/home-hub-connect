import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import {
  getApprovedLoans, loanPrincipal, loanTotalToPay, loanPaid, loanBalance,
  registerLoanPayment,
} from "@/lib/hrRequestService";
import { generalSqlApi, type GeneralLoan } from "@/lib/api";
import type { HRRequest } from "@/lib/hrRequestTypes";
import { Banknote, Wallet, TrendingDown, HandCoins, Plus, Database } from "lucide-react";

const rd = (n: number) => `RD$${(Math.round(n) || 0).toLocaleString()}`;

const LoanControl = () => {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState("");
  const [payTarget, setPayTarget] = useState<HRRequest | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");

  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    window.addEventListener("safeone:hr-updated", h);
    return () => window.removeEventListener("safeone:hr-updated", h);
  }, []);

  const loans = useMemo(() => getApprovedLoans(), [tick]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return loans.filter((l) =>
      !q || `${l.id} ${l.requestedByName} ${l.department}`.toLowerCase().includes(q)
    );
  }, [loans, filter]);

  const totals = useMemo(() => {
    let lent = 0, toPay = 0, paid = 0, balance = 0;
    for (const l of loans) {
      lent += loanPrincipal(l);
      toPay += loanTotalToPay(l);
      paid += loanPaid(l);
      balance += loanBalance(l);
    }
    return { lent, toPay, paid, balance };
  }, [loans]);

  const openPay = (l: HRRequest) => {
    setPayTarget(l);
    setPayAmount(String(l.loanDetails?.approvedInstallment ?? l.loanDetails?.monthlyInstallment ?? ""));
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNote("");
  };

  const confirmPay = () => {
    if (!user || !payTarget) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { toast({ title: "Monto inválido", variant: "destructive" }); return; }
    registerLoanPayment(payTarget.id, amt, user.fullName, payDate, payNote.trim() || undefined);
    toast({ title: "Abono registrado", description: `${rd(amt)} aplicados al préstamo ${payTarget.id}.` });
    setPayTarget(null);
    setTick((t) => t + 1);
  };

  return (
    <AppLayout>
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6 text-primary" /> Control de Préstamos
          </h1>
          <p className="text-sm text-muted-foreground">
            Cartera de préstamos aprobados: lo prestado, lo cobrado y el saldo pendiente.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><HandCoins className="h-3.5 w-3.5" /> Capital prestado</div><div className="text-xl font-bold">{rd(totals.lent)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> Total a cobrar</div><div className="text-xl font-bold">{rd(totals.toPay)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3.5 w-3.5" /> Cobrado</div><div className="text-xl font-bold text-emerald-600">{rd(totals.paid)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Por cobrar</div><div className="text-xl font-bold text-amber-600">{rd(totals.balance)}</div></Card>
        </div>

        <Input placeholder="Buscar por empleado, departamento o ID…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />

        {filtered.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12 border rounded-lg">
            No hay préstamos aprobados registrados.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((l) => {
              const d = l.loanDetails;
              const total = loanTotalToPay(l);
              const paid = loanPaid(l);
              const balance = loanBalance(l);
              const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
              return (
                <Card key={l.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-[10px]">{l.id}</Badge>
                        <span className="font-semibold">{l.requestedByName}</span>
                        <span className="text-xs text-muted-foreground">· {l.department}</span>
                        {d?.frequency && <Badge variant="secondary" className="text-[10px] capitalize">{d.frequency}</Badge>}
                        {d?.tenureExceptionByRRHH && <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">Excepción RRHH</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                        <div><span className="text-muted-foreground">Prestado:</span> <strong>{rd(loanPrincipal(l))}</strong></div>
                        <div><span className="text-muted-foreground">Tasa:</span> <strong>{d?.annualInterestRatePct ?? 0}%</strong></div>
                        <div><span className="text-muted-foreground">Cuota:</span> <strong>{rd(d?.approvedInstallment ?? d?.monthlyInstallment ?? 0)}</strong></div>
                        <div><span className="text-muted-foreground">Pagos:</span> <strong>{d?.installmentsTotal ?? d?.termMonths ?? 0}</strong></div>
                        <div><span className="text-muted-foreground">Total a pagar:</span> <strong>{rd(total)}</strong></div>
                        <div><span className="text-muted-foreground">Cobrado:</span> <strong className="text-emerald-600">{rd(paid)}</strong></div>
                        <div><span className="text-muted-foreground">Saldo:</span> <strong className="text-amber-600">{rd(balance)}</strong></div>
                        {l.loanApplyDate && <div><span className="text-muted-foreground">Aplicado:</span> <strong>{l.loanApplyDate}</strong></div>}
                      </div>
                      <div className="mt-2 h-1.5 w-full max-w-md bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                      {(d?.payments || []).length > 0 && (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer text-muted-foreground">{(d?.payments || []).length} abono(s) registrado(s)</summary>
                          <ul className="mt-1 space-y-0.5">
                            {(d?.payments || []).map((p) => (
                              <li key={p.id}>{p.date} · {rd(p.amount)} {p.note ? `— ${p.note}` : ""} <span className="text-muted-foreground">({p.by})</span></li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                    <div className="shrink-0">
                      {balance > 0 && (
                        <Button size="sm" className="gap-2" onClick={() => openPay(l)}>
                          <Plus className="h-3.5 w-3.5" /> Registrar abono
                        </Button>
                      )}
                      {balance <= 0 && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Saldado</Badge>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      <Footer />

      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar abono — {payTarget?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">Monto (RD$)</label>
              <Input type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold">Fecha de cobro</label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold">Nota (opcional)</label>
              <Textarea value={payNote} onChange={(e) => setPayNote(e.target.value)} rows={2} placeholder="Ej: Descontado en nómina quincena 1…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayTarget(null)}>Cancelar</Button>
            <Button onClick={confirmPay}>Guardar abono</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default LoanControl;
