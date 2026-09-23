import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { ChevronLeft, ChevronRight, Ticket as TicketIcon, CheckCircle2, XCircle, Clock, Timer, Inbox } from "lucide-react";
import ExportMenu from "@/components/ExportMenu";
import type { Ticket } from "@/lib/types";
import { normalizeStatus, isClosed, DEFAULT_ASSIGNEE } from "@/lib/ticketWorkflow";
import { categoryVisual } from "./TicketVisuals";

type Period = "semana" | "mes" | "trimestre" | "año";
const COLORS = ["hsl(var(--primary))", "hsl(var(--accent-foreground))", "hsl(var(--muted-foreground))", "hsl(var(--destructive))", "hsl(var(--secondary-foreground))", "hsl(var(--ring))"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function range(period: Period, offset: number): { from: Date; to: Date; label: string } {
  const now = new Date();
  if (period === "semana") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = (d.getDay() + 6) % 7; // lunes = 0
    const from = new Date(d); from.setDate(d.getDate() - dow + offset * 7);
    const to = new Date(from); to.setDate(from.getDate() + 7);
    const end = new Date(to); end.setDate(to.getDate() - 1);
    return { from, to, label: `Semana ${from.toLocaleDateString("es-DO")} – ${end.toLocaleDateString("es-DO")}` };
  }
  if (period === "mes") {
    const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    return { from, to, label: `${MONTHS[from.getMonth()]} ${from.getFullYear()}` };
  }
  if (period === "trimestre") {
    const q = Math.floor(now.getMonth() / 3) + offset;
    const from = new Date(now.getFullYear(), q * 3, 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 3, 1);
    return { from, to, label: `T${Math.floor(from.getMonth() / 3) + 1} ${from.getFullYear()}` };
  }
  const from = new Date(now.getFullYear() + offset, 0, 1);
  return { from, to: new Date(from.getFullYear() + 1, 0, 1), label: `Año ${from.getFullYear()}` };
}

function bucketKey(period: Period, d: Date) {
  if (period === "semana" || period === "mes") return d.toLocaleDateString("es-DO", { day: "2-digit", month: "short" });
  if (period === "trimestre") { const w = new Date(d); w.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return `Sem ${w.toLocaleDateString("es-DO", { day: "2-digit", month: "short" })}`; }
  return MONTHS[d.getMonth()];
}

const TicketsDashboard = ({ tickets }: { tickets: Ticket[] }) => {
  const [period, setPeriod] = useState<Period>("mes");
  const [offset, setOffset] = useState(0);
  const r = range(period, offset);

  const data = useMemo(() => {
    const list = tickets.filter((t) => { const c = new Date(t.createdAt); return c >= r.from && c < r.to; });
    const closed = list.filter((t) => isClosed(t.status));
    const resolved = closed.filter((t) => normalizeStatus(t.status) === "Cerrado - Resuelto");
    const closedTime = (t: Ticket) => new Date(t.closedAt || t.updatedAt).getTime();
    const withinSla = closed.filter((t) => closedTime(t) <= new Date(t.slaDeadline).getTime());
    const avgH = closed.length ? closed.reduce((s, t) => s + (closedTime(t) - new Date(t.createdAt).getTime()), 0) / closed.length / 3600000 : 0;
    const overdue = list.filter((t) => !isClosed(t.status) && Date.now() > new Date(t.slaDeadline).getTime());

    const count = (fn: (t: Ticket) => string) => {
      const m = new Map<string, number>();
      list.forEach((t) => m.set(fn(t), (m.get(fn(t)) || 0) + 1));
      return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    };
    const trendMap = new Map<string, { name: string; creados: number; cerrados: number }>();
    list.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach((t) => {
      const k = bucketKey(period, new Date(t.createdAt));
      const e = trendMap.get(k) || { name: k, creados: 0, cerrados: 0 };
      e.creados++; if (isClosed(t.status)) e.cerrados++;
      trendMap.set(k, e);
    });
    const agents = new Map<string, { name: string; total: number; cerrados: number; sla: number }>();
    list.forEach((t) => {
      const n = t.assignedTo && t.assignedTo !== "Tecnología y Monitoreo" ? t.assignedTo : DEFAULT_ASSIGNEE.name;
      const e = agents.get(n) || { name: n, total: 0, cerrados: 0, sla: 0 };
      e.total++;
      if (isClosed(t.status)) { e.cerrados++; if (closedTime(t) <= new Date(t.slaDeadline).getTime()) e.sla++; }
      agents.set(n, e);
    });
    return {
      list, closed, resolved, withinSla, avgH, overdue,
      byCategory: count((t) => categoryVisual(t.category).label),
      byStatus: count((t) => normalizeStatus(t.status)),
      byDept: count((t) => t.department || "—").slice(0, 8),
      trend: [...trendMap.values()],
      agents: [...agents.values()],
    };
  }, [tickets, r.from.getTime(), r.to.getTime(), period]);

  const kpis = [
    { label: "Tickets recibidos", value: data.list.length, icon: Inbox },
    { label: "Abiertos", value: data.list.length - data.closed.length, icon: TicketIcon },
    { label: "Cerrados · Resueltos", value: data.resolved.length, icon: CheckCircle2 },
    { label: "Cerrados · No resueltos", value: data.closed.length - data.resolved.length, icon: XCircle },
    { label: "Cumplimiento SLA", value: data.closed.length ? `${Math.round((data.withinSla.length / data.closed.length) * 100)}%` : "—", icon: Clock },
    { label: "Tiempo prom. de cierre", value: data.closed.length ? `${data.avgH.toFixed(1)} h` : "—", icon: Timer },
  ];

  const exportRows = data.list.map((t) => ({
    id: t.id, fecha: new Date(t.createdAt).toLocaleString("es-DO"), titulo: t.title, categoria: t.category,
    prioridad: t.priority, estado: normalizeStatus(t.status), solicitante: t.createdBy, departamento: t.department,
    asignado: t.assignedTo || DEFAULT_ASSIGNEE.name, cierre: t.closedAt ? new Date(t.closedAt).toLocaleString("es-DO") : "",
    notas: t.closingNotes || t.holdReason || "",
  }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["semana", "mes", "trimestre", "año"] as Period[]).map((p) => (
            <button key={p} onClick={() => { setPeriod(p); setOffset(0); }}
              className={`px-4 py-2 text-sm capitalize ${period === p ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>{p}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setOffset(offset - 1)} className="p-2 rounded-lg hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-semibold text-foreground min-w-[180px] text-center">{r.label}</span>
          <button onClick={() => setOffset(Math.min(0, offset + 1))} disabled={offset >= 0} className="p-2 rounded-lg hover:bg-muted disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="ml-auto">
          <ExportMenu title="Reporte de Tickets IT" subtitle={r.label} filename={`tickets-${period}-${r.from.toISOString().slice(0, 10)}`} data={exportRows}
            columns={[
              { header: "ID", key: "id" }, { header: "Fecha", key: "fecha" }, { header: "Título", key: "titulo" },
              { header: "Categoría", key: "categoria" }, { header: "Prioridad", key: "prioridad" }, { header: "Estado", key: "estado" },
              { header: "Solicitante", key: "solicitante" }, { header: "Departamento", key: "departamento" },
              { header: "Asignado", key: "asignado" }, { header: "Cierre", key: "cierre" }, { header: "Notas", key: "notas" },
            ]} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <k.icon className="h-5 w-5 text-primary mb-2" />
            <p className="text-2xl font-heading font-bold text-foreground">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>
      {data.overdue.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {data.overdue.length} ticket(s) abiertos fuera de SLA: {data.overdue.map((t) => t.id).join(", ")}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3 text-foreground">Tendencia (creados vs cerrados)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip />
              <Bar dataKey="creados" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="cerrados" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3 text-foreground">Por estado</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.byStatus} dataKey="value" nameKey="name" outerRadius={90} label={({ name, value }) => `${name}: ${value}`} fontSize={11}>
                {data.byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3 text-foreground">Por tipo de solicitud</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byCategory} layout="vertical">
              <XAxis type="number" allowDecimals={false} fontSize={11} /><YAxis type="category" dataKey="name" width={110} fontSize={11} /><Tooltip />
              <Bar dataKey="value" name="Tickets" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3 text-foreground">Por departamento solicitante</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byDept} layout="vertical">
              <XAxis type="number" allowDecimals={false} fontSize={11} /><YAxis type="category" dataKey="name" width={140} fontSize={11} /><Tooltip />
              <Bar dataKey="value" name="Tickets" fill={COLORS[4]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3 text-foreground">Desempeño por técnico</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground text-xs"><th className="py-2">Técnico</th><th>Asignados</th><th>Cerrados</th><th>Dentro de SLA</th></tr></thead>
          <tbody>
            {data.agents.map((a) => (
              <tr key={a.name} className="border-t border-border">
                <td className="py-2 font-medium text-foreground">{a.name}</td><td>{a.total}</td><td>{a.cerrados}</td>
                <td>{a.cerrados ? `${Math.round((a.sla / a.cerrados) * 100)}%` : "—"}</td>
              </tr>
            ))}
            {data.agents.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Sin tickets en este período</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TicketsDashboard;
