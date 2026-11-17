import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Database, DatabaseZap, History, Loader2, RefreshCw, Search, ShieldCheck, UserPlus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { fleetDbSyncApi, type FleetDbAuditEntry, type FleetDbCompare, type FleetDbEstado, type FleetDbItem } from "@/lib/api";
import { formatRD } from "@/lib/fleetMaintenanceData";
import { cn } from "@/lib/utils";

const ESTADOS: { key: FleetDbEstado; label: string; hint: string; tone: string }[] = [
  { key: "pendiente", label: "Pendientes", hint: "Están en la intranet y no en la base de datos", tone: "border-primary/50 bg-primary/5" },
  { key: "diferente", label: "Con diferencias", hint: "Se editaron en la intranet después de registrarlos", tone: "border-destructive/40 bg-destructive/5" },
  { key: "sincronizado", label: "Ya registrados", hint: "Iguales en la intranet y en la base de datos", tone: "border-border bg-muted/40" },
  { key: "solo_bd", label: "Solo en la base", hint: "Se borraron en la intranet; pueden anularse", tone: "border-border bg-muted/40" },
];
const ESTADO_BADGE: Record<FleetDbEstado, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendiente: { label: "Pendiente", variant: "default" },
  diferente: { label: "Diferente", variant: "destructive" },
  sincronizado: { label: "Registrado", variant: "secondary" },
  solo_bd: { label: "Solo en base", variant: "outline" },
  anulado_bd: { label: "Anulado", variant: "outline" },
};
const ACCION_LABEL: Record<string, string> = {
  registrar: "Registró", actualizar: "Actualizó", anular: "Anuló", designar: "Cambió personas autorizadas", preparar_tabla: "Preparó la base de datos",
};
const fmtVal = (campo: string, v: unknown) =>
  v == null || v === "" ? "—" : campo === "costo" ? formatRD(Number(v)) : String(v);
const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" }) : "—");

interface Props { isOwner: boolean; initialDelegates: string[]; onRegistered?: () => void }

export default function FleetDbSyncPanel({ isOwner, initialDelegates, onRegistered }: Props) {
  const { toast } = useToast();
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fleetDbSyncApi.status>> | null>(null);
  const [data, setData] = useState<FleetDbCompare | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FleetDbEstado>("pendiente");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<FleetDbItem | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [audit, setAudit] = useState<FleetDbAuditEntry[]>([]);
  const [delegates, setDelegates] = useState<string[]>(initialDelegates);
  const [users, setUsers] = useState<{ email: string; nombre: string; departamento: string }[]>([]);
  const [newDelegate, setNewDelegate] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const st = await fleetDbSyncApi.status();
      setStatus(st);
      if (st.connected && st.tableExists) {
        const cmp = await fleetDbSyncApi.compare();
        setData(cmp);
        setSelected(new Set());
      } else setData(null);
      setAudit(await fleetDbSyncApi.audit().catch(() => []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar la base de datos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (isOwner) fleetDbSyncApi.users().then(setUsers).catch(() => setUsers([])); }, [isOwner]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.items || []).filter((i) => {
      if (i.estado !== filter) return false;
      if (!q) return true;
      const r = i.intranet || i.baseDatos;
      return [r?.placa, r?.taller, r?.tipoMant, i.intranet?.id, i.intranet?.detalle].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [data, filter, search]);

  const selectable = visible.filter((i) => (i.estado === "pendiente" || i.estado === "diferente") && i.intranet);
  const selectedItems = (data?.items || []).filter((i) => i.intranet && selected.has(i.intranet.id));
  const selectedTotal = selectedItems.reduce((s, i) => s + (i.intranet?.costo || 0), 0);
  const nuevos = selectedItems.filter((i) => i.estado === "pendiente").length;
  const actualizaciones = selectedItems.filter((i) => i.estado === "diferente").length;
  const dupSelected = selectedItems.filter((i) => i.posibleDuplicado).length;
  const allVisibleSelected = selectable.length > 0 && selectable.every((i) => selected.has(i.intranet!.id));

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allVisibleSelected) selectable.forEach((i) => n.delete(i.intranet!.id));
    else selectable.forEach((i) => n.add(i.intranet!.id));
    return n;
  });

  const doRegister = async () => {
    setBusy(true);
    try {
      const r = await fleetDbSyncApi.register([...selected]);
      toast({
        title: "Registro en la base de datos",
        description: `${r.registrados} nuevo(s), ${r.actualizados} actualizado(s)${r.sinCambios ? `, ${r.sinCambios} sin cambios` : ""}.${r.errores.length ? ` ${r.errores.length} con error.` : ""}`,
        variant: r.errores.length && !r.registrados && !r.actualizados ? "destructive" : "default",
      });
      if (r.errores.length) console.warn("[Flotilla → SafeOne]", r.errores);
      setConfirmOpen(false);
      await load();
      onRegistered?.();
    } catch (e) {
      toast({ title: "No se pudo registrar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const doSetup = async () => {
    setBusy(true);
    try {
      await fleetDbSyncApi.setup();
      toast({ title: "Base de datos lista", description: "Ya puede comparar y registrar los gastos." });
      setSetupOpen(false);
      await load();
    } catch (e) {
      toast({ title: "No se pudo preparar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const doVoid = async () => {
    if (!voidTarget?.baseDatos) return;
    setBusy(true);
    try {
      await fleetDbSyncApi.voidRow(voidTarget.baseDatos.oid, voidReason.trim());
      toast({ title: "Registro anulado", description: "Queda en la base de datos marcado como anulado, con su motivo." });
      setVoidTarget(null); setVoidReason("");
      await load();
    } catch (e) {
      toast({ title: "No se pudo anular", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const saveDelegates = async (next: string[]) => {
    try {
      const r = await fleetDbSyncApi.setDelegates(next);
      setDelegates(r.delegates);
      setNewDelegate("");
      setAudit(await fleetDbSyncApi.audit().catch(() => audit));
      toast({ title: "Personas autorizadas actualizadas" });
    } catch (e) {
      toast({ title: "No se pudo guardar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };
  const userName = (email: string) => users.find((u) => u.email === email)?.nombre || email;

  return (
    <div className="space-y-6">
      {/* Estado */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", status?.connected && status.tableExists ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
            <Database className="h-5 w-5" />
          </div>
          <div className="min-w-[240px] flex-1">
            <p className="font-semibold text-foreground">Gastos de flotilla en la base de datos SafeOne</p>
            <p className="text-sm text-muted-foreground">
              {loading ? "Consultando…"
                : error ? error
                : !status?.connected ? `Sin conexión con SafeOne${status?.message ? `: ${status.message}` : ""}.`
                : !status.tableExists ? "La base de datos todavía no tiene el espacio para estos gastos."
                : `Conectado. Última comparación: ${fmtDate(data?.generadoEn)}.`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Se guardan aparte de la contabilidad (caja chica y compras no se modifican). Nada se borra: lo eliminado en la intranet se anula con motivo.
            </p>
          </div>
          <div className="flex gap-2">
            {status?.connected && !status.tableExists && isOwner && (
              <Button onClick={() => setSetupOpen(true)} className="gap-2"><DatabaseZap className="h-4 w-4" /> Preparar base de datos</Button>
            )}
            <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Comparar de nuevo
            </Button>
          </div>
          {status?.connected && !status.tableExists && !isOwner && (
            <p className="w-full rounded-md bg-muted p-3 text-sm text-muted-foreground">Chrisnel Fabián debe preparar la base de datos antes del primer registro.</p>
          )}
        </CardContent>
      </Card>

      {data && (
        <>
          {data.aviso && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {data.aviso}
            </div>
          )}

          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {ESTADOS.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => setFilter(e.key)}
                className={cn("rounded-lg border p-4 text-left transition-colors", e.tone, filter === e.key && "ring-2 ring-primary")}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{e.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{data.resumen[e.key]?.cantidad ?? 0}</p>
                <p className="text-sm text-muted-foreground">{formatRD(data.resumen[e.key]?.monto ?? 0)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{e.hint}</p>
              </button>
            ))}
          </div>

          {/* Lista */}
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
              <CardTitle className="flex-1 text-base">{ESTADOS.find((e) => e.key === filter)?.label}</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Placa, taller, ID…" className="pl-8" />
              </div>
              {(filter === "pendiente" || filter === "diferente") && (
                <Button disabled={!selected.size} onClick={() => setConfirmOpen(true)} className="gap-2">
                  <ShieldCheck className="h-4 w-4" /> Registrar seleccionados ({selected.size})
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {(filter === "pendiente" || filter === "diferente") && (
                        <TableHead className="w-10">
                          <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Seleccionar todos" />
                        </TableHead>
                      )}
                      <TableHead>ID</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Taller</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead>Detalle</TableHead>
                      {filter === "solo_bd" && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        {filter === "pendiente" ? <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> No hay gastos pendientes.</span> : "Sin registros."}
                      </TableCell></TableRow>
                    )}
                    {visible.map((i) => {
                      const r = i.intranet || i.baseDatos!;
                      const id = i.intranet?.id || i.baseDatos?.intranetId || String(i.baseDatos?.oid);
                      return (
                        <TableRow key={`${i.estado}-${id}`}>
                          {(filter === "pendiente" || filter === "diferente") && (
                            <TableCell>
                              <Checkbox checked={!!i.intranet && selected.has(i.intranet.id)} onCheckedChange={() => i.intranet && toggle(i.intranet.id)} aria-label={`Seleccionar ${id}`} />
                            </TableCell>
                          )}
                          <TableCell className="font-mono text-xs">
                            {id}
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge variant={ESTADO_BADGE[i.estado].variant}>{ESTADO_BADGE[i.estado].label}</Badge>
                              {i.posibleDuplicado && <Badge variant="destructive">Posible duplicado</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{r.placa}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.fecha || "—"}</TableCell>
                          <TableCell>
                            {r.taller || "—"}
                            {i.intranet && (i.suplidor
                              ? <p className="text-xs text-muted-foreground">Suplidor oficial #{i.suplidor.oid}</p>
                              : <p className="text-xs text-destructive">No coincide con un suplidor oficial</p>)}
                          </TableCell>
                          <TableCell>{r.tipoMant || "—"}</TableCell>
                          <TableCell className="text-right font-medium">{formatRD(r.costo)}</TableCell>
                          <TableCell className="max-w-[280px] text-sm">
                            {i.diferencias.length > 0 ? (
                              <ul className="space-y-0.5">
                                {i.diferencias.map((d) => (
                                  <li key={d.campo}><span className="font-medium">{d.etiqueta}:</span> {fmtVal(d.campo, d.baseDatos)} → <span className="font-medium text-foreground">{fmtVal(d.campo, d.intranet)}</span></li>
                                ))}
                              </ul>
                            ) : i.estado === "solo_bd" || i.estado === "sincronizado" ? (
                              <span className="text-xs text-muted-foreground">Registrado por {i.baseDatos?.registradoPor || "—"} · {fmtDate(i.baseDatos?.registradoEn)}</span>
                            ) : (
                              <span className="text-muted-foreground">{i.intranet?.detalle || "—"}</span>
                            )}
                          </TableCell>
                          {filter === "solo_bd" && (
                            <TableCell><Button size="sm" variant="outline" onClick={() => setVoidTarget(i)}>Anular</Button></TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personas autorizadas */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Quién puede registrar</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border p-2">
              <span>Chrisnel Fabián <span className="text-muted-foreground">(responsable)</span></span>
              <Badge variant="secondary">Siempre</Badge>
            </div>
            {delegates.length === 0 && <p className="text-muted-foreground">Nadie más está autorizado.</p>}
            {delegates.map((d) => (
              <div key={d} className="flex items-center justify-between rounded-md border p-2">
                <span>{userName(d)} <span className="text-muted-foreground">{d}</span></span>
                {isOwner && (
                  <Button size="icon" variant="ghost" aria-label={`Quitar ${d}`} onClick={() => saveDelegates(delegates.filter((x) => x !== d))}><X className="h-4 w-4" /></Button>
                )}
              </div>
            ))}
            {isOwner ? (
              <div className="flex gap-2">
                <Select value={newDelegate} onValueChange={setNewDelegate}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Elegir usuario de la intranet" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {users.filter((u) => !delegates.includes(u.email)).map((u) => (
                      <SelectItem key={u.email} value={u.email}>{u.nombre}{u.departamento ? ` — ${u.departamento}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button disabled={!newDelegate} onClick={() => saveDelegates([...delegates, newDelegate])} className="gap-2"><UserPlus className="h-4 w-4" /> Autorizar</Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Solo Chrisnel puede cambiar esta lista.</p>
            )}
          </CardContent>
        </Card>

        {/* Historial */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Historial</CardTitle></CardHeader>
          <CardContent>
            {audit.length === 0 ? <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p> : (
              <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                {audit.slice(0, 60).map((a) => (
                  <li key={a.id} className="border-b pb-2 last:border-0">
                    <p><span className="font-medium">{a.by}</span> · {ACCION_LABEL[a.accion] || a.accion}
                      {a.intranetId ? <span className="font-mono text-xs"> {String(a.intranetId)}</span> : null}
                      {typeof a.costo === "number" ? ` — ${formatRD(a.costo)}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(a.at)}{a.motivo ? ` · Motivo: ${String(a.motivo)}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmar registro */}
      <AlertDialog open={confirmOpen} onOpenChange={(o) => !busy && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Registrar en la base de datos SafeOne?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{nuevos} gasto(s) nuevo(s) y {actualizaciones} corrección(es), por un total de <strong>{formatRD(selectedTotal)}</strong>.</p>
                {dupSelected > 0 && (
                  <p className="flex items-start gap-2 text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {dupSelected} parecen digitados dos veces. Revíselos antes de continuar.</p>
                )}
                <p>Quedará anotado quién lo registró y cuándo.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); doRegister(); }}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Registrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preparar tabla */}
      <AlertDialog open={setupOpen} onOpenChange={(o) => !busy && setSetupOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preparar la base de datos</AlertDialogTitle>
            <AlertDialogDescription>
              Se creará en SafeOne un espacio nuevo, solo para los gastos de mantenimiento de flotilla. No se cambia ni se borra nada de lo que ya existe (contabilidad, caja chica, compras o suplidores).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); doSetup(); }}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Preparar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Anular */}
      <Dialog open={!!voidTarget} onOpenChange={(o) => { if (!o && !busy) { setVoidTarget(null); setVoidReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular registro en la base de datos</DialogTitle>
            <DialogDescription>
              {voidTarget?.baseDatos && `${voidTarget.baseDatos.intranetId} · ${voidTarget.baseDatos.placa} · ${formatRD(voidTarget.baseDatos.costo)}. `}
              No se borra: queda marcado como anulado con el motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="void-reason">Motivo</Label>
            <Textarea id="void-reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Ej.: gasto digitado por error en la intranet" />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => { setVoidTarget(null); setVoidReason(""); }}>Cancelar</Button>
            <Button disabled={busy || voidReason.trim().length < 5} onClick={doVoid}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
