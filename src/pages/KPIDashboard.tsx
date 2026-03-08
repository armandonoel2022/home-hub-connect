import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { INITIAL_OBJECTIVES, INITIAL_PROCEDURES, BASC_OBJECTIVE_CATEGORIES } from "@/lib/bascData";
import {
  TrendingUp, Shield, Target, CheckCircle2, AlertTriangle, Clock, FileCheck, Eye, Link2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend,
} from "recharts";

const COLORS = [
  "hsl(160, 60%, 40%)", "hsl(42, 100%, 50%)", "hsl(0, 60%, 50%)",
  "hsl(200, 70%, 50%)", "hsl(280, 50%, 50%)", "hsl(30, 80%, 55%)",
];

const KPIDashboard = () => {
  const { allUsers } = useAuth();
  const objectives = INITIAL_OBJECTIVES;
  const procedures = INITIAL_PROCEDURES;

  // General compliance
  const complianceAvg = Math.round(objectives.reduce((a, o) => a + o.compliancePercent, 0) / objectives.length);
  const completedCount = objectives.filter((o) => o.status === "cumplido").length;
  const inProgressCount = objectives.filter((o) => o.status === "en_progreso").length;
  const pendingCount = objectives.filter((o) => o.status === "pendiente" || o.status === "vencido").length;
  const totalEvidences = objectives.reduce((a, o) => a + o.evidences.length, 0);
  const conformeCount = objectives.filter((o) => o.auditResult === "conforme").length;
  const observationCount = objectives.filter((o) => o.auditResult === "observación").length;
  const nonConformeCount = objectives.filter((o) => o.auditResult === "no_conforme").length;
  const vigenteProcCount = procedures.filter((p) => p.status === "vigente").length;

  // Compliance by category
  const complianceByCategory = BASC_OBJECTIVE_CATEGORIES.map((cat) => {
    const catObjs = objectives.filter((o) => o.category === cat);
    if (catObjs.length === 0) return null;
    const avg = Math.round(catObjs.reduce((a, o) => a + o.compliancePercent, 0) / catObjs.length);
    return { name: cat.length > 18 ? cat.substring(0, 18) + "…" : cat, fullName: cat, compliance: avg, objectives: catObjs.length };
  }).filter(Boolean) as { name: string; fullName: string; compliance: number; objectives: number }[];

  // Status pie
  const statusPie = [
    { name: "Cumplidos", value: completedCount },
    { name: "En Progreso", value: inProgressCount },
    { name: "Pendientes", value: pendingCount },
  ].filter((d) => d.value > 0);

  // Audit results pie
  const auditPie = [
    { name: "Conforme", value: conformeCount },
    { name: "Observación", value: observationCount },
    { name: "No Conforme", value: nonConformeCount },
    { name: "Sin Auditar", value: objectives.filter((o) => !o.auditResult).length },
  ].filter((d) => d.value > 0);

  // Compliance radial
  const radialData = [{ name: "Compliance", value: complianceAvg, fill: complianceAvg >= 80 ? "hsl(160, 60%, 40%)" : complianceAvg >= 50 ? "hsl(42, 100%, 50%)" : "hsl(0, 60%, 50%)" }];

  // Top at-risk objectives
  const atRisk = objectives.filter((o) => o.compliancePercent < 70).sort((a, b) => a.compliancePercent - b.compliancePercent);

  const stats = [
    { label: "Compliance General", value: `${complianceAvg}%`, icon: TrendingUp, color: complianceAvg >= 80 ? "text-emerald-500" : "gold-accent-text" },
    { label: "Objetivos BASC", value: objectives.length, icon: Target, color: "gold-accent-text" },
    { label: "Procedimientos Vigentes", value: `${vigenteProcCount}/${procedures.length}`, icon: FileCheck, color: "text-emerald-500" },
    { label: "Evidencias Registradas", value: totalEvidences, icon: Eye, color: "text-blue-500" },
    { label: "Auditorías Conformes", value: `${conformeCount}/${objectives.filter((o) => o.auditResult).length}`, icon: CheckCircle2, color: "text-emerald-500" },
    { label: "Objetivos en Riesgo", value: atRisk.length, icon: AlertTriangle, color: atRisk.length > 0 ? "text-destructive" : "text-emerald-500" },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center gap-3">
              <Shield className="h-7 w-7 text-gold" />
              <div>
                <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                  Dashboard <span className="gold-accent-text">BASC Compliance</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Indicadores de cumplimiento, objetivos y evidencia BASC</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              </div>
              <p className="text-2xl font-heading font-bold text-card-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Compliance Gauge */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-heading font-bold text-card-foreground mb-2">Nivel de Compliance</h3>
            <p className="text-xs text-muted-foreground mb-3">Promedio general de cumplimiento de objetivos BASC</p>
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={radialData} startAngle={180} endAngle={0}>
                <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "hsl(var(--muted))" }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <p className={`text-center text-4xl font-heading font-bold -mt-8 ${complianceAvg >= 80 ? "text-emerald-600" : complianceAvg >= 50 ? "gold-accent-text" : "text-destructive"}`}>
              {complianceAvg}%
            </p>
            <p className="text-center text-xs text-muted-foreground mt-1">
              {complianceAvg >= 80 ? "✓ En buen estado" : complianceAvg >= 50 ? "⚠ Requiere atención" : "✗ Nivel crítico"}
            </p>
          </div>

          {/* Status Distribution */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-heading font-bold text-card-foreground mb-2">Estado de Objetivos</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusPie} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={4} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}>
                  {statusPie.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--card-foreground))" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Audit Results */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-heading font-bold text-card-foreground mb-2">Resultados de Auditoría</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={auditPie} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={4} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}>
                  {auditPie.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--card-foreground))" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Compliance by Category */}
        <div className="px-6 pb-6">
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-heading font-bold text-card-foreground mb-4">Compliance por Categoría BASC</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={complianceByCategory} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--card-foreground))" }}
                  formatter={(value: number) => [`${value}%`, "Compliance"]}
                />
                <Bar dataKey="compliance" radius={[0, 4, 4, 0]}>
                  {complianceByCategory.map((entry, i) => (
                    <Cell key={i} fill={entry.compliance >= 80 ? "hsl(160, 60%, 40%)" : entry.compliance >= 50 ? "hsl(42, 100%, 50%)" : "hsl(0, 60%, 50%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* At-Risk Objectives */}
        {atRisk.length > 0 && (
          <div className="px-6 pb-8">
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-heading font-bold text-card-foreground mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" /> Objetivos en Riesgo ({"<"}70% compliance)
              </h3>
              <div className="space-y-3">
                {atRisk.map((obj) => (
                  <div key={obj.id} className="bg-muted rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{obj.code}</span>
                        <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-semibold">{obj.compliancePercent}%</span>
                      </div>
                      <p className="text-sm font-medium text-card-foreground">{obj.title}</p>
                      <p className="text-xs text-muted-foreground">{obj.responsible} · {obj.department} · Meta: {obj.targetDate}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{obj.evidences.length} evidencias</p>
                      <div className="w-24 h-2 bg-card rounded-full mt-1">
                        <div className="h-full rounded-full bg-destructive" style={{ width: `${obj.compliancePercent}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default KPIDashboard;
