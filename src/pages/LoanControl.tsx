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
  getApprovedLoans, getAllLoanRequests, loanPrincipal, loanTotalToPay, loanPaid, loanBalance,
  registerLoanPayment,
} from "@/lib/hrRequestService";
import { generateAmortizationPDF, amortizationInputFromRequest } from "@/lib/loanAmortizationPdf";
import { generalSqlApi, type GeneralLoan } from "@/lib/api";
import type { HRRequest, HRRequestStatus } from "@/lib/hrRequestTypes";
import { Banknote, Wallet, TrendingDown, HandCoins, Plus, Database, FileText, ListChecks } from "lucide-react";

const rd = (n: number) => `RD$${(Math.round(n) || 0).toLocaleString()}`;

const STATUS_BADGE: Record<HRRequestStatus, string> = {
  "Pendiente Supervisor": "bg-slate-100 text-slate-700 border-slate-200",
  "Aprobada Supervisor": "bg-blue-100 text-blue-700 border-blue-200",
  "Pendiente RRHH": "bg-amber-100 text-amber-700 border-amber-200",
  "Pendiente Gerencia General": "bg-purple-100 text-purple-700 border-purple-200",
  "Pendiente Aplicación RRHH": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "Aprobada": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Rechazada": "bg-red-100 text-red-700 border-red-200",
};

const LoanControl = () => {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState("");
  const [payTarget, setPayTarget] = useState<HRRequest | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");
  const [genLoans, setGenLoans] = useState<GeneralLoan[] | null>(null);
  const [genTotals, setGenTotals] = useState<{ prestado: number; cobrado: number; saldo: number } | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState("");
  const [showGen, setShowGen] = useState(false);

  const loadGeneralLoans = () => {
    setShowGen(true);
    setGenLoading(true);
    setGenError("");
    generalSqlApi.loans()
      .then((res) => { setGenLoans(res.items); setGenTotals(res.totals); })
      .catch((e) => setGenError(String(e?.message || e)))
      .finally(() => setGenLoading(false));
  };

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

        {/* Préstamos en GENERAL (gSafeOne) */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold">Préstamos en GENERAL (gSafeOne)</h2>
                <p className="text-xs text-muted-foreground">Lectura directa de la tabla Prestamo del software GENERAL.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={loadGeneralLoans} disabled={genLoading}>
              {genLoading ? "Cargando…" : showGen ? "Recargar" : "Cargar desde GENERAL"}
            </Button>
          </div>

          {genError && <p className="text-sm text-destructive">{genError}</p>}

          {showGen && !genError && genTotals && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Prestado</div><div className="text-lg font-bold">{rd(genTotals.prestado)}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Cobrado</div><div className="text-lg font-bold text-emerald-600">{rd(genTotals.cobrado)}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Saldo</div><div className="text-lg font-bold text-amber-600">{rd(genTotals.saldo)}</div></div>
            </div>
          )}

          {showGen && !genError && genLoans && (
            genLoans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay préstamos en GENERAL.</p>
            ) : (
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-2">Código</th>
                      <th className="py-2 px-2">Empleado</th>
                      <th className="py-2 px-2">Fecha</th>
                      <th className="py-2 px-2 text-right">Monto</th>
                      <th className="py-2 px-2 text-right">Cuota</th>
                      <th className="py-2 px-2 text-right">Pagado</th>
                      <th className="py-2 pl-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {genLoans.map((l) => (
                      <tr key={String(l.oid)}>
                        <td className="py-1.5 pr-2 font-mono">{l.codigo || "—"}</td>
                        <td className="py-1.5 px-2">{l.empleado || "—"}</td>
                        <td className="py-1.5 px-2">{l.fecha ? new Date(l.fecha).toLocaleDateString("es-DO") : "—"}</td>
                        <td className="py-1.5 px-2 text-right">{rd(l.monto)}</td>
                        <td className="py-1.5 px-2 text-right">{rd(l.cuota)}</td>
                        <td className="py-1.5 px-2 text-right text-emerald-600">{rd(l.pagado)}</td>
                        <td className="py-1.5 pl-2 text-right text-amber-600">{rd(l.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </Card>
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
