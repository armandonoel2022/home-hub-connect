/**
 * Registro Mercantil de Clientes — Vista 360°.
 *
 * Clientes, servicios y contactos se LEEN de gSafeOne (SQL Server, solo
 * lectura). El Registro Mercantil se guarda en JSON local (backend
 * mercantile-registry.json, con respaldo en localStorage).
 */
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import ExportMenu from "@/components/ExportMenu";
import { useAuth } from "@/contexts/AuthContext";
import {
  generalSqlApi, isApiConfigured,
  type GeneralClient, type GeneralClientService, type GeneralClientContact,
  type MercantileStore, type MercantileRecord,
} from "@/lib/api";
import {
  calcularEstado, ESTADOS, loadStore, saveRegistro, desactivarRegistro,
  validarRegistro, parseCsv, importarMasivo, type EstadoRegistro, type BulkResult,
} from "@/lib/mercantileRegistry";
import BusinessPartnerDossier from "@/components/clients/BusinessPartnerDossier";
import { normalizeDossier, calcularProgreso, type PartnerDossier } from "@/lib/businessPartnerForms";
import {
  Building2, Search, Upload, Eye, RefreshCw, ChevronLeft, ChevronRight,
  FileSpreadsheet, Save, Ban, Phone, Mail, MapPin, User, Home,
} from "lucide-react";

const PAGE_SIZE = 50;

export default function MercantileRegistry() {
  const { user } = useAuth();
  const canEdit = useMemo(() => {
    if (!user) return false;
    if ((user as any).isAdmin) return true;
    return /servicio al cliente|comercial|administraci|gerencia|tecnolog|cuentas por cobrar/i.test(
      String((user as any).department || "")
    );
  }, [user]);

  const [clients, setClients] = useState<GeneralClient[]>([]);
  const [store, setStore] = useState<MercantileStore>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"todos" | EstadoRegistro>("todos");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<GeneralClient | null>(null);
  const [showBulk, setShowBulk] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [cs, st] = await Promise.all([
        isApiConfigured() ? generalSqlApi.clients() : Promise.resolve([] as GeneralClient[]),
        loadStore(),
      ]);
      setClients(cs);
      setStore(st);
      if (!isApiConfigured()) setError("Backend no configurado: los clientes se leen de gSafeOne desde el servidor local.");
    } catch (e: any) {
      setError(e?.message || "No se pudo leer la lista de clientes desde gSafeOne.");
      setStore(await loadStore());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .map((c) => {
        const rec = store[String(c.oid)] || null;
        return { cliente: c, rec, estado: calcularEstado(rec) };
      })
      .filter((r) => {
        if (q) {
          const hay = `${r.cliente.nombre} ${r.cliente.rnc || ""} ${r.cliente.cedula || ""} ${r.cliente.codigo || ""} ${r.rec?.registroMercantil || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (estadoFilter !== "todos" && r.estado.estado !== estadoFilter) return false;
        return true;
      });
  }, [clients, store, search, estadoFilter]);

  useEffect(() => { setPage(1); }, [search, estadoFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counters = useMemo(() => {
    const c: Record<string, number> = { Vigente: 0, "Próximo a vencer": 0, Vencido: 0, Pendiente: 0, Inactivo: 0 };
    clients.forEach((cl) => { c[calcularEstado(store[String(cl.oid)]).estado] += 1; });
    return c;
  }, [clients, store]);

  const exportData = rows.map((r) => ({
    cliente: r.cliente.nombre,
    codigo: r.cliente.codigo ?? "—",
    rnc: r.cliente.rnc || "—",
    cedula: r.cliente.cedula || "—",
    registro: r.rec?.registroMercantil || "—",
    camara: r.rec?.camaraComercio || "—",
    emision: r.rec?.emision || "—",
    vence: r.rec?.vence || "—",
    estado: r.estado.estado,
    expediente: `${calcularProgreso(normalizeDossier((r.rec as any)?.expediente)).porcentaje}%`,
  }));

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
          <nav className="text-xs text-muted-foreground flex items-center gap-1">
            <Home className="h-3 w-3" /> Inicio <span>/</span> Servicio al Cliente <span>/</span>
            <span className="text-foreground font-medium">Registro Mercantil</span>
          </nav>

          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><Building2 className="h-6 w-6" /></div>
              <div>
                <h1 className="font-heading text-2xl font-bold">Registro Mercantil — Vista 360°</h1>
                <p className="text-sm text-muted-foreground">
                  Clientes desde gSafeOne (solo lectura) + registro mercantil gestionado en la intranet
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualizar
              </Button>
              {canEdit && (
                <Button size="sm" onClick={() => setShowBulk(true)}>
                  <Upload className="h-4 w-4 mr-2" /> Cargar Masivo
                </Button>
              )}
              <ExportMenu
                title="Registro Mercantil de Clientes"
                subtitle={`${rows.length} clientes`}
                filename="registro-mercantil"
                columns={[
                  { header: "Cliente", key: "cliente", width: 34 },
                  { header: "Código", key: "codigo" },
                  { header: "RNC", key: "rnc" },
                  { header: "Cédula", key: "cedula" },
                  { header: "Registro", key: "registro" },
                  { header: "Cámara", key: "camara" },
                  { header: "Emisión", key: "emision" },
                  { header: "Vence", key: "vence" },
                  { header: "Estado", key: "estado" },
                  { header: "Expediente", key: "expediente" },
                ]}
                data={exportData}
              />
            </div>
          </header>

          {/* Contadores por estado */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {ESTADOS.map((e) => {
              const info = calcularEstado(e === "Vigente" ? { vence: "2999-01-01" } as MercantileRecord
                : e === "Vencido" ? { vence: "2000-01-01" } as MercantileRecord
                : e === "Inactivo" ? { activo: false } as MercantileRecord
                : e === "Próximo a vencer" ? { vence: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) } as MercantileRecord
                : null);
              const active = estadoFilter === e;
              return (
                <button
                  key={e}
                  onClick={() => setEstadoFilter(active ? "todos" : e)}
                  className={`rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 ${info.className} ${active ? "ring-2 ring-primary" : ""}`}
                >
                  <p className="text-2xl font-bold">{counters[e] ?? 0}</p>
                  <p className="text-[11px] font-medium">{e}</p>
                </button>
              );
            })}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar por nombre, RNC, cédula o registro..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v as any)}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
                <CardTitle className="text-sm text-muted-foreground font-normal">
                  {rows.length} cliente(s)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {error && <p className="text-sm text-destructive mb-3">{error}</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Cliente</th>
                      <th className="py-2 pr-3">Código</th>
                      <th className="py-2 pr-3">RNC</th>
                      <th className="py-2 pr-3">Cédula</th>
                      <th className="py-2 pr-3">Registro Mercantil</th>
                      <th className="py-2 pr-3">Vence</th>
                      <th className="py-2 pr-3">Expediente</th>
                      <th className="py-2 pr-3">Estado</th>
                      <th className="py-2 pr-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">Cargando clientes…</td></tr>
                    )}
                    {!loading && pageRows.length === 0 && (
                      <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">Sin clientes que coincidan.</td></tr>
                    )}
                    {pageRows.map((r, i) => (
                      <tr
                        key={r.cliente.oid}
                        className="border-b border-border/60 hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelected(r.cliente)}
                      >
                        <td className="py-2 pr-3 text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</td>
                        <td className="py-2 pr-3 font-medium">{r.cliente.nombre}</td>
                        <td className="py-2 pr-3">{r.cliente.codigo ?? "—"}</td>
                        <td className="py-2 pr-3">{r.cliente.rnc || "—"}</td>
                        <td className="py-2 pr-3">{r.cliente.cedula || "—"}</td>
                        <td className="py-2 pr-3">{r.rec?.registroMercantil || "—"}</td>
                        <td className="py-2 pr-3">{r.rec?.vence || "—"}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${calcularProgreso(normalizeDossier((r.rec as any)?.expediente)).porcentaje}%` }} />
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {calcularProgreso(normalizeDossier((r.rec as any)?.expediente)).porcentaje}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${r.estado.className}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${r.estado.dot}`} />
                            {r.estado.estado}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r.cliente); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 text-sm">
                  <span className="text-muted-foreground">
                    Mostrando {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, rows.length)} de {rows.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span>Página {page} de {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <Client360Dialog
        client={selected}
        record={selected ? store[String(selected.oid)] || null : null}
        canEdit={canEdit}
        onClose={() => setSelected(null)}
        onSaved={(id, rec) => setStore((s) => ({ ...s, [String(id)]: rec }))}
      />

      <BulkDialog
        open={showBulk}
        onClose={() => setShowBulk(false)}
        validIds={clients.map((c) => String(c.oid))}
        onDone={async () => setStore(await loadStore())}
      />
    </AppLayout>
  );
}

// ─── Vista 360° ───

function Client360Dialog({
  client, record, canEdit, onClose, onSaved,
}: {
  client: GeneralClient | null;
  record: MercantileRecord | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (clienteId: number, rec: MercantileRecord) => void;
}) {
  const [form, setForm] = useState<MercantileRecord>({ registroMercantil: "", camaraComercio: "", emision: "", vence: "", nota: "", activo: true });
  const [dossier, setDossier] = useState<PartnerDossier>(normalizeDossier(null));
  const [services, setServices] = useState<GeneralClientService[]>([]);
  const [contacts, setContacts] = useState<GeneralClientContact[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!client) return;
    setForm({
      registroMercantil: record?.registroMercantil || "",
      camaraComercio: record?.camaraComercio || "",
      emision: record?.emision || "",
      vence: record?.vence || "",
      nota: record?.nota || "",
      activo: record?.activo !== false,
    });
    setDossier(normalizeDossier((record as any)?.expediente));
    setServices([]); setContacts([]);
    if (isApiConfigured()) {
      generalSqlApi.clientServices(client.oid).then(setServices).catch(() => setServices([]));
      generalSqlApi.clientContacts(client.oid).then(setContacts).catch(() => setContacts([]));
    }
  }, [client, record]);

  if (!client) return null;
  const estado = calcularEstado(form);

  async function handleSave() {
    const err = validarRegistro(form);
    if (err) { toast({ title: "Datos inválidos", description: err, variant: "destructive" }); return; }
    setBusy(true);
    try {
      const saved = await saveRegistro(client!.oid, {
        ...form,
        expediente: { ...dossier, updatedAt: new Date().toISOString() },
      } as any);
      onSaved(client!.oid, saved);
      toast({ title: "Registro mercantil guardado", description: client!.nombre });
      onClose();
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: e?.message || "Error", variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function handleDeactivate() {
    const reason = window.prompt("Justificación para desactivar el registro:");
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      const saved = await desactivarRegistro(client!.oid, reason.trim());
      if (saved) { onSaved(client!.oid, saved); toast({ title: "Registro desactivado" }); onClose(); }
    } catch (e: any) {
      toast({ title: "No se pudo desactivar", description: e?.message || "Error", variant: "destructive" });
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={!!client} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> {client.nombre}
          </DialogTitle>
          <DialogDescription>
            Vista 360° · Código {client.codigo ?? "—"} · {client.inactivo ? "Cliente inactivo" : "Cliente activo"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* 1. Datos generales */}
          <section className="rounded-xl border border-border p-4">
            <h3 className="font-heading font-semibold text-sm mb-3">Datos generales (gSafeOne)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Field label="RNC" value={client.rnc} />
              <Field label="Cédula" value={client.cedula} />
              <Field label="Teléfono" value={client.telefono} icon={Phone} />
              <Field label="Email" value={client.email} icon={Mail} />
              <Field label="Contacto" value={client.contacto} icon={User} />
              <Field label="Dirección" value={client.direccion} icon={MapPin} />
            </div>
          </section>

          {/* 2. Registro mercantil */}
          <section className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-semibold text-sm">Registro Mercantil (intranet)</h3>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${estado.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${estado.dot}`} />
                {estado.estado}{estado.dias != null && estado.dias >= 0 ? ` · ${estado.dias} días` : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Registro Mercantil</Label>
                <Input value={form.registroMercantil} disabled={!canEdit}
                  onChange={(e) => setForm({ ...form, registroMercantil: e.target.value })} placeholder="RNM-2026-001" />
              </div>
              <div>
                <Label className="text-xs">Cámara de Comercio</Label>
                <Input value={form.camaraComercio} disabled={!canEdit}
                  onChange={(e) => setForm({ ...form, camaraComercio: e.target.value })} placeholder="Santo Domingo" />
              </div>
              <div>
                <Label className="text-xs">Emisión</Label>
                <Input type="date" value={form.emision} disabled={!canEdit}
                  onChange={(e) => setForm({ ...form, emision: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Vence</Label>
                <Input type="date" value={form.vence} disabled={!canEdit}
                  onChange={(e) => setForm({ ...form, vence: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Nota</Label>
                <Textarea rows={2} value={form.nota || ""} disabled={!canEdit}
                  onChange={(e) => setForm({ ...form, nota: e.target.value })} />
              </div>
            </div>
            {record?.updatedAt && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Última actualización: {new Date(record.updatedAt).toLocaleString("es-DO")}
                {record.updatedBy ? ` · ${record.updatedBy}` : ""}
              </p>
            )}
            {canEdit && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" onClick={handleSave} disabled={busy}>
                  <Save className="h-4 w-4 mr-2" /> Guardar
                </Button>
                <Button size="sm" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
                {record && record.activo !== false && (
                  <Button size="sm" variant="destructive" onClick={handleDeactivate} disabled={busy}>
                    <Ban className="h-4 w-4 mr-2" /> Desactivar registro
                  </Button>
                )}
              </div>
            )}
          </section>

          {/* 3. Expediente de Asociado de Negocio */}
          <BusinessPartnerDossier dossier={dossier} canEdit={canEdit} onChange={setDossier} clienteId={client.oid} />

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleSave} disabled={busy}>
                <Save className="h-4 w-4 mr-2" /> Guardar expediente
              </Button>
            </div>
          )}

          {/* 4. Servicios */}
          <section className="rounded-xl border border-border p-4">
            <h3 className="font-heading font-semibold text-sm mb-3">Servicios contratados</h3>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin servicios registrados en gSafeOne.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="py-1.5 pr-3">Descripción</th>
                      <th className="py-1.5 pr-3">Cant.</th>
                      <th className="py-1.5 pr-3">Precio</th>
                      <th className="py-1.5 pr-3">Inicio</th>
                      <th className="py-1.5 pr-3">Fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((s) => (
                      <tr key={s.oid} className="border-b border-border/60">
                        <td className="py-1.5 pr-3">{s.descripcion || "—"}</td>
                        <td className="py-1.5 pr-3">{s.cantidad ?? "—"}</td>
                        <td className="py-1.5 pr-3">
                          {s.precio != null ? s.precio.toLocaleString("es-DO", { style: "currency", currency: "DOP" }) : "—"}
                        </td>
                        <td className="py-1.5 pr-3">{s.fechaInicio ? new Date(s.fechaInicio).toLocaleDateString("es-DO") : "—"}</td>
                        <td className="py-1.5 pr-3">{s.fechaFin ? new Date(s.fechaFin).toLocaleDateString("es-DO") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 4. Contactos */}
          <section className="rounded-xl border border-border p-4">
            <h3 className="font-heading font-semibold text-sm mb-3">Contactos adicionales</h3>
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin contactos adicionales en gSafeOne.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {contacts.map((c) => (
                  <Badge key={c.oid} variant="secondary" className="text-xs">
                    {c.tipo}: {c.valor}
                  </Badge>
                ))}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: any }) {
  return (
    <div>
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {value || "—"}
      </p>
    </div>
  );
}

// ─── Carga masiva CSV ───

function BulkDialog({
  open, onClose, validIds, onDone,
}: { open: boolean; onClose: () => void; validIds: string[]; onDone: () => void }) {
  const [rows, setRows] = useState<ReturnType<typeof parseCsv>>([]);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => { setRows(parseCsv(String(reader.result || ""))); setResult(null); };
    reader.readAsText(file);
  }

  async function run() {
    setBusy(true);
    try {
      setResult(await importarMasivo(rows, validIds));
      onDone();
    } catch (e: any) {
      toast({ title: "Error en la carga", description: e?.message || "Error", variant: "destructive" });
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setRows([]); setResult(null); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carga masiva de Registro Mercantil</DialogTitle>
          <DialogDescription>
            CSV con encabezado: ClienteID,RegistroMercantil,CamaraComercio,Emision,Vence
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${drag ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Arrastra el archivo CSV aquí o selecciónalo</p>
          <Input type="file" accept=".csv,text/csv" className="max-w-xs mx-auto"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>

        {rows.length > 0 && !result && (
          <div className="space-y-3">
            <p className="text-sm">{rows.length} fila(s) detectada(s). Vista previa:</p>
            <div className="max-h-52 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted"><tr>
                  <th className="p-2 text-left">ClienteID</th><th className="p-2 text-left">Registro</th>
                  <th className="p-2 text-left">Cámara</th><th className="p-2 text-left">Emisión</th><th className="p-2 text-left">Vence</th>
                </tr></thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="p-2">{r.clienteId}</td><td className="p-2">{r.registroMercantil}</td>
                      <td className="p-2">{r.camaraComercio}</td><td className="p-2">{r.emision}</td><td className="p-2">{r.vence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button onClick={run} disabled={busy}>
              <Upload className="h-4 w-4 mr-2" /> Procesar {rows.length} registro(s)
            </Button>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex gap-3 text-sm">
              <Badge variant="secondary">Total: {result.total}</Badge>
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Éxitos: {result.exitos}</Badge>
              <Badge variant="destructive">Errores: {result.errores}</Badge>
            </div>
            {result.errores > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2 text-xs space-y-1">
                {result.detalle.filter((d) => !d.ok).map((d, i) => (
                  <p key={i} className="text-destructive">Fila {d.fila} (ID {d.clienteId || "—"}): {d.error}</p>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={() => { setRows([]); setResult(null); onClose(); }}>Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
