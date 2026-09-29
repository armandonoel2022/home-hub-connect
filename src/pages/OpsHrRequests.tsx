import { useEffect, useMemo, useState } from "react";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import OpsMailStatusPanel from "@/components/ops/OpsMailStatusPanel";
import UniformItemPicker from "@/components/ops/UniformItemPicker";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useArmedPersonnel } from "@/hooks/useApiHooks";
import {
  TIPOS, VACANTES, PRIORIDADES, MOTIVOS, ESTADOS, CLOSED, SLA_HORAS, ESTADO_STYLE,
  opsRolesFor, rrhhTeam, semaforo, listRequests, createRequest, updateRequest, listTemplates, saveTemplates, getRrhhRecipients, saveRrhhRecipients,
  type OpsHrRequest, type OpsEstado, type OpsTemplate, type OpsReqTipo, type OpsVacante, type OpsPrioridad, type OpsUniformItem,
} from "@/lib/opsHrRequests";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { isApiConfigured, opsHrRequestsApi, generalSqlApi, type GeneralContrato } from "@/lib/api";
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
import { ArrowLeft, Plus, LayoutDashboard, ListChecks, FolderOpen, Users, FileSpreadsheet, FileText, Copy, Send, Save, Mail, Paperclip, CheckCircle2, AlertTriangle, Search, Clock3, CircleCheck, SlidersHorizontal, ChevronRight, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, CartesianGrid } from "recharts";
import { z } from "zod";

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
  agenteManual: false, agenteManualNombre: "", agenteManualCodigo: "",
  uniformRecipientId: "", uniformRecipientManual: false, uniformRecipientName: "", uniformRecipientCode: "",
  uniformItems: [] as OpsUniformItem[],
  fechaEfectiva: new Date().toISOString().slice(0, 10), requiereCoberturaUrgente: false, notas: "",
  notificarCliente: false, clienteEmail: "",
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
  const urlId = params.get("id");
  useEffect(() => { if (urlId) setDetailId(urlId); }, [urlId]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [f, setF] = useState({ cliente: ALL, localidad: ALL, turno: ALL, vacante: ALL, prioridad: ALL, estado: ALL, creador: ALL, desde: "", hasta: "" });

  const reload = async () => { try { setItems(await listRequests()); } catch (e: any) { toast({ title: "No se pudieron cargar las solicitudes", description: e.message, variant: "destructive" }); } };
  useEffect(() => { reload(); listTemplates().then(setTemplates).catch(() => {}); const t = setInterval(reload, 30000); return () => clearInterval(t); }, []);

  // ─── Cascada: fuente viva gSafeOne (tabla Cliente → Localidad → Puesto → Horario) ───
  type HTurno = { id: string; nombre: string; horario: string };
  type HPost = { id: string; nombre: string; turnos: HTurno[]; vigilantes: { id: string; name: string; employeeCode: string }[] };
  type HLoc = { id: string; nombre: string; posts: HPost[] };
  type HClient = { id: string; nombre: string; email: string; contacto: string; locs: HLoc[] };
  const [sqlTree, setSqlTree] = useState<HClient[] | null>(null);
  const [sqlError, setSqlError] = useState<string>("");
  useEffect(() => {
    generalSqlApi.contrato().then((c: GeneralContrato) => {
      setSqlTree(c.clientes.filter(cl => !cl.inactivo).map(cl => ({
        id: `sql-${cl.oid}`, nombre: (cl.nombre || "").trim(), email: (cl.email || "").trim(), contacto: (cl.contacto || "").trim(),
        locs: cl.localidades.map((l, li) => ({
          id: `sql-${cl.oid}-${l.oid ?? li}`, nombre: l.nombre || "Sin nombre",
          posts: l.puestos.map((p, pi) => {
            const turnos = new Map<string, HTurno>(); const vig = new Map<string, { id: string; name: string; employeeCode: string }>();
            p.horarios.forEach(h => h.detalles.forEach(d => {
              const horario = d.horaDesde && d.horaHasta ? `${d.horaDesde} - ${d.horaHasta}` : `${d.horas}h`;
              const nombre = d.tanda || `${d.horas}h`; const k = `${nombre}|${horario}`;
              if (!turnos.has(k)) turnos.set(k, { id: k, nombre, horario });
              if (d.vigilanteOID && d.vigilante) vig.set(String(d.vigilanteOID), { id: `sqlv-${d.vigilanteOID}`, name: d.vigilante.trim(), employeeCode: String(d.vigilanteCodigo ?? "") });
            }));
            if (!turnos.size) turnos.set("general", { id: "general", nombre: "General", horario: "" });
            return { id: `sql-${cl.oid}-${l.oid ?? li}-${p.oid ?? pi}`, nombre: p.referencia || `Puesto ${pi + 1}`, turnos: [...turnos.values()], vigilantes: [...vig.values()] };
          }),
        })),
      })).sort((a, b) => a.nombre.localeCompare(b.nombre)));
    }).catch((e: any) => setSqlError(e?.message || "Sin conexión a gSafeOne"));
  }, []);
  const clients = sqlTree || [];
  const client = clients.find(c => c.id === form.clienteId);
  const locations = client?.locs || [];
  const loc = locations.find(l => l.id === form.localidadId);
  const posts = loc?.posts || [];
  const post = posts.find(p => p.id === form.puestoId);
  const turno = post?.turnos.find(t => t.id === form.turnoId);
  const agents = useMemo(() => {
    if (!client) return [] as any[];
    const cn = client.nombre.toLowerCase();
    const fromSql = (post?.vigilantes || []).map(v => {
      const match = (personnel as any[]).find(p => String(p.employeeCode) === v.employeeCode);
      return { ...v, supervisor: match?.supervisor };
    });
    if (fromSql.length) return fromSql;
    return (personnel as any[]).filter(p => p.status === "Activo" && String(p.client || "").toLowerCase() === cn);
  }, [personnel, client, post]);
  const supervisorName = agents.find(a => a.supervisor)?.supervisor || "";
  const supervisorUser = allUsers.find(u => supervisorName && u.fullName.toLowerCase() === supervisorName.toLowerCase());
  const isUniform = form.tipo === "Uniformes";
  const needsOut = form.tipo === "Salida" || form.tipo === "Sustitución";

  const submit = async (estado: OpsEstado) => {
    if (!user) return;
    if (!client || !loc || !post || !turno) return toast({ title: "Complete Cliente → Localidad → Puesto → Turno", variant: "destructive" });
    if (form.notificarCliente && !/^\S+@\S+\.\S+$/.test(form.clienteEmail)) return toast({ title: "Indique un correo válido del cliente", variant: "destructive" });
    if (isUniform) {
      const uniformSchema = z.object({
        recipient: z.string().trim().min(2, "Indique el agente que recibirá el uniforme").max(120),
        items: z.array(z.object({
          id: z.string().max(80), category: z.string().min(2).max(80), quantity: z.number().int().min(1).max(50),
          size: z.string().max(10).optional(), customDescription: z.string().trim().max(120).optional(),
        }).refine(item => item.category !== "Otros" || !!item.customDescription, "Describa la indumentaria seleccionada como Otros")).min(1, "Seleccione al menos una prenda"),
      });
      const assigned = agents.find(agent => agent.id === form.uniformRecipientId);
      const recipient = form.uniformRecipientManual || !agents.length ? form.uniformRecipientName : assigned?.name || "";
      const result = uniformSchema.safeParse({ recipient, items: form.uniformItems });
      if (!result.success) return toast({ title: "Complete la solicitud de uniformes", description: result.error.issues[0]?.message, variant: "destructive" });
    }
    const manualOut = form.agenteManual || !agents.length;
    const hasOut = manualOut ? !!form.agenteManualNombre.trim() : !!form.agenteSalienteId;
    if (needsOut && (!hasOut || !form.motivoBaja || !form.fechaEfectiva)) return toast({ title: "Agente saliente, motivo y fecha efectiva son obligatorios", variant: "destructive" });
    if (form.motivoBaja === "Otro" && !form.motivoComentario.trim()) return toast({ title: "Explique el motivo 'Otro'", variant: "destructive" });
    const out = manualOut ? null : agents.find(a => a.id === form.agenteSalienteId);
    const outName = manualOut ? `${form.agenteManualNombre.trim()}${form.agenteManualCodigo.trim() ? ` (${form.agenteManualCodigo.trim()})` : ""} · ingresado manualmente` : out?.name;
    const prop = (personnel as any[]).find(a => a.id === form.agentePropuestoId);
    const uniformAssigned = agents.find(a => a.id === form.uniformRecipientId);
    const uniformRecipientName = form.uniformRecipientManual || !agents.length ? form.uniformRecipientName.trim() : uniformAssigned?.name;
    const uniformRecipientCode = form.uniformRecipientManual || !agents.length ? form.uniformRecipientCode.trim() : uniformAssigned?.employeeCode;
    const rrhh = rrhhTeam(allUsers)[0];
    const { agenteManual: _m, agenteManualNombre: _n, agenteManualCodigo: _c, uniformRecipientManual: _urm, uniformRecipientName: _urn, uniformRecipientCode: _urc, ...formData } = form;
    const r = await createRequest({
      ...formData, estado,
      agenteSalienteId: manualOut ? "" : form.agenteSalienteId,
      uniformRecipientId: isUniform ? form.uniformRecipientId : undefined, uniformRecipientName: isUniform ? uniformRecipientName : undefined, uniformRecipientCode: isUniform ? uniformRecipientCode : undefined, uniformItems: isUniform ? form.uniformItems : undefined,
      clienteNombre: client.nombre, localidadNombre: loc.nombre, puestoNombre: post.nombre, turnoNombre: `${turno.nombre}${turno.horario ? ` (${turno.horario})` : ""}`,
      supervisorResponsable: supervisorName, supervisorEmail: supervisorUser?.email,
      agenteSalienteNombre: needsOut ? outName : undefined, agentePropuestoNombre: prop?.name,
      rrhhAsignado: rrhh?.fullName, rrhhAsignadoEmail: rrhh?.email,
      responsableActual: estado === "Borrador" ? user.fullName : rrhh?.fullName || "RRHH",
      creadoPor: user.fullName, creadoPorId: user.id, creadoPorEmail: user.email,
    } as any);
    toast({ title: `Solicitud ${r.id} ${estado === "Borrador" ? "guardada como borrador" : "enviada a RRHH"}`, description: r._mail && !r._mail.sent ? `Correo no enviado: ${r._mail.reason}` : undefined });
    setForm(emptyForm()); await reload(); setView("mias");
  };

  const duplicate = (r: OpsHrRequest) => {
    setForm({ ...emptyForm(), tipo: r.tipo, tipoVacante: r.tipoVacante, prioridad: r.prioridad, clienteId: r.clienteId, localidadId: r.localidadId, puestoId: r.puestoId, turnoId: "", notificarCliente: !!r.notificarCliente, clienteEmail: r.clienteEmail || "", motivoBaja: r.motivoBaja || "", requiereCoberturaUrgente: r.requiereCoberturaUrgente, uniformItems: (r.uniformItems || []).map(item => ({ ...item, id: `uniform-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` })) });
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
    (!f.desde || r.fechaCreacion.slice(0, 10) >= f.desde) && (!f.hasta || r.fechaCreacion.slice(0, 10) <= f.hasta) &&
    (!search.trim() || [r.id, r.tipo, r.clienteNombre, r.localidadNombre, r.puestoNombre, r.creadoPor].some(v => String(v || "").toLowerCase().includes(search.trim().toLowerCase())))
  ), [scoped, f, search]);
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
    sent.forEach(r => { const m = r.fechaCreacion.slice(0, 7); months[m] = months[m] || { mes: m, Ingreso: 0, Salida: 0, Sustitución: 0, Uniformes: 0 }; months[m][r.tipo]++; });
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
    <Card className="overflow-hidden border-operations-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-5 py-4 border-b bg-muted/20">
        <div><CardTitle className="text-base">Solicitudes</CardTitle><p className="text-xs text-muted-foreground mt-1">{list.length} resultados según los filtros aplicados</p></div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportToExcel({ title: "Solicitudes Operaciones → RRHH", columns: cols, data: exportData(list), filename: "solicitudes-operaciones" })}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          <Button size="sm" variant="outline" onClick={() => exportToPDF({ title: "Solicitudes Operaciones → RRHH", columns: cols, data: exportData(list), filename: "solicitudes-operaciones" })}><FileText className="h-4 w-4 mr-1" />PDF</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground uppercase">
            <tr><th className="px-5 py-3">SLA</th><th className="px-3 py-3">Solicitud</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Movimiento</th><th className="px-3 py-3">Cliente / Puesto</th><th className="px-3 py-3 hidden lg:table-cell">Creado</th><th className="px-5 py-3 text-right">Abrir</th></tr>
          </thead>
          <tbody>
            {list.map(r => (
              <tr key={r.id} className="border-t border-border hover:bg-operations-soft/60 cursor-pointer transition-colors" onClick={() => setDetailId(r.id)}>
                <td className="px-5 py-4"><span className={`inline-block h-2.5 w-2.5 rounded-full ring-4 ring-muted ${SEM[semaforo(r)]}`} /></td>
                <td className="px-3 py-4 font-mono text-xs font-semibold">{r.id}{r.requiereCoberturaUrgente && <AlertTriangle className="inline h-3 w-3 ml-1 text-destructive" />}</td>
                <td className="px-3 py-4"><span className={`px-2 py-1 rounded text-xs font-medium ${ESTADO_STYLE[r.estado]}`}>{r.estado}</span></td>
                <td className="px-3 py-4 text-sm font-medium">{r.tipo}<div className="text-xs font-normal text-muted-foreground">{r.tipoVacante} · {r.prioridad}</div></td>
                <td className="px-3 py-4 text-sm font-medium">{r.clienteNombre}<div className="text-xs font-normal text-muted-foreground">{r.localidadNombre} · {r.puestoNombre} · {r.turnoNombre}</div></td>
                <td className="px-3 py-4 hidden lg:table-cell text-xs">{fmt(r.fechaCreacion)}<div className="text-muted-foreground">{r.creadoPor}</div></td>
                <td className="px-5 py-4 text-right"><ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" /></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No hay solicitudes que coincidan con la búsqueda.</td></tr>}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );

  const FSel = ({ k, label, opts }: { k: keyof typeof f; label: string; opts: string[] }) => (
    <Select value={f[k]} onValueChange={v => setF({ ...f, [k]: v })}>
      <SelectTrigger className="h-10 text-xs bg-card"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent><SelectItem value={ALL}>{label}: todos</SelectItem>{opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );
  const Filters = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 p-4 bg-muted/30 border-y border-operations-border">
      <FSel k="cliente" label="Cliente" opts={uniq("clienteNombre")} />
      <FSel k="localidad" label="Localidad" opts={uniq("localidadNombre")} />
      <FSel k="turno" label="Turno" opts={uniq("turnoNombre")} />
      <FSel k="vacante" label="Vacante" opts={VACANTES} />
      <FSel k="prioridad" label="Prioridad" opts={PRIORIDADES} />
      <FSel k="estado" label="Estado" opts={ESTADOS} />
      <FSel k="creador" label="Creador" opts={uniq("creadoPor")} />
      <Input aria-label="Fecha desde" type="date" className="h-10 text-xs bg-card" value={f.desde} onChange={e => setF({ ...f, desde: e.target.value })} />
      <Input aria-label="Fecha hasta" type="date" className="h-10 text-xs bg-card" value={f.hasta} onChange={e => setF({ ...f, hasta: e.target.value })} />
    </div>
  );

  const Kpi = ({ label, value, tone = "", icon: Icon }: { label: string; value: any; tone?: string; icon: any }) => (
    <Card className="border-operations-border shadow-sm"><CardContent className="p-5 flex items-center gap-4"><span className="h-11 w-11 rounded-md bg-operations-soft text-operations flex items-center justify-center"><Icon className="h-5 w-5" /></span><div><div className="text-xs font-medium text-muted-foreground">{label}</div><div className={`text-2xl font-bold ${tone}`}>{value}</div></div></CardContent></Card>
  );

  return (
    <AppLayout>
      <Navbar />
      <div className="ops-workspace max-w-[1480px] mx-auto px-3 sm:px-6 py-5 w-full">
        <section>
          <header className="px-2 sm:px-1 pb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Button variant="ghost" size="icon" className="shrink-0" aria-label="Volver a Solicitudes a RRHH" onClick={() => navigate("/rrhh/formularios")}><ArrowLeft className="h-5 w-5" /></Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><span>Operaciones</span><ChevronRight className="h-3 w-3" /><span className="text-operations font-semibold">Solicitudes a RRHH</span></div>
                <h1 className="text-2xl sm:text-3xl font-bold">Centro de gestión</h1>
                <p className="text-sm text-muted-foreground mt-1">Personal y uniformes por cliente, puesto y turno.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-12 lg:pl-0">
              {canManage && isApiConfigured() && (
                <Button size="sm" variant="outline" onClick={async () => { const r = await opsHrRequestsApi.syncMail(); toast({ title: r.ok ? `Correo revisado (${r.added} respuesta(s))` : "Error de correo", description: r.message }); reload(); }}><RefreshCw className="h-4 w-4" />Revisar respuestas</Button>
              )}
              <Button className="bg-operations text-operations-foreground hover:bg-operations/90" onClick={() => setView("nueva")}><Plus className="h-4 w-4" />Nueva solicitud</Button>
            </div>
          </header>

          <nav className="px-2 sm:px-1 flex gap-1 overflow-x-auto border-y border-operations-border bg-muted/20" aria-label="Secciones de solicitudes">
            {nav.filter(n => n.show).map(n => (
              <Button key={n.k} variant="ghost" className={`rounded-none border-b-2 h-12 justify-start whitespace-nowrap ${view === n.k ? "border-operations text-operations bg-operations-soft/70" : "border-transparent text-muted-foreground"}`} onClick={() => setView(n.k)}><n.icon className="h-4 w-4" />{n.label}</Button>
            ))}
          </nav>

          <div className="min-w-0">
            {view === "dashboard" && (<>
              <div className="p-5 sm:p-7 space-y-5">
              <OpsMailStatusPanel />
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <Kpi label="Solicitudes abiertas" value={kpi.open} icon={ListChecks} />
                <Kpi label="Cubiertas" value={kpi.covered} tone="text-green-600" icon={CircleCheck} />
                <Kpi label="Sin cobertura" value={kpi.uncovered} tone="text-amber-600" icon={AlertTriangle} />
                <Kpi label="Cumplimiento SLA" value={kpi.sla} icon={Clock3} />
              </div>
              <div className="border border-operations-border rounded-lg overflow-hidden">
                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-muted/20">
                  <div className="relative flex-1 max-w-xl"><Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" /><Input className="pl-9 bg-card" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por ID, cliente, puesto, tipo o creador..." /></div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={f.estado} onValueChange={v => setF({ ...f, estado: v })}><SelectTrigger className="w-[190px] bg-card"><SelectValue placeholder="Todos los estados" /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todos los estados</SelectItem>{ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select>
                    <Button variant="outline" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal className="h-4 w-4" />Más filtros</Button>
                  </div>
                </div>
                {showFilters && <Filters />}
                <List list={filtered} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Prom. respuesta RRHH" value={kpi.resp === "—" ? "—" : `${kpi.resp} h`} icon={Clock3} />
                <Kpi label="Prom. de cierre" value={kpi.close === "—" ? "—" : `${kpi.close} h`} icon={CircleCheck} />
                <Card className="col-span-2 border-operations-border shadow-sm"><CardContent className="p-5"><div className="text-xs font-medium text-muted-foreground mb-3">Pendientes por estado</div><div className="flex flex-wrap gap-2">{kpi.byState.map(s => <span key={s.name} className={`px-2 py-1 rounded text-xs ${ESTADO_STYLE[s.name as OpsEstado]}`}>{s.name}: <b>{s.value}</b></span>)}{!kpi.byState.length && <span className="text-sm text-muted-foreground">Nada pendiente</span>}</div></CardContent></Card>
              </div>
              <div className="grid lg:grid-cols-2 gap-4 pt-2">
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
              </div>
            </>)}

            {view === "mias" && <div className="p-5 sm:p-7"><List list={items.filter(r => r.creadoPorId === user?.id)} /></div>}
            {view === "todas" && canSeeAll && (<div className="p-5 sm:p-7 space-y-4"><Filters /><List list={filtered} /></div>)}

            {view === "nueva" && (
              <div className="p-5 sm:p-7"><Card className="border-operations-border shadow-sm"><CardHeader className="border-b bg-muted/20"><CardTitle className="text-lg">Nueva solicitud a RRHH</CardTitle><p className="text-sm text-muted-foreground">Seleccione primero la ubicación contratada y luego complete la solicitud.</p></CardHeader>
                <CardContent className="space-y-4">
                  {templates.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center"><span className="text-xs text-muted-foreground">Plantillas:</span>
                      {templates.map(t => <Button key={t.id} size="sm" variant="outline" onClick={() => setForm({ ...form, tipo: t.tipo, tipoVacante: t.tipoVacante, prioridad: t.prioridad, motivoBaja: t.motivoBaja || "", notas: t.notas || "" })}>{t.nombre}</Button>)}
                    </div>
                  )}
                  {!sqlTree && !sqlError && <p className="text-sm text-muted-foreground">Cargando clientes desde gSafeOne…</p>}
                  {sqlError && <p className="text-sm text-destructive">No se pudo leer la tabla Cliente de gSafeOne: {sqlError}</p>}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div><Label>Cliente</Label><Select value={form.clienteId} onValueChange={v => setForm({ ...form, clienteId: v, localidadId: "", puestoId: "", turnoId: "", agenteSalienteId: "", clienteEmail: clients.find(c => c.id === v)?.email || "" })}><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger><SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent></Select></div>
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
                  <div className={`grid gap-3 ${isUniform ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                    <div><Label>Tipo</Label><Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as OpsReqTipo })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                    {!isUniform && <div><Label>Tipo de vacante</Label><Select value={form.tipoVacante} onValueChange={v => setForm({ ...form, tipoVacante: v as OpsVacante })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{VACANTES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>}
                    <div><Label>Prioridad (SLA {SLA_HORAS[form.prioridad]}h)</Label><Select value={form.prioridad} onValueChange={v => setForm({ ...form, prioridad: v as OpsPrioridad })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORIDADES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  {isUniform && (
                    <>
                      <div className="rounded-md border border-operations-border bg-operations-soft/40 p-4">
                        <div className="flex items-center justify-between gap-3"><div><Label>Agente que recibirá el uniforme *</Label><p className="mt-1 text-xs text-muted-foreground">Seleccione el agente asignado al puesto o escríbalo manualmente.</p></div>
                          {agents.length > 0 && <Button type="button" variant="link" size="sm" onClick={() => setForm({ ...form, uniformRecipientManual: !form.uniformRecipientManual, uniformRecipientId: "" })}>{form.uniformRecipientManual ? "Elegir de la lista" : "Escribir manualmente"}</Button>}
                        </div>
                        {form.uniformRecipientManual || !agents.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><Input maxLength={120} placeholder="Nombre completo *" value={form.uniformRecipientName} onChange={e => setForm({ ...form, uniformRecipientName: e.target.value })} /><Input maxLength={40} placeholder="Código / cédula (opcional)" value={form.uniformRecipientCode} onChange={e => setForm({ ...form, uniformRecipientCode: e.target.value })} /></div>
                          : <Select value={form.uniformRecipientId} onValueChange={v => setForm({ ...form, uniformRecipientId: v })}><SelectTrigger className="mt-3 bg-card"><SelectValue placeholder="Seleccione el agente" /></SelectTrigger><SelectContent>{agents.map(agent => <SelectItem key={agent.id} value={agent.id}>{agent.name}{agent.employeeCode ? ` (${agent.employeeCode})` : ""}</SelectItem>)}</SelectContent></Select>}
                      </div>
                      <UniformItemPicker value={form.uniformItems} onChange={uniformItems => setForm({ ...form, uniformItems })} />
                    </>
                  )}
                  {needsOut && (
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between"><Label>Agente saliente *</Label>
                          <button type="button" className="text-xs text-primary underline" onClick={() => setForm({ ...form, agenteManual: !form.agenteManual, agenteSalienteId: "" })}>{form.agenteManual || !agents.length ? "" : "Escribir manualmente"}{form.agenteManual && agents.length ? "Elegir de la lista" : ""}</button>
                        </div>
                        {form.agenteManual || !agents.length ? (
                          <div className="space-y-1">
                            <Input placeholder="Nombre del agente actual" value={form.agenteManualNombre} onChange={e => setForm({ ...form, agenteManualNombre: e.target.value })} />
                            <Input placeholder="Código / cédula (opcional)" value={form.agenteManualCodigo} onChange={e => setForm({ ...form, agenteManualCodigo: e.target.value })} />
                            {!agents.length && <p className="text-xs text-muted-foreground">No hay agentes registrados en este puesto; escríbalo manualmente.</p>}
                          </div>
                        ) : (
                          <Select value={form.agenteSalienteId} onValueChange={v => setForm({ ...form, agenteSalienteId: v })}><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger><SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.employeeCode})</SelectItem>)}</SelectContent></Select>
                        )}
                      </div>
                      <div><Label>Motivo *</Label><Select value={form.motivoBaja} onValueChange={v => setForm({ ...form, motivoBaja: v })}><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger><SelectContent>{MOTIVOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                      <div><Label>Fecha efectiva *</Label><Input type="date" value={form.fechaEfectiva} onChange={e => setForm({ ...form, fechaEfectiva: e.target.value })} /></div>
                      {form.motivoBaja === "Otro" && <div className="sm:col-span-3"><Label>Comentario del motivo *</Label><Textarea value={form.motivoComentario} onChange={e => setForm({ ...form, motivoComentario: e.target.value })} /></div>}
                    </div>
                  )}
                  {!isUniform && <div className="grid sm:grid-cols-2 gap-3">
                    <div><Label>Agente propuesto (opcional)</Label><Select value={form.agentePropuestoId || "none"} onValueChange={v => setForm({ ...form, agentePropuestoId: v === "none" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ninguno</SelectItem>{(personnel as any[]).filter(p => p.status === "Activo").slice(0, 500).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                    {!needsOut && <div><Label>Fecha efectiva</Label><Input type="date" value={form.fechaEfectiva} onChange={e => setForm({ ...form, fechaEfectiva: e.target.value })} /></div>}
                  </div>}
                  <div className="flex items-center gap-2"><Switch checked={form.requiereCoberturaUrgente} onCheckedChange={v => setForm({ ...form, requiereCoberturaUrgente: v })} /><Label>Requiere cobertura urgente (correo de alta prioridad)</Label></div>
                  {!isUniform && <div className="rounded-md border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2"><Switch checked={form.notificarCliente} onCheckedChange={v => setForm({ ...form, notificarCliente: v })} /><Label>Notificar al cliente por correo cuando concluya el cambio / sustitución</Label></div>
                    {form.notificarCliente && <div className="grid sm:grid-cols-2 gap-2 items-end"><div><Label>Correo del cliente</Label><Input type="email" value={form.clienteEmail} onChange={e => setForm({ ...form, clienteEmail: e.target.value })} placeholder="correo@cliente.com" /></div><p className="text-xs text-muted-foreground">Tomado de gSafeOne (Cliente.Email). Se envía solo al marcar la solicitud como "Cubierta satisfactoriamente".</p></div>}
                  </div>}
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
              </Card></div>
            )}

            {view === "destinatarios" && <div className="p-5 sm:p-7"><RecipientsView canEdit={canManage} userName={user?.fullName || ""} /></div>}
            {view === "plantillas" && <div className="p-5 sm:p-7"><TemplatesView templates={templates} canEdit={roles.has("admin") || roles.has("coordinador") || roles.has("rrhh")} onSave={async l => { await saveTemplates(l); setTemplates(l); toast({ title: "Plantillas guardadas" }); }} /></div>}
          </div>
        </section>
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
              {[["Tipo", r.tipo === "Uniformes" ? r.tipo : `${r.tipo} · ${r.tipoVacante}`], ["Prioridad", `${r.prioridad} (${r.slaHoras}h)`], ["Cliente", r.clienteNombre], ["Localidad", r.localidadNombre], ["Puesto", r.puestoNombre], ["Turno", r.turnoNombre],
                ["Supervisor", r.supervisorResponsable], ["Agente saliente", r.agenteSalienteNombre], ["Motivo", [r.motivoBaja, r.motivoComentario].filter(Boolean).join(" — ")], ["Agente propuesto", r.agentePropuestoNombre], ["Agente destinatario", r.uniformRecipientName ? `${r.uniformRecipientName}${r.uniformRecipientCode ? ` (${r.uniformRecipientCode})` : ""}` : ""], ["Notificar cliente", r.notificarCliente ? `${r.clienteEmail}${r.clienteNotificadoEn ? ` · enviado ${fmt(r.clienteNotificadoEn)}` : " · pendiente al cierre"}` : "No"],
                ["Fecha efectiva", r.fechaEfectiva], ["Límite SLA", fmt(r.fechaLimiteSLA)], ["Responsable actual", r.responsableActual], ["RRHH asignado", r.rrhhAsignado], ["Creado por", `${r.creadoPor} · ${fmt(r.fechaCreacion)}`], ["Cierre", r.fechaCierre ? `${fmt(r.fechaCierre)} — ${r.cierreComentario || ""}` : ""]]
                .filter(([, v]) => v).map(([k, v]) => <div key={k}><span className="text-muted-foreground">{k}:</span> {v}</div>)}
            </div>
            {r.tipo === "Uniformes" && r.uniformItems?.length ? <div className="mt-4 rounded-md border border-operations-border bg-operations-soft/40 p-3"><div className="mb-2 text-xs font-semibold uppercase text-operations">Prendas solicitadas</div><div className="grid gap-2 sm:grid-cols-2">{r.uniformItems.map(item => <div key={item.id} className="rounded border border-border bg-card px-3 py-2"><span className="font-semibold">{item.quantity} × {item.category === "Otros" ? item.customDescription : item.category}</span>{item.size && <span className="text-muted-foreground"> · talla {item.size}</span>}</div>)}</div></div> : null}
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
