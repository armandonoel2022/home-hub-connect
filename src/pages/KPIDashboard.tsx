import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useKPIData } from "@/hooks/useKPIData";
import { BASC_OBJECTIVE_CATEGORIES, type BASCObjective } from "@/lib/bascData";
import { INITIAL_PROCEDURES } from "@/lib/bascData";
import type { DepartmentKPI } from "@/lib/kpiTypes";
import {
  TrendingUp, Shield, Target, CheckCircle2, AlertTriangle, Eye, FileCheck,
  Pencil, X, Save, Plus, Trash2, TrendingDown, Minus,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from "recharts";
import { toast } from "sonner";

const COLORS = [
  "hsl(160, 60%, 40%)", "hsl(42, 100%, 50%)", "hsl(0, 60%, 50%)",
  "hsl(200, 70%, 50%)", "hsl(280, 50%, 50%)", "hsl(30, 80%, 55%)",
];

// Users allowed to edit KPIs (by userId or department)
const canEditKPIs = (user: { id: string; isAdmin?: boolean; department: string } | null): boolean => {
  if (!user) return false;
  if (user.isAdmin) return true;
  // Chrisnel (Administración) and Bilianny (Calidad)
  return ["USR-101", "USR-104"].includes(user.id);
};

const canEditDeptKPI = (user: { id: string; isAdmin?: boolean; department: string } | null, kpiDept: string): boolean => {
  if (!user) return false;
  if (user.isAdmin) return true;
  return user.department === kpiDept && ["USR-101", "USR-104"].includes(user.id);
};

/* ── Inline Edit for BASC Objective ── */
function BASCObjectiveEditRow({
  obj, onSave, onCancel,
}: {
  obj: BASCObjective;
  onSave: (id: string, updates: Partial<BASCObjective>) => void;
  onCancel: () => void;
}) {
  const [compliance, setCompliance] = useState(obj.compliancePercent);
  const [status, setStatus] = useState(obj.status);
  const [auditResult, setAuditResult] = useState(obj.auditResult || "");

  return (
    <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono text-muted-foreground">{obj.code}</span>
          <p className="text-sm font-medium text-card-foreground">{obj.title}</p>
          <p className="text-xs text-muted-foreground">{obj.responsible} · {obj.department}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
          <button
            onClick={() => {
              onSave(obj.id, {
                compliancePercent: compliance,
                status,
                auditResult: auditResult as BASCObjective["auditResult"] || null,
              });
            }}
            className="p-1.5 rounded-lg bg-gold/20 text-gold hover:bg-gold/30"
          >
            <Save className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] uppercase text-muted-foreground tracking-wider block mb-1">Compliance (%)</label>
          <input
            type="number" min={0} max={100} value={compliance}
            onChange={(e) => setCompliance(Math.min(100, Math.max(0, Number(e.target.value))))}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-card-foreground outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground tracking-wider block mb-1">Estado</label>
          <select
            value={status} onChange={(e) => setStatus(e.target.value as BASCObjective["status"])}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-card-foreground outline-none focus:border-gold"
          >
            <option value="pendiente">Pendiente</option>
            <option value="en_progreso">En Progreso</option>
            <option value="cumplido">Cumplido</option>
            <option value="vencido">Vencido</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground tracking-wider block mb-1">Resultado Auditoría</label>
          <select
            value={auditResult} onChange={(e) => setAuditResult(e.target.value)}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-card-foreground outline-none focus:border-gold"
          >
            <option value="">Sin Auditar</option>
            <option value="conforme">Conforme</option>
            <option value="observación">Observación</option>
            <option value="no_conforme">No Conforme</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/* ── New Department KPI Form ── */
function NewDeptKPIForm({
  department, userName, onSave, onCancel,
}: {
  department: string;
  userName: string;
  onSave: (kpi: DepartmentKPI) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currentValue, setCurrentValue] = useState(0);
  const [targetValue, setTargetValue] = useState(100);
  const [unit, setUnit] = useState("%");

  const handleSubmit = () => {
    if (!name.trim()) { toast.error("El nombre es requerido"); return; }
    onSave({
      id: `DKPI-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      department,
      currentValue,
      targetValue,
      unit,
      trend: "stable",
      updatedBy: userName,
      updatedAt: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="bg-muted/50 rounded-xl p-4 border border-gold/30 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-heading font-bold text-card-foreground">Nuevo Indicador</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
          <button onClick={handleSubmit} className="p-1.5 rounded-lg bg-gold/20 text-gold hover:bg-gold/30"><Save className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase text-muted-foreground tracking-wider block mb-1">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Tasa de Rotación"
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-card-foreground outline-none focus:border-gold" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground tracking-wider block mb-1">Descripción</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descripción"
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-card-foreground outline-none focus:border-gold" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wider block mb-1">Actual</label>
            <input type="number" value={currentValue} onChange={(e) => setCurrentValue(Number(e.target.value))}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-card-foreground outline-none focus:border-gold" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wider block mb-1">Meta</label>
            <input type="number" value={targetValue} onChange={(e) => setTargetValue(Number(e.target.value))}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-card-foreground outline-none focus:border-gold" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wider block mb-1">Unidad</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%"
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-card-foreground outline-none focus:border-gold" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Dashboard ── */
const KPIDashboard = () => {
  const { user } = useAuth();
  const { objectives, updateObjective, deptKPIs, addDeptKPI, updateDeptKPI, deleteDeptKPI } = useKPIData();
  const procedures = INITIAL_PROCEDURES;

  const [editingObjId, setEditingObjId] = useState<string | null>(null);
  const [editingKPIId, setEditingKPIId] = useState<string | null>(null);
  const [editKPIValues, setEditKPIValues] = useState<{ currentValue: number; targetValue: number; trend: string }>({ currentValue: 0, targetValue: 0, trend: "stable" });
  const [showNewKPIFor, setShowNewKPIFor] = useState<string | null>(null);

  const isEditor = canEditKPIs(user);

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

  const complianceByCategory = BASC_OBJECTIVE_CATEGORIES.map((cat) => {
    const catObjs = objectives.filter((o) => o.category === cat);
    if (catObjs.length === 0) return null;
    const avg = Math.round(catObjs.reduce((a, o) => a + o.compliancePercent, 0) / catObjs.length);
    return { name: cat.length > 18 ? cat.substring(0, 18) + "…" : cat, fullName: cat, compliance: avg, objectives: catObjs.length };
  }).filter(Boolean) as { name: string; fullName: string; compliance: number; objectives: number }[];

  const statusPie = [
    { name: "Cumplidos", value: completedCount },
    { name: "En Progreso", value: inProgressCount },
    { name: "Pendientes", value: pendingCount },
  ].filter((d) => d.value > 0);

  const auditPie = [
    { name: "Conforme", value: conformeCount },
    { name: "Observación", value: observationCount },
    { name: "No Conforme", value: nonConformeCount },
    { name: "Sin Auditar", value: objectives.filter((o) => !o.auditResult).length },
  ].filter((d) => d.value > 0);

  const radialData = [{ name: "Compliance", value: complianceAvg, fill: complianceAvg >= 80 ? "hsl(160, 60%, 40%)" : complianceAvg >= 50 ? "hsl(42, 100%, 50%)" : "hsl(0, 60%, 50%)" }];

  const atRisk = objectives.filter((o) => o.compliancePercent < 70).sort((a, b) => a.compliancePercent - b.compliancePercent);

  const stats = [
    { label: "Compliance General", value: `${complianceAvg}%`, icon: TrendingUp, color: complianceAvg >= 80 ? "text-emerald-500" : "gold-accent-text" },
    { label: "Objetivos BASC", value: objectives.length, icon: Target, color: "gold-accent-text" },
    { label: "Procedimientos Vigentes", value: `${vigenteProcCount}/${procedures.length}`, icon: FileCheck, color: "text-emerald-500" },
    { label: "Evidencias Registradas", value: totalEvidences, icon: Eye, color: "text-blue-500" },
    { label: "Auditorías Conformes", value: `${conformeCount}/${objectives.filter((o) => o.auditResult).length}`, icon: CheckCircle2, color: "text-emerald-500" },
    { label: "Objetivos en Riesgo", value: atRisk.length, icon: AlertTriangle, color: atRisk.length > 0 ? "text-destructive" : "text-emerald-500" },
  ];

  // Group dept KPIs by department
  const deptKPIsByDept = deptKPIs.reduce<Record<string, DepartmentKPI[]>>((acc, k) => {
    (acc[k.department] = acc[k.department] || []).push(k);
    return acc;
  }, {});

  const handleSaveObjective = (id: string, updates: Partial<BASCObjective>) => {
    updateObjective(id, updates);
    setEditingObjId(null);
    toast.success("Objetivo BASC actualizado");
  };

  const handleSaveDeptKPI = (id: string) => {
    updateDeptKPI(id, {
      currentValue: editKPIValues.currentValue,
      targetValue: editKPIValues.targetValue,
      trend: editKPIValues.trend as DepartmentKPI["trend"],
      updatedBy: user?.fullName || "",
      updatedAt: new Date().toISOString().split("T")[0],
    });
    setEditingKPIId(null);
    toast.success("Indicador actualizado");
  };

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
    if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

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
                  Dashboard <span className="gold-accent-text">KPIs & Compliance</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Indicadores BASC y departamentales
                  {isEditor && <span className="ml-2 text-gold text-[10px] font-semibold uppercase">· Modo Editor</span>}
                </p>
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
            <p className="text-xs text-muted-foreground mb-3">Promedio general de cumplimiento BASC</p>
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

        {/* ═══ Department KPIs Section ═══ */}
        <div className="px-6 pb-6">
          <h2 className="font-heading font-bold text-xl text-card-foreground mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-gold" /> Indicadores Departamentales
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(deptKPIsByDept).map(([dept, kpis]) => (
              <div key={dept} className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-bold text-card-foreground">{dept}</h3>
                  {canEditDeptKPI(user, dept) && (
                    <button
                      onClick={() => setShowNewKPIFor(showNewKPIFor === dept ? null : dept)}
                      className="flex items-center gap-1 text-xs text-gold hover:text-gold/80 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Agregar
                    </button>
                  )}
                </div>

                {showNewKPIFor === dept && (
                  <div className="mb-4">
                    <NewDeptKPIForm
                      department={dept}
                      userName={user?.fullName || ""}
                      onSave={(kpi) => { addDeptKPI(kpi); setShowNewKPIFor(null); toast.success("Indicador creado"); }}
                      onCancel={() => setShowNewKPIFor(null)}
                    />
                  </div>
                )}

                <div className="space-y-3">
                  {kpis.map((kpi) => {
                    const pct = kpi.targetValue > 0 ? Math.round((kpi.currentValue / kpi.targetValue) * 100) : 0;
                    const isEditing = editingKPIId === kpi.id;

                    if (isEditing) {
                      return (
                        <div key={kpi.id} className="bg-muted/50 rounded-lg p-3 border border-gold/30 space-y-2">
                          <p className="text-sm font-medium text-card-foreground">{kpi.name}</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] uppercase text-muted-foreground block mb-1">Actual</label>
                              <input type="number" value={editKPIValues.currentValue}
                                onChange={(e) => setEditKPIValues((v) => ({ ...v, currentValue: Number(e.target.value) }))}
                                className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-card-foreground outline-none focus:border-gold" />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase text-muted-foreground block mb-1">Meta</label>
                              <input type="number" value={editKPIValues.targetValue}
                                onChange={(e) => setEditKPIValues((v) => ({ ...v, targetValue: Number(e.target.value) }))}
                                className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-card-foreground outline-none focus:border-gold" />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase text-muted-foreground block mb-1">Tendencia</label>
                              <select value={editKPIValues.trend}
                                onChange={(e) => setEditKPIValues((v) => ({ ...v, trend: e.target.value }))}
                                className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-card-foreground outline-none focus:border-gold">
                                <option value="up">↑ Subiendo</option>
                                <option value="down">↓ Bajando</option>
                                <option value="stable">→ Estable</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingKPIId(null)} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                            <button onClick={() => handleSaveDeptKPI(kpi.id)} className="p-1.5 rounded bg-gold/20 text-gold hover:bg-gold/30"><Save className="h-4 w-4" /></button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={kpi.id} className="bg-muted/30 rounded-lg p-3 group">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-card-foreground">{kpi.name}</p>
                            <TrendIcon trend={kpi.trend} />
                          </div>
                          {canEditDeptKPI(user, kpi.department) && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditingKPIId(kpi.id); setEditKPIValues({ currentValue: kpi.currentValue, targetValue: kpi.targetValue, trend: kpi.trend }); }}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-gold"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => { deleteDeptKPI(kpi.id); toast.success("Indicador eliminado"); }}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{kpi.description}</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, pct)}%`,
                                backgroundColor: pct >= 80 ? "hsl(160, 60%, 40%)" : pct >= 50 ? "hsl(42, 100%, 50%)" : "hsl(0, 60%, 50%)",
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold text-card-foreground whitespace-nowrap">
                            {kpi.currentValue}{kpi.unit === "%" ? "%" : ""} / {kpi.targetValue}{kpi.unit === "%" ? "%" : ` ${kpi.unit}`}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Actualizado: {kpi.updatedAt} por {kpi.updatedBy}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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

        {/* ═══ Editable BASC Objectives ═══ */}
        <div className="px-6 pb-6">
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-heading font-bold text-card-foreground mb-4 flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-gold" /> Objetivos BASC
              {isEditor && <span className="text-[10px] text-muted-foreground font-normal ml-2">Haz clic en ✏️ para editar</span>}
            </h3>
            <div className="space-y-3">
              {objectives.map((obj) =>
                editingObjId === obj.id ? (
                  <BASCObjectiveEditRow key={obj.id} obj={obj} onSave={handleSaveObjective} onCancel={() => setEditingObjId(null)} />
                ) : (
                  <div key={obj.id} className="bg-muted/30 rounded-xl p-4 flex items-center justify-between gap-4 group">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{obj.code}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          obj.compliancePercent >= 80 ? "bg-emerald-500/10 text-emerald-500"
                            : obj.compliancePercent >= 50 ? "bg-gold/10 text-gold"
                              : "bg-destructive/10 text-destructive"
                        }`}>
                          {obj.compliancePercent}%
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          obj.status === "cumplido" ? "bg-emerald-500/10 text-emerald-500"
                            : obj.status === "en_progreso" ? "bg-blue-500/10 text-blue-500"
                              : obj.status === "vencido" ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground"
                        }`}>
                          {obj.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-card-foreground">{obj.title}</p>
                      <p className="text-xs text-muted-foreground">{obj.responsible} · {obj.department} · Meta: {obj.targetDate}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{obj.evidences.length} evidencias</p>
                        <div className="w-20 h-2 bg-card rounded-full mt-1">
                          <div className="h-full rounded-full" style={{
                            width: `${obj.compliancePercent}%`,
                            backgroundColor: obj.compliancePercent >= 80 ? "hsl(160, 60%, 40%)" : obj.compliancePercent >= 50 ? "hsl(42, 100%, 50%)" : "hsl(0, 60%, 50%)",
                          }} />
                        </div>
                      </div>
                      {isEditor && (
                        <button
                          onClick={() => setEditingObjId(obj.id)}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
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
                        <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-semibold">{obj.compliancePercent}%</span>
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
