import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Database, History, Link2, Loader2, RefreshCw, Search, ShieldCheck, Unlink, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { fleetDbSyncApi, type AdonisInvoice, type FleetDbAuditEntry, type FleetDbCompare, type FleetDbEstado } from "@/lib/api";
import { formatRD } from "@/lib/fleetMaintenanceData";
import { cn } from "@/lib/utils";

const ESTADOS: { key: FleetDbEstado; label: string; hint: string }[] = [
  { key: "vinculado", label: "Vinculados", hint: "El gasto de la intranet ya tiene su factura en Adonis" },
  { key: "solo_intranet", label: "Solo en la intranet", hint: "No se encontró la factura en Adonis" },
  { key: "solo_adonis", label: "Solo en Adonis", hint: "Factura con placa de la flotilla sin gasto en la intranet" },
];
const ACCION_LABEL: Record<string, string> = {
  vincular: "Vinculó", desvincular: "Desvinculó", designar: "Cambió personas autorizadas",
};
const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" }) : "—");

function InvoiceCell({ inv }: { inv: AdonisInvoice }) {
  return (
    <div className="space-y-0.5 text-sm">
      <p className="font-medium">
        Factura #{inv.oid} · {formatRD(inv.total)}
        {inv.cajaChica && <Badge variant="outline" className="ml-2">Caja chica</Badge>}
      </p>
      <p className="text-xs text-muted-foreground">{inv.suplidor || `Suplidor ${inv.suplidorOid ?? "—"}`} · {inv.fecha || "—"} · NCF {inv.ncf || "—"}</p>
      {inv.notas && <p className="text-xs italic text-muted-foreground">“{inv.notas}”</p>}
    </div>
  );
}

interface Props { isOwner: boolean; initialDelegates: string[]; onRegistered?: () => void }

export default function FleetDbSyncPanel({ isOwner, initialDelegates, onRegistered }: Props) {
  const { toast } = useToast();
  const [status, setStatus] = useState<{ connected: boolean; message?: string } | null>(null);
  const [data, setData] = useState<FleetDbCompare | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FleetDbEstado>("solo_intranet");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [audit, setAudit] = useState<FleetDbAuditEntry[]>([]);
  const [delegates, setDelegates] = useState<string[]>(initialDelegates);
  const [users, setUsers] = useState<{ email: string; nombre: string; departamento: string }[]>([]);
  const [newDelegate, setNewDelegate] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const st = await fleetDbSyncApi.status();
      setStatus(st);
      setData(st.connected ? await fleetDbSyncApi.compare() : null);
      setAudit(await fleetDbSyncApi.audit().catch(() => []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar Adonis.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (isOwner) fleetDbSyncApi.users().then(setUsers).catch(() => setUsers([])); }, [isOwner]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.items || []).filter((i) => {
      if (i.estado !== filter) return false;
      if (!q) return true;
      return [i.intranet?.placa, i.intranet?.taller, i.intranet?.id, i.adonis?.suplidor, i.adonis?.ncf, i.adonis?.notas, String(i.adonis?.oid ?? "")]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [data, filter, search]);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast({ title: ok }); await load(); onRegistered?.(); }
    catch (e) { toast({ title: "No se pudo completar", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
    finally { setBusy(null); }
  };
  const link = (entryId: string, oid: number) => act(`l-${entryId}-${oid}`, () => fleetDbSyncApi.link(entryId, oid), `Gasto ${entryId} vinculado con la factura #${oid}`);
  const unlink = (entryId: string) => act(`u-${entryId}`, () => fleetDbSyncApi.unlink(entryId), `Gasto ${entryId} desvinculado`);

  const saveDelegates = async (next: string[]) => {
    try {
      const r = await fleetDbSyncApi.setDelegates(next);
      setDelegates(r.delegates); setNewDelegate("");
      setAudit(await fleetDbSyncApi.audit().catch(() => audit));
      toast({ title: "Personas autorizadas actualizadas" });
    } catch (e) {
      toast({ title: "No se pudo guardar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };
  const userName = (email: string) => users.find((u) => u.email === email)?.nombre || email;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", status?.connected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
            <Database className="h-5 w-5" />
          </div>
          <div className="min-w-[240px] flex-1">
            <p className="font-semibold text-foreground">Gastos de la intranet comparados con las facturas de Adonis</p>
            <p className="text-sm text-muted-foreground">
              {loading ? "Consultando Adonis…"
                : error ? error
                : !status?.connected ? `Sin conexión con SafeOne${status?.message ? `: ${status.message}` : ""}.`
                : `${data?.facturasLeidas ?? 0} facturas de suplidor y caja chica desde ${data?.desde}. Última comparación: ${fmtDate(data?.generadoEn)}.`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Solo se lee Adonis. Se cruzan por la placa escrita en las notas de la factura, el monto (con o sin ITBIS) y la fecha. El vínculo se guarda en la intranet.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Comparar de nuevo
          </Button>
        </CardContent>
      </Card>

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {ESTADOS.map((e) => (
              <button key={e.key} type="button" onClick={() => setFilter(e.key)}
                className={cn("rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40", filter === e.key && "ring-2 ring-primary")}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{e.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{data.resumen[e.key]?.cantidad ?? 0}</p>
                <p className="text-sm text-muted-foreground">{formatRD(data.resumen[e.key]?.monto ?? 0)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{e.hint}</p>
              </button>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
              <CardTitle className="flex-1 text-base">{ESTADOS.find((e) => e.key === filter)?.label}</CardTitle>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Placa, taller, NCF, factura…" className="pl-8" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {filter !== "solo_adonis" && <TableHead>Gasto en la intranet</TableHead>}
                      <TableHead>{filter === "solo_intranet" ? "Posibles facturas en Adonis" : "Factura en Adonis"}</TableHead>
                      {filter === "vinculado" && <TableHead className="w-44" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Sin registros en este grupo.</span>
                      </TableCell></TableRow>
                    )}
                    {visible.map((i) => {
                      const key = i.intranet?.id || `adonis-${i.adonis?.oid}`;
                      return (
                        <TableRow key={key}>
                          {filter !== "solo_adonis" && i.intranet && (
                            <TableCell className="align-top">
                              <p className="font-medium"><span className="font-mono text-xs">{i.intranet.id}</span> · {i.intranet.placa} · {formatRD(i.intranet.costo)}</p>
                              <p className="text-xs text-muted-foreground">{i.intranet.fecha || "—"} · {i.intranet.taller || "—"} · {i.intranet.tipoMant || "—"}</p>
                              {i.intranet.detalle && <p className="text-xs text-muted-foreground">{i.intranet.detalle}</p>}
                            </TableCell>
                          )}
                          <TableCell className="align-top">
                            {i.estado === "solo_intranet" ? (
                              i.sugerencias.length === 0 ? <span className="text-sm text-muted-foreground">Ninguna factura de Adonis menciona la placa {i.intranet?.placa} en esas fechas.</span> : (
                                <ul className="space-y-2">
                                  {i.sugerencias.map((s) => (
                                    <li key={s.oid} className="flex flex-wrap items-start gap-3 rounded-md border p-2">
                                      <div className="min-w-[220px] flex-1"><InvoiceCell inv={s} /></div>
                                      <Button size="sm" variant="outline" className="gap-1" disabled={!!busy} onClick={() => link(i.intranet!.id, s.oid)}>
                                        {busy === `l-${i.intranet!.id}-${s.oid}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Es esta
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              )
                            ) : i.adonis && (
                              <div className="space-y-1">
                                <InvoiceCell inv={i.adonis} />
                                {i.estado === "solo_adonis" && i.adonis.placas.length > 0 && (
                                  <p className="text-xs">Placa: <span className="font-mono">{i.adonis.placas.join(", ")}</span></p>
                                )}
                              </div>
                            )}
                          </TableCell>
                          {filter === "vinculado" && i.intranet && i.adonis && (
                            <TableCell className="space-y-2 align-top">
                              <Badge variant={i.modo === "confirmado" ? "default" : "secondary"}>{i.modo === "confirmado" ? "Confirmado" : "Automático"}</Badge>
                              <div className="flex flex-wrap gap-1">
                                {i.modo === "automatico" && (
                                  <Button size="sm" variant="outline" className="gap-1" disabled={!!busy} onClick={() => link(i.intranet!.id, i.adonis!.oid)}>
                                    <ShieldCheck className="h-4 w-4" /> Confirmar
                                  </Button>
                                )}
                                {i.modo === "confirmado" && (
                                  <Button size="sm" variant="ghost" className="gap-1" disabled={!!busy} onClick={() => unlink(i.intranet!.id)}>
                                    <Unlink className="h-4 w-4" /> Desvincular
                                  </Button>
                                )}
                              </div>
                            </TableCell>
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
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Quién puede usar esta comparación</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border p-2">
              <span>Chrisnel Fabián <span className="text-muted-foreground">(responsable)</span></span>
              <Badge variant="secondary">Siempre</Badge>
            </div>
            {delegates.length === 0 && <p className="text-muted-foreground">Nadie más está autorizado.</p>}
            {delegates.map((d) => (
              <div key={d} className="flex items-center justify-between rounded-md border p-2">
                <span>{userName(d)} <span className="text-muted-foreground">{d}</span></span>
                {isOwner && <Button size="icon" variant="ghost" aria-label={`Quitar ${d}`} onClick={() => saveDelegates(delegates.filter((x) => x !== d))}><X className="h-4 w-4" /></Button>}
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
            ) : <p className="text-xs text-muted-foreground">Solo Chrisnel puede cambiar esta lista.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Historial</CardTitle></CardHeader>
          <CardContent>
            {audit.length === 0 ? <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p> : (
              <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                {audit.slice(0, 60).map((a) => (
                  <li key={a.id} className="border-b pb-2 last:border-0">
                    <p><span className="font-medium">{a.by}</span> · {ACCION_LABEL[a.accion] || a.accion}
                      {a.intranetId ? <span className="font-mono text-xs"> {String(a.intranetId)}</span> : null}
                      {a.oid ? ` ↔ factura #${String(a.oid)}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(a.at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
