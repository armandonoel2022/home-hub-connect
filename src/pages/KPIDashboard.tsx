import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { mockTickets } from "@/lib/mockData";
import { DEPARTMENTS } from "@/lib/types";
import {
  BarChart3,
  Users,
  Ticket,
  ShoppingCart,
  Shield,
  Smartphone,
  TrendingUp,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

const COLORS = [
  "hsl(42, 100%, 50%)",
  "hsl(200, 70%, 50%)",
  "hsl(160, 60%, 40%)",
  "hsl(0, 60%, 50%)",
  "hsl(280, 50%, 50%)",
  "hsl(30, 80%, 55%)",
  "hsl(220, 70%, 50%)",
  "hsl(340, 60%, 50%)",
];

const KPIDashboard = () => {
  const { allUsers } = useAuth();

  // KPI Data
  const usersByDept = DEPARTMENTS.map((d) => ({
    name: d.length > 15 ? d.substring(0, 15) + "…" : d,
    fullName: d,
    cantidad: allUsers.filter((u) => u.department === d).length,
  })).filter((d) => d.cantidad > 0);

  const ticketsByStatus = [
    { name: "Abierto", value: mockTickets.filter((t) => t.status === "Abierto").length },
    { name: "En Progreso", value: mockTickets.filter((t) => t.status === "En Progreso").length },
    { name: "Resuelto", value: mockTickets.filter((t) => t.status === "Resuelto").length },
    { name: "Cerrado", value: mockTickets.filter((t) => t.status === "Cerrado").length },
  ].filter((d) => d.value > 0);

  const ticketsByPriority = [
    { name: "Baja", value: mockTickets.filter((t) => t.priority === "Baja").length },
    { name: "Media", value: mockTickets.filter((t) => t.priority === "Media").length },
    { name: "Alta", value: mockTickets.filter((t) => t.priority === "Alta").length },
    { name: "Crítica", value: mockTickets.filter((t) => t.priority === "Crítica").length },
  ].filter((d) => d.value > 0);

  // Mock monthly trend
  const monthlyTrend = [
    { mes: "Oct", tickets: 12, resueltos: 10 },
    { mes: "Nov", tickets: 18, resueltos: 15 },
    { mes: "Dic", tickets: 8, resueltos: 8 },
    { mes: "Ene", tickets: 22, resueltos: 18 },
    { mes: "Feb", tickets: 15, resueltos: 14 },
    { mes: "Mar", tickets: mockTickets.length, resueltos: mockTickets.filter((t) => t.status === "Resuelto").length },
  ];

  const totalUsers = allUsers.length;
  const leaders = allUsers.filter((u) => u.isDepartmentLeader).length;
  const activeDepts = new Set(allUsers.map((u) => u.department)).size;

  const stats = [
    { label: "Colaboradores", value: totalUsers, icon: Users, color: "text-blue-500" },
    { label: "Líderes de Área", value: leaders, icon: Shield, color: "text-gold" },
    { label: "Departamentos", value: activeDepts, icon: BarChart3, color: "text-emerald-500" },
    { label: "Tickets Activos", value: mockTickets.filter((t) => t.status !== "Resuelto" && t.status !== "Cerrado").length, icon: Ticket, color: "text-amber-500" },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-gold" />
              <div>
                <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                  Dashboard <span className="gold-accent-text">KPIs</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Métricas operativas de SafeOne</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-3xl font-heading font-bold text-card-foreground">{s.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="px-6 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Users by Department */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-heading font-bold text-card-foreground mb-4">Personal por Departamento</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={usersByDept} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--card-foreground))" }} />
                <Bar dataKey="cantidad" fill="hsl(42, 100%, 50%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tickets by Status */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-heading font-bold text-card-foreground mb-4">Tickets por Estado</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={ticketsByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {ticketsByStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--card-foreground))" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Trend */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-heading font-bold text-card-foreground mb-4">Tendencia Mensual de Tickets</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--card-foreground))" }} />
                <Legend />
                <Line type="monotone" dataKey="tickets" stroke="hsl(42, 100%, 50%)" strokeWidth={2} name="Creados" />
                <Line type="monotone" dataKey="resueltos" stroke="hsl(160, 60%, 40%)" strokeWidth={2} name="Resueltos" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tickets by Priority */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-heading font-bold text-card-foreground mb-4">Tickets por Prioridad</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={ticketsByPriority}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--card-foreground))" }} />
                <Bar dataKey="value" name="Tickets" radius={[4, 4, 0, 0]}>
                  {ticketsByPriority.map((entry, i) => (
                    <Cell key={i} fill={entry.name === "Crítica" ? "hsl(0, 60%, 50%)" : entry.name === "Alta" ? "hsl(30, 80%, 55%)" : entry.name === "Media" ? "hsl(42, 100%, 50%)" : "hsl(160, 60%, 40%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default KPIDashboard;
