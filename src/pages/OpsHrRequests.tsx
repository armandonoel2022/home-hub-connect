import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useArmedPersonnel } from "@/hooks/useApiHooks";
import { getClients, getLocationsByClient, getPostsByLocation } from "@/lib/opsExpediente";
import {
  TIPOS, VACANTES, PRIORIDADES, MOTIVOS, ESTADOS, CLOSED, SLA_HORAS, ESTADO_STYLE,
  opsRolesFor, rrhhTeam, semaforo, listRequests, createRequest, updateRequest, listTemplates, saveTemplates, getRrhhRecipients, saveRrhhRecipients,
  type OpsHrRequest, type OpsEstado, type OpsTemplate, type OpsReqTipo, type OpsVacante, type OpsPrioridad,
} from "@/lib/opsHrRequests";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { isApiConfigured, opsHrRequestsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, LayoutDashboard, ListChecks, FolderOpen, Users, FileSpreadsheet, FileText, Copy, Send, Save, Mail, Paperclip, CheckCircle2, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, CartesianGrid } from "recharts";

type View = "dashboard" | "nueva" | "mias" | "todas" | "plantillas" | "destinatarios";
const ALL = "__all";
const SEM: Record<string, string> = { verde: "bg-green-500", amarillo: "bg-amber-400", rojo: "bg-destructive", gris: "bg-muted-foreground/40" };
const CHART = ["hsl(var(--primary))", "hsl(var(--accent-foreground))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];
const hrs = (ms: number) => (ms / 3600e3).toFixed(1);
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" }) : "—");

const emptyForm = () => ({
  tipo: "Ingreso" as OpsReqTipo, tipoVacante: "Fijo" as OpsVacante, prioridad: "Normal" as OpsPrioridad,
  clienteId: "", localidadId: "", puestoId: "", turnoId: "",
  agenteSalienteId: "", agentePropuestoId: "", motivoBaja: "", motivoComentario: "",
  fechaEfectiva: new Date().toISOString().slice(0, 10), requiereCoberturaUrgente: false, notas: "",
  adjuntos: [] as OpsHrRequest["adjuntos"],
});

export default function OpsHrRequests() {
  const { user, allUsers } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();
  const { data: personnel = [] } = useArmedPersonnel() as any;
  const roles = useMemo(() => opsRolesFor(user, allUsers), [user, allUsers]);
  const canSeeAll = roles.has("admin") || roles.has("rrhh") || roles.has("coordinador");
  const canManage = roles.has("admin") || roles.has("rrhh");

  const [view, setView] = useState<View>("dashboard");
  const [items, setItems] = useState<OpsHrRequest[]>([]);
  const [templates, setTemplates] = useState<OpsTemplate[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [detailId, setDetailId] = useState<string | null>(params.get("id"));
  const [f, setF] = useState({ cliente: ALL, localidad: ALL, turno: ALL, vacante: ALL, prioridad: ALL, estado: ALL, creador: ALL, desde: "", hasta: "" });

  const reload = async () => { try { setItems(await listRequests()); } catch (e: any) { toast({ title: "No se pudieron cargar las solicitudes", description: e.message, variant: "destructive" }); } };
  useEffect(() => { reload(); listTemplates().then(setTemplates).catch(() => {}); const t = setInterval(reload, 30000); return () => clearInterval(t); }, []);

  // ─── Cascada ───
  const clients = useMemo(() => getClients().sort((a, b) => a.nombre.localeCompare(b.nombre)), []);
  const locations = useMemo(() => (form.clienteId ? getLocationsByClient(form.clienteId) : []), [form.clienteId]);
  const posts = useMemo(() => (form.localidadId ? getPostsByLocation(form.localidadId) : []), [form.localidadId]);
  const post = posts.find(p => p.id === form.puestoId);
  const client = clients.find(c => c.id === form.clienteId);
  const loc = locations.find(l => l.id === form.localidadId);
  const turno = post?.turnos.find(t => t.id === form.turnoId);
  const agents = useMemo(() => {
    if (!client) return [];
    const cn = client.nombre.toLowerCase();
    return (personnel as any[]).filter(p => p.status === "Activo" && String(p.client || "").toLowerCase() === cn &&
      (!post || [post.nombre, loc?.nombre].some(n => n && String(p.location || "").toLowerCase().includes(n.toLowerCase()))));
  }, [personnel, client, post, loc]);
  const supervisorName = agents.find(a => a.supervisor)?.supervisor || "";
  const supervisorUser = allUsers.find(u => supervisorName && u.fullName.toLowerCase() === supervisorName.toLowerCase());
  const needsOut = form.tipo !== "Ingreso";

  const submit = async (estado: OpsEstado) => {
    if (!user) return;
    if (!client || !loc || !post || !turno) return toast({ title: "Complete Cliente → Localidad → Puesto → Turno", variant: "destructive" });
    if (needsOut && (!form.agenteSalienteId || !form.motivoBaja || !form.fechaEfectiva)) return toast({ title: "Agente saliente, motivo y fecha efectiva son obligatorios", variant: "destructive" });
    if (form.motivoBaja === "Otro" && !form.motivoComentario.trim()) return toast({ title: "Explique el motivo 'Otro'", variant: "destructive" });
    const out = agents.find(a => a.id === form.agenteSalienteId);
    const prop = (personnel as any[]).find(a => a.id === form.agentePropuestoId);
    const rrhh = rrhhTeam(allUsers)[0];
    const r = await createRequest({
      ...form, estado,
      clienteNombre: client.nombre, localidadNombre: loc.nombre, puestoNombre: post.nombre, turnoNombre: `${turno.nombre}${turno.horario ? ` (${turno.horario})` : ""}`,
      supervisorResponsable: supervisorName, supervisorEmail: supervisorUser?.email,
      agenteSalienteNombre: out?.name, agentePropuestoNombre: prop?.name,
      rrhhAsignado: rrhh?.fullName, rrhhAsignadoEmail: rrhh?.email,
      responsableActual: estado === "Borrador" ? user.fullName : rrhh?.fullName || "RRHH",
      creadoPor: user.fullName, creadoPorId: user.id, creadoPorEmail: user.email,
    } as any);
    toast({ title: `Solicitud ${r.id} ${estado === "Borrador" ? "guardada como borrador" : "enviada a RRHH"}`, description: r._mail && !r._mail.sent ? `Correo no enviado: ${r._mail.reason}` : undefined });
    setForm(emptyForm()); await reload(); setView("mias");
  };

  const duplicate = (r: OpsHrRequest) => {
    setForm({ ...emptyForm(), tipo: r.tipo, tipoVacante: r.tipoVacante, prioridad: r.prioridad, clienteId: r.clienteId, localidadId: r.localidadId, puestoId: r.puestoId, turnoId: "", motivoBaja: r.motivoBaja || "", requiereCoberturaUrgente: r.requiereCoberturaUrgente });
    setDetailId(null); setView("nueva");
    toast({ title: "Solicitud duplicada", description: "Seleccione un turno distinto y envíe." });
  };

  // ─── Filtros ───
  const scoped = useMemo(() => items.filter(r => canSeeAll || r.creadoPorId === user?.id), [items, canSeeAll, user]);
  const filtered = useMemo(() => scoped.filter(r =>
    (f.cliente === ALL || r.clienteNombre === f.cliente) && (f.localidad === ALL || r.localidadNombre === f.localidad) &&
    (f.turno === ALL || r.turnoNombre === f.turno) && (f.vacante === ALL || r.tipoVacante === f.vacante) &&
    (f.prioridad === ALL || r.prioridad === f.prioridad) && (f.estado === ALL || r.estado === f.estado) &&
    (f.creador === ALL || r.creadoPor === f.creador) &&
    (!f.desde || r.fechaCreacion.slice(0, 10) >= f.desde) && (!f.hasta || r.fechaCreacion.slice(0, 10) <= f.hasta)
  ), [scoped, f]);
  const uniq = (k: keyof OpsHrRequest) => [...new Set(scoped.map(r => String(r[k] || "")).filter(Boolean))].sort();

  const kpi = useMemo(() => {
    const sent = filtered.filter(r => r.estado !== "Borrador");
    const open = sent.filter(r => !CLOSED.includes(r.estado));
    const resp = sent.filter(r => r.primerMovimientoRRHH && r.fechaEnvio).map(r => +new Date(r.primerMovimientoRRHH!) - +new Date(r.fechaEnvio!));
    const closed = sent.filter(r => r.fechaCierre && r.fechaEnvio);
    const close = closed.map(r => +new Date(r.fechaCierre!) - +new Date(r.fechaEnvio!));
    const inSla = closed.filter(r => r.fechaLimiteSLA && r.fechaCierre! <= r.fechaLimiteSLA).length;
    const avg = (a: number[]) => (a.length ? hrs(a.reduce((s, x) => s + x, 0) / a.length) : "—");
    const count = (fn: (r: OpsHrRequest) => string | undefined, list = sent) => Object.entries(list.reduce((m, r) => { const k = fn(r); if (k) m[k] = (m[k] || 0) + 1; return m; }, {} as Record<string, number>)).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const months: Record<string, any> = {};
    sent.forEach(r => { const m = r.fechaCreacion.slice(0, 7); months[m] = months[m] || { mes: m, Ingreso: 0, Salida: 0, Sustitución: 0 }; months[m][r.tipo]++; });
    return {
      open: open.length, byState: count(r => (CLOSED.includes(r.estado) ? undefined : r.estado)),
      covered: sent.filter(r => r.estado === "Cubierta satisfactoriamente").length,
      uncovered: sent.filter(r => r.estado === "Cerrada sin cobertura").length,
      resp: avg(resp), close: avg(close), sla: closed.length ? Math.round((inSla / closed.length) * 100) + "%" : "—",
      rotation: count(r => (r.tipo === "Ingreso" ? undefined : `${r.clienteNombre} · ${r.puestoNombre}`)).slice(0, 8),
      motivos: count(r => r.motivoBaja).slice(0, 8),
      vacantes: count(r => r.tipoVacante),
      monthly: Object.values(months).sort((a: any, b: any) => a.mes.localeCompare(b.mes)),
    };
  }, [filtered]);

  const cols = [
    { header: "ID", key: "id" }, { header: "Estado", key: "estado" }, { header: "Tipo", key: "tipo" }, { header: "Vacante", key: "tipoVacante" },
    { header: "Cliente", key: "clienteNombre" }, { header: "Localidad", key: "localidadNombre" }, { header: "Puesto", key: "puestoNombre" }, { header: "Turno", key: "turnoNombre" },
    { header: "Prioridad", key: "prioridad" }, { header: "Creado por", key: "creadoPor" }, { header: "Creación", key: "fecha" }, { header: "Límite SLA", key: "sla" },
  ];
  const exportData = (list: OpsHrRequest[]) => list.map(r => ({ ...r, fecha: fmt(r.fechaCreacion), sla: fmt(r.fechaLimiteSLA) })) as any;

  const detail = items.find(r => r.id === detailId) || null;
  const nav: { k: View; label: string; icon: any; show: boolean }[] = [
    { k: "dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { k: "nueva", label: "Nueva solicitud", icon: Plus, show: true },
    { k: "mias", label: "Mis solicitudes", icon: ListChecks, show: true },
    { k: "todas", label: "Todas las solicitudes", icon: Users, show: canSeeAll },
    { k: "plantillas", label: "Plantillas", icon: FolderOpen, show: true },
    { k: "destinatarios", label: "Destinatarios RRHH", icon: Mail, show: true },
  ];

  const List = ({ list }: { list: OpsHrRequest[] }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{list.length} solicitud(es)</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportToExcel({ title: "Solicitudes Operaciones → RRHH", columns: cols, data: exportData(list), filename: "solicitudes-operaciones" })}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          <Button size="sm" variant="outline" onClick={() => exportToPDF({ title: "Solicitudes Operaciones → RRHH", columns: cols, data: exportData(list), filename: "solicitudes-operaciones" })}><FileText className="h-4 w-4 mr-1" />PDF</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="p-2">SLA</th><th className="p-2">ID</th><th className="p-2">Estado</th><th className="p-2">Tipo</th><th className="p-2">Cliente / Puesto</th><th className="p-2 hidden md:table-cell">Turno</th><th className="p-2">Prioridad</th><th className="p-2 hidden lg:table-cell">Creado</th></tr>
          </thead>
          <tbody>
            {list.map(r => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/40 cursor-pointer" onClick={() => setDetailId(r.id)}>
                <td className="p-2"><span className={`inline-block h-3 w-3 rounded-full ${SEM[semaforo(r)]}`} /></td>
                <td className="p-2 font-mono text-xs">{r.id}{r.requiereCoberturaUrgente && <AlertTriangle className="inline h-3 w-3 ml-1 text-destructive" />}</td>
                <td className="p-2"><span className={`px-2 py-0.5 rounded text-xs font-medium ${ESTADO_STYLE[r.estado]}`}>{r.estado}</span></td>
                <td className="p-2">{r.tipo}<div className="text-xs text-muted-foreground">{r.tipoVacante}</div></td>
                <td className="p-2">{r.clienteNombre}<div className="text-xs text-muted-foreground">{r.localidadNombre} · {r.puestoNombre}</div></td>
                <td className="p-2 hidden md:table-cell text-xs">{r.turnoNombre}</td>
                <td className="p-2"><Badge variant={r.prioridad === "Crítica" ? "destructive" : "outline"}>{r.prioridad}</Badge></td>
                <td className="p-2 hidden lg:table-cell text-xs">{fmt(r.fechaCreacion)}<div className="text-muted-foreground">{r.creadoPor}</div></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sin solicitudes</td></tr>}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );

  const FSel = ({ k, label, opts }: { k: keyof typeof f; label: string; opts: string[] }) => (
    <Select value={f[k]} onValueChange={v => setF({ ...f, [k]: v })}>
      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent><SelectItem value={ALL}>{label}: todos</SelectItem>{opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );
  const Filters = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
      <FSel k="cliente" label="Cliente" opts={uniq("clienteNombre")} />
      <FSel k="localidad" label="Localidad" opts={uniq("localidadNombre")} />
      <FSel k="turno" label="Turno" opts={uniq("turnoNombre")} />
      <FSel k="vacante" label="Vacante" opts={VACANTES} />
      <FSel k="prioridad" label="Prioridad" opts={PRIORIDADES} />
      <FSel k="estado" label="Estado" opts={ESTADOS} />
      <FSel k="creador" label="Creador" opts={uniq("creadoPor")} />
      <Input type="date" className="h-8 text-xs" value={f.desde} onChange={e => setF({ ...f, desde: e.target.value })} />
      <Input type="date" className="h-8 text-xs" value={f.hasta} onChange={e => setF({ ...f, hasta: e.target.value })} />
    </div>
  );

  const Kpi = ({ label, value, tone = "" }: { label: string; value: any; tone?: string }) => (
    <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`text-2xl font-bold ${tone}`}>{value}</div></CardContent></Card>
  );

  return (
    <AppLayout>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/rrhh/formularios")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <h1 className="text-2xl font-heading font-bold">Solicitudes a RRHH — Operaciones</h1>
            <p className="text-sm text-muted-foreground">Ingresos, salidas y sustituciones de personal por cliente, puesto y turno.</p>
          </div>
          {canManage && isApiConfigured() && (
            <Button size="sm" variant="outline" onClick={async () => { const r = await opsHrRequestsApi.syncMail(); toast({ title: r.ok ? `Correo revisado (${r.added} respuesta(s))` : "Error de correo", description: r.message }); reload(); }}><Mail className="h-4 w-4 mr-1" />Revisar respuestas</Button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <nav className="md:w-52 flex md:flex-col gap-1 overflow-x-auto shrink-0">
            {nav.filter(n => n.show).map(n => (
              <Button key={n.k} variant={view === n.k ? "default" : "ghost"} className="justify-start whitespace-nowrap" onClick={() => setView(n.k)}><n.icon className="h-4 w-4 mr-2" />{n.label}</Button>
            ))}
          </nav>

          <div className="flex-1 min-w-0 space-y-4">
            {view === "dashboard" && (<>
              <Filters />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Total abiertas" value={kpi.open} />
                <Kpi label="Cubiertas satisfactoriamente" value={kpi.covered} tone="text-green-600" />
                <Kpi label="Cerradas sin cobertura" value={kpi.uncovered} tone="text-amber-600" />
                <Kpi label="% Cumplimiento SLA" value={kpi.sla} />
                <Kpi label="Prom. respuesta RRHH (h)" value={kpi.resp} />
                <Kpi label="Prom. cierre (h)" value={kpi.close} />
                <Card className="col-span-2"><CardContent className="p-4"><div className="text-xs text-muted-foreground mb-2">Pendientes por estado</div>
                  <div className="flex flex-wrap gap-2">{kpi.byState.map(s => <span key={s.name} className={`px-2 py-1 rounded text-xs ${ESTADO_STYLE[s.name as OpsEstado]}`}>{s.name}: <b>{s.value}</b></span>)}{!kpi.byState.length && <span className="text-sm text-muted-foreground">Nada pendiente</span>}</div>
                </CardContent></Card>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <Card><CardHeader><CardTitle className="text-sm">Clientes/puestos con más rotación</CardTitle></CardHeader><CardContent className="h-64">
                  <ResponsiveContainer><BarChart data={kpi.rotation} layout="vertical"><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" fill={CHART[0]} /></BarChart></ResponsiveContainer>
                </CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">Motivos de baja más frecuentes</CardTitle></CardHeader><CardContent className="h-64">
                  <ResponsiveContainer><BarChart data={kpi.motivos}><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill={CHART[2]} /></BarChart></ResponsiveContainer>
                </CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">Evolución mensual por tipo</CardTitle></CardHeader><CardContent className="h-64">
                  <ResponsiveContainer><LineChart data={kpi.monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" /><YAxis allowDecimals={false} /><Tooltip /><Legend />{TIPOS.map((t, i) => <Line key={t} dataKey={t} stroke={CHART[i]} />)}</LineChart></ResponsiveContainer>
                </CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">Distribución por tipo de vacante</CardTitle></CardHeader><CardContent className="h-64">
                  <ResponsiveContainer><PieChart><Pie data={kpi.vacantes} dataKey="value" nameKey="name" outerRadius={80} label>{kpi.vacantes.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
                </CardContent></Card>
              </div>
              <div className="flex justify-end"><Button onClick={() => setView("nueva")}><Plus className="h-4 w-4 mr-1" />Nueva solicitud</Button></div>
              <List list={filtered} />
            </>)}

            {view === "mias" && <List list={items.filter(r => r.creadoPorId === user?.id)} />}
            {view === "todas" && canSeeAll && (<><Filters /><List list={filtered} /></>)}

            {view === "nueva" && (
              <Card><CardHeader><CardTitle className="text-base">Nueva solicitud de personal</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {templates.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center"><span className="text-xs text-muted-foreground">Plantillas:</span>
                      {templates.map(t => <Button key={t.id} size="sm" variant="outline" onClick={() => setForm({ ...form, tipo: t.tipo, tipoVacante: t.tipoVacante, prioridad: t.prioridad, motivoBaja: t.motivoBaja || "", notas: t.notas || "" })}>{t.nombre}</Button>)}
                    </div>
                  )}
                  {!clients.length && <p className="text-sm text-amber-600">No hay clientes cargados en Expediente de Clientes. Ábralo una vez para sincronizarlos.</p>}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div><Label>Cliente</Label><Select value={form.clienteId} onValueChange={v => setForm({ ...form, clienteId: v, localidadId: "", puestoId: "", turnoId: "", agenteSalienteId: "" })}><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger><SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Localidad</Label><Select disabled={!form.clienteId} value={form.localidadId} onValueChange={v => setForm({ ...form, localidadId: v, puestoId: "", turnoId: "" })}><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger><SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Puesto</Label><Select disabled={!form.localidadId} value={form.puestoId} onValueChange={v => { const p = posts.find(x => x.id === v); setForm({ ...form, puestoId: v, turnoId: p?.turnos.length === 1 ? p.turnos[0].id : "" }); }}><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger><SelectContent>{posts.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Turno</Label><Select disabled={!post} value={form.turnoId} onValueChange={v => setForm({ ...form, turnoId: v })}><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger><SelectContent>{post?.turnos.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre} {t.horario}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  {client && (
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm grid sm:grid-cols-2 gap-2">
                      <div><span className="text-muted-foreground">Supervisor responsable:</span> <b>{supervisorName || "No identificado"}</b></div>
                      <div><span className="text-muted-foreground">Cobertura actual:</span> <b>{agents.length}</b> agente(s) activos asignados · requeridos por turno: <b>{post?.turnos.length ? 1 : "—"}</b></div>
                      {agents.length > 0 && <div className="sm:col-span-2 text-xs text-muted-foreground">{agents.map(a => a.name).join(" · ")}</div>}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div><Label>Tipo</Label><Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as OpsReqTipo })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Tipo de vacante</Label><Select value={form.tipoVacante} onValueChange={v => setForm({ ...form, tipoVacante: v as OpsVacante })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{VACANTES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Prioridad (SLA {SLA_HORAS[form.prioridad]}h)</Label><Select value={form.prioridad} onValueChange={v => setForm({ ...form, prioridad: v as OpsPrioridad })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORIDADES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  {needsOut && (
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div><Label>Agente saliente *</Label><Select value={form.agenteSalienteId} onValueChange={v => setForm({ ...form, agenteSalienteId: v })}><SelectTrigger><SelectValue placeholder={agents.length ? "Seleccione" : "Sin agentes en este puesto"} /></SelectTrigger><SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.employeeCode})</SelectItem>)}</SelectContent></Select></div>
                      <div><Label>Motivo *</Label><Select value={form.motivoBaja} onValueChange={v => setForm({ ...form, motivoBaja: v })}><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger><SelectContent>{MOTIVOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                      <div><Label>Fecha efectiva *</Label><Input type="date" value={form.fechaEfectiva} onChange={e => setForm({ ...form, fechaEfectiva: e.target.value })} /></div>
                      {form.motivoBaja === "Otro" && <div className="sm:col-span-3"><Label>Comentario del motivo *</Label><Textarea value={form.motivoComentario} onChange={e => setForm({ ...form, motivoComentario: e.target.value })} /></div>}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div><Label>Agente propuesto (opcional)</Label><Select value={form.agentePropuestoId || "none"} onValueChange={v => setForm({ ...form, agentePropuestoId: v === "none" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ninguno</SelectItem>{(personnel as any[]).filter(p => p.status === "Activo").slice(0, 500).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                    {!needsOut && <div><Label>Fecha efectiva</Label><Input type="date" value={form.fechaEfectiva} onChange={e => setForm({ ...form, fechaEfectiva: e.target.value })} /></div>}
                  </div>
                  <div className="flex items-center gap-2"><Switch checked={form.requiereCoberturaUrgente} onCheckedChange={v => setForm({ ...form, requiereCoberturaUrgente: v })} /><Label>Requiere cobertura urgente (correo de alta prioridad)</Label></div>
                  <div><Label>Notas</Label><Textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} /></div>
                  <div><Label className="flex items-center gap-1"><Paperclip className="h-4 w-4" />Evidencia (recomendado, máx. 5 MB c/u)</Label>
                    <Input type="file" multiple onChange={async e => {
                      const files = Array.from(e.target.files || []).filter(x => x.size <= 5e6);
                      const read = await Promise.all(files.map(file => new Promise<any>(res => { const fr = new FileReader(); fr.onload = () => res({ name: file.name, dataUrl: fr.result, uploadedAt: new Date().toISOString(), by: user?.fullName }); fr.readAsDataURL(file); })));
                      setForm({ ...form, adjuntos: [...form.adjuntos, ...read] });
                    }} />
                    {form.adjuntos.length > 0 && <div className="text-xs text-muted-foreground mt-1">{form.adjuntos.map(a => a.name).join(", ")}</div>}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button variant="outline" onClick={() => submit("Borrador")}><Save className="h-4 w-4 mr-1" />Guardar borrador</Button>
                    <Button onClick={() => submit("Enviada a RRHH")}><Send className="h-4 w-4 mr-1" />Enviar a RRHH</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {view === "destinatarios" && <RecipientsView canEdit={canManage} userName={user?.fullName || ""} />}
            {view === "plantillas" && <TemplatesView templates={templates} canEdit={roles.has("admin") || roles.has("coordinador") || roles.has("rrhh")} onSave={async l => { await saveTemplates(l); setTemplates(l); toast({ title: "Plantillas guardadas" }); }} />}
          </div>
        </div>
      </div>

      {detail && <DetailDialog r={detail} canManage={canManage} isOwner={detail.creadoPorId === user?.id} userName={user?.fullName || ""} userEmail={user?.email}
        onClose={() => { setDetailId(null); if (params.get("id")) setParams({}); }} onDuplicate={() => duplicate(detail)}
        onUpdate={async (patch) => { const n = await updateRequest(detail.id, patch); setItems(items.map(x => (x.id === n.id ? n : x))); if (n._mail && !n._mail.sent) toast({ title: "Correo no enviado", description: n._mail.reason, variant: "destructive" }); }} />}
    </AppLayout>
  );
}

function DetailDialog({ r, canManage, isOwner, userName, userEmail, onClose, onUpdate, onDuplicate }: {
  r: OpsHrRequest; canManage: boolean; isOwner: boolean; userName: string; userEmail?: string;
  onClose: () => void; onUpdate: (p: any) => Promise<void>; onDuplicate: () => void;
}) {
  const [next, setNext] = useState<OpsEstado | "">("");
  const [nota, setNota] = useState("");
  const [msg, setMsg] = useState("");
  const allowed: OpsEstado[] = canManage
    ? ESTADOS.filter(e => e !== "Borrador" && e !== r.estado && e !== "Cancelada por Operaciones")
    : isOwner ? (r.estado === "Borrador" ? ["Enviada a RRHH", "Cancelada por Operaciones"] : CLOSED.includes(r.estado) ? [] : ["Cancelada por Operaciones"]) : [];
  const needNote = next === "Cerrada sin cobertura" || next === "Cancelada por Operaciones" || next === "Cubierta satisfactoriamente";
  const apply = async () => {
    if (!next) return;
    if (needNote && !nota.trim()) return;
    await onUpdate({ estado: next, responsableActual: CLOSED.includes(next) ? "—" : next === "Enviada a RRHH" ? r.rrhhAsignado : userName, cierreComentario: needNote ? nota : r.cierreComentario, _usuario: userName, _nota: nota });
    setNext(""); setNota("");
  };
  const stepIdx = ESTADOS.indexOf(r.estado);
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2">
          <span className={`inline-block h-3 w-3 rounded-full ${SEM[semaforo(r)]}`} />{r.id}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${ESTADO_STYLE[r.estado]}`}>{r.estado}</span>
        </DialogTitle></DialogHeader>
        <Tabs defaultValue="resumen">
          <TabsList className="flex-wrap h-auto"><TabsTrigger value="resumen">Resumen</TabsTrigger><TabsTrigger value="timeline">Timeline</TabsTrigger><TabsTrigger value="comentarios">Comentarios ({r.comentarios?.length || 0})</TabsTrigger><TabsTrigger value="adjuntos">Adjuntos ({r.adjuntos?.length || 0})</TabsTrigger><TabsTrigger value="historial">Historial</TabsTrigger></TabsList>
          <TabsContent value="resumen" className="space-y-2 text-sm">
            {r.requiereCoberturaUrgente && <div className="rounded bg-destructive/10 text-destructive p-2 font-medium">Requiere cobertura urgente</div>}
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
              {[["Tipo", `${r.tipo} · ${r.tipoVacante}`], ["Prioridad", `${r.prioridad} (${r.slaHoras}h)`], ["Cliente", r.clienteNombre], ["Localidad", r.localidadNombre], ["Puesto", r.puestoNombre], ["Turno", r.turnoNombre],
                ["Supervisor", r.supervisorResponsable], ["Agente saliente", r.agenteSalienteNombre], ["Motivo", [r.motivoBaja, r.motivoComentario].filter(Boolean).join(" — ")], ["Agente propuesto", r.agentePropuestoNombre],
                ["Fecha efectiva", r.fechaEfectiva], ["Límite SLA", fmt(r.fechaLimiteSLA)], ["Responsable actual", r.responsableActual], ["RRHH asignado", r.rrhhAsignado], ["Creado por", `${r.creadoPor} · ${fmt(r.fechaCreacion)}`], ["Cierre", r.fechaCierre ? `${fmt(r.fechaCierre)} — ${r.cierreComentario || ""}` : ""]]
                .filter(([, v]) => v).map(([k, v]) => <div key={k}><span className="text-muted-foreground">{k}:</span> {v}</div>)}
            </div>
            {(r as any).notas && <p className="rounded bg-muted/40 p-2">{(r as any).notas}</p>}
          </TabsContent>
          <TabsContent value="timeline">
            <ol className="space-y-2">
              {(ESTADOS.filter(e => e !== "Borrador").slice(0, 5) as OpsEstado[]).concat(CLOSED.includes(r.estado) ? [r.estado] : ["Cubierta satisfactoriamente"]).map((e, i) => {
                const h = r.historialEstados?.find(x => x.nuevo === e);
                const done = !!h || ESTADOS.indexOf(e) <= stepIdx;
                return <li key={e + i} className="flex items-center gap-3"><CheckCircle2 className={`h-5 w-5 ${done ? "text-primary" : "text-muted-foreground/40"}`} /><div className={done ? "" : "text-muted-foreground"}><div className="font-medium text-sm">{e}</div>{h && <div className="text-xs text-muted-foreground">{fmt(h.fecha)} · {h.usuario}</div>}</div></li>;
              })}
            </ol>
          </TabsContent>
          <TabsContent value="comentarios" className="space-y-3">
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {(r.comentarios || []).map(c => (
                <div key={c.id} className={`rounded-lg p-2 text-sm max-w-[85%] ${c.autor === userName ? "ml-auto bg-primary/10" : "bg-muted"}`}>
                  <div className="text-xs text-muted-foreground">{c.autor} · {fmt(c.fecha)}{c.origen === "correo" && " · por correo"}</div>
                  <div className="whitespace-pre-wrap">{c.texto}</div>
                </div>
              ))}
              {!r.comentarios?.length && <p className="text-sm text-muted-foreground">Sin comentarios.</p>}
            </div>
            <div className="flex gap-2"><Input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Escribir comentario…" onKeyDown={e => e.key === "Enter" && msg.trim() && (onUpdate({ comentarios: [...(r.comentarios || []), { id: `CMT-${Date.now()}`, autor: userName, autorEmail: userEmail, texto: msg.trim(), fecha: new Date().toISOString(), origen: "intranet" }], _event: "comment" }), setMsg(""))} />
              <Button disabled={!msg.trim()} onClick={() => { onUpdate({ comentarios: [...(r.comentarios || []), { id: `CMT-${Date.now()}`, autor: userName, autorEmail: userEmail, texto: msg.trim(), fecha: new Date().toISOString(), origen: "intranet" }], _event: "comment" }); setMsg(""); }}><Send className="h-4 w-4" /></Button></div>
          </TabsContent>
          <TabsContent value="adjuntos" className="space-y-1">
            {(r.adjuntos || []).map((a, i) => <a key={i} href={a.dataUrl} download={a.name} className="block text-sm text-primary underline">{a.name}</a>)}
            {!r.adjuntos?.length && <p className="text-sm text-muted-foreground">Sin adjuntos.</p>}
          </TabsContent>
          <TabsContent value="historial">
            <table className="w-full text-xs"><thead className="text-muted-foreground text-left"><tr><th className="p-1">Fecha</th><th className="p-1">Usuario</th><th className="p-1">Anterior</th><th className="p-1">Nuevo</th><th className="p-1">Nota</th></tr></thead>
              <tbody>{(r.historialEstados || []).map((h, i) => <tr key={i} className="border-t border-border"><td className="p-1">{fmt(h.fecha)}</td><td className="p-1">{h.usuario}</td><td className="p-1">{h.anterior || "—"}</td><td className="p-1">{h.nuevo}</td><td className="p-1">{h.nota}</td></tr>)}</tbody></table>
          </TabsContent>
        </Tabs>
        {allowed.length > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            <Label>Cambiar estado</Label>
            <Select value={next} onValueChange={v => setNext(v as OpsEstado)}><SelectTrigger><SelectValue placeholder="Seleccione nuevo estado" /></SelectTrigger><SelectContent>{allowed.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select>
            {next && <Textarea placeholder={needNote ? "Comentario obligatorio" : "Nota (opcional)"} value={nota} onChange={e => setNota(e.target.value)} />}
            {next === "Cerrada sin cobertura" && <p className="text-xs text-amber-600">Confirmación: se cerrará la solicitud sin haber cubierto la vacante.</p>}
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onDuplicate}><Copy className="h-4 w-4 mr-1" />Duplicar (otro turno)</Button>
          {allowed.length > 0 && <Button disabled={!next || (needNote && !nota.trim())} onClick={apply}>Aplicar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplatesView({ templates, canEdit, onSave }: { templates: OpsTemplate[]; canEdit: boolean; onSave: (l: OpsTemplate[]) => void }) {
  const [t, setT] = useState<OpsTemplate>({ id: "", nombre: "", tipo: "Sustitución", tipoVacante: "Fijo", prioridad: "Normal", motivoBaja: "", notas: "" });
  return (
    <Card><CardHeader><CardTitle className="text-base">Plantillas por tipo de solicitud</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {templates.map(x => (
          <div key={x.id} className="flex items-center justify-between border border-border rounded p-2 text-sm">
            <div><b>{x.nombre}</b> <span className="text-muted-foreground">· {x.tipo} · {x.tipoVacante} · {x.prioridad}{x.motivoBaja ? ` · ${x.motivoBaja}` : ""}</span></div>
            {canEdit && <Button size="sm" variant="ghost" onClick={() => onSave(templates.filter(y => y.id !== x.id))}>Eliminar</Button>}
          </div>
        ))}
        {!templates.length && <p className="text-sm text-muted-foreground">Aún no hay plantillas.</p>}
        {canEdit && (
          <div className="grid sm:grid-cols-5 gap-2 items-end border-t border-border pt-3">
            <div className="sm:col-span-2"><Label>Nombre</Label><Input value={t.nombre} onChange={e => setT({ ...t, nombre: e.target.value })} placeholder="Ej. Sustitución por renuncia" /></div>
            <div><Label>Tipo</Label><Select value={t.tipo} onValueChange={v => setT({ ...t, tipo: v as OpsReqTipo })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPOS.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Vacante</Label><Select value={t.tipoVacante} onValueChange={v => setT({ ...t, tipoVacante: v as OpsVacante })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{VACANTES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Prioridad</Label><Select value={t.prioridad} onValueChange={v => setT({ ...t, prioridad: v as OpsPrioridad })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORIDADES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
            <div className="sm:col-span-2"><Label>Motivo</Label><Select value={t.motivoBaja || "none"} onValueChange={v => setT({ ...t, motivoBaja: v === "none" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{MOTIVOS.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
            <div className="sm:col-span-2"><Label>Notas</Label><Input value={t.notas} onChange={e => setT({ ...t, notas: e.target.value })} /></div>
            <Button disabled={!t.nombre.trim()} onClick={() => { onSave([...templates, { ...t, id: `TPL-${Date.now()}` }]); setT({ ...t, nombre: "", notas: "" }); }}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecipientsView({ canEdit, userName }: { canEdit: boolean; userName: string }) {
  const { allUsers } = useAuth();
  const { toast } = useToast();
  const [list, setList] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  useEffect(() => { getRrhhRecipients().then(setList).catch(() => {}); }, []);
  const save = async (next: string[]) => {
    try { setList(await saveRrhhRecipients(next, userName)); toast({ title: "Lista de destinatarios actualizada" }); }
    catch (e: any) { toast({ title: "No se pudo guardar", description: e.message, variant: "destructive" }); }
  };
  const add = () => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return toast({ title: "Correo no válido", variant: "destructive" });
    if (list.includes(e)) return setEmail("");
    save([...list, e]); setEmail("");
  };
  const nameOf = (e: string) => allUsers.find(u => u.email?.toLowerCase() === e)?.fullName;
  return (
    <Card><CardHeader><CardTitle className="text-base">Destinatarios de RRHH</CardTitle>
      <p className="text-sm text-muted-foreground">Estas personas reciben un correo con cada solicitud nueva, cambio de estado, comentario y el resumen diario. El creador de la solicitud y requerimientos.operaciones@ siempre reciben copia.</p>
    </CardHeader>
      <CardContent className="space-y-3">
        {list.map(e => (
          <div key={e} className="flex items-center justify-between border border-border rounded p-2 text-sm">
            <div><b>{nameOf(e) || e}</b>{nameOf(e) && <span className="text-muted-foreground"> · {e}</span>}</div>
            {canEdit && <Button size="sm" variant="ghost" onClick={() => save(list.filter(x => x !== e))}>Excluir</Button>}
          </div>
        ))}
        {!list.length && <p className="text-sm text-amber-600">No hay nadie de RRHH en la lista; solo recibirá correo el creador.</p>}
        {canEdit ? (
          <div className="flex gap-2 border-t border-border pt-3">
            <Input list="ops-users" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@safeone.com.do" onKeyDown={e => e.key === "Enter" && add()} />
            <datalist id="ops-users">{allUsers.filter(u => u.email).map(u => <option key={u.id} value={u.email}>{u.fullName}</option>)}</datalist>
            <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Incluir</Button>
          </div>
        ) : <p className="text-xs text-muted-foreground">Solo RRHH o administradores pueden modificar esta lista.</p>}
      </CardContent>
    </Card>
  );
}
