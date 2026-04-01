import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Clock, BarChart3, AlertTriangle, Zap } from "lucide-react";
import type { TechTask } from "@/lib/techTaskTypes";
import { TASK_TYPE_LABELS, TASK_TYPE_COLORS } from "@/lib/techTaskTypes";

interface TaskDashboardProps {
  tasks: TechTask[];
}

const TaskDashboard = ({ tasks }: TaskDashboardProps) => {
  const last7Days = useMemo(() => {
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }, []);

  // Bar chart: tasks by type in last 7 days
  const barData = useMemo(() => {
    const recent = tasks.filter((t) => last7Days.includes(t.date));
    return last7Days.map((date) => {
      const dayTasks = recent.filter((t) => t.date === date);
      const label = new Date(date + "T12:00:00").toLocaleDateString("es-DO", { weekday: "short", day: "numeric" });
      return {
        date: label,
        tecnica: dayTasks.filter((t) => t.type === "tecnica").length,
        coordinacion: dayTasks.filter((t) => t.type === "coordinacion").length,
        gestion: dayTasks.filter((t) => t.type === "gestion").length,
        reunion: dayTasks.filter((t) => t.type === "reunion").length,
      };
    });
  }, [tasks, last7Days]);

  // Pie chart: time by type
  const pieData = useMemo(() => {
    const byType: Record<string, number> = {};
    tasks.forEach((t) => {
      byType[t.type] = (byType[t.type] || 0) + t.timeSpent;
    });
    return Object.entries(byType).map(([type, value]) => ({
      name: TASK_TYPE_LABELS[type as keyof typeof TASK_TYPE_LABELS],
      value,
      color: TASK_TYPE_COLORS[type as keyof typeof TASK_TYPE_COLORS],
    }));
  }, [tasks]);

  // Avg time per type
  const avgTime = useMemo(() => {
    const byType: Record<string, { total: number; count: number }> = {};
    tasks.forEach((t) => {
      if (!byType[t.type]) byType[t.type] = { total: 0, count: 0 };
      byType[t.type].total += t.timeSpent;
      byType[t.type].count++;
    });
    return Object.entries(byType).map(([type, data]) => ({
      type: TASK_TYPE_LABELS[type as keyof typeof TASK_TYPE_LABELS],
      avg: Math.round(data.total / data.count),
      color: TASK_TYPE_COLORS[type as keyof typeof TASK_TYPE_COLORS],
    }));
  }, [tasks]);

  // Context switches: consecutive short tasks (< 10 min)
  const contextSwitches = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTasks = tasks.filter((t) => t.date === todayStr).sort((a, b) => a.startTime.localeCompare(b.startTime));
    let switches = 0;
    for (let i = 1; i < todayTasks.length; i++) {
      if (todayTasks[i].timeSpent <= 10 && todayTasks[i - 1].timeSpent <= 10 && todayTasks[i].type !== todayTasks[i - 1].type) {
        switches++;
      }
    }
    return switches;
  }, [tasks]);

  const pendingCount = tasks.filter((t) => t.status !== "completada").length;
  const totalToday = tasks.filter((t) => t.date === new Date().toISOString().slice(0, 10)).length;
  const totalTimeToday = tasks.filter((t) => t.date === new Date().toISOString().slice(0, 10)).reduce((s, t) => s + t.timeSpent, 0);

  const barConfig = {
    tecnica: { label: "Técnica", color: TASK_TYPE_COLORS.tecnica },
    coordinacion: { label: "Coordinación", color: TASK_TYPE_COLORS.coordinacion },
    gestion: { label: "Gestión", color: TASK_TYPE_COLORS.gestion },
    reunion: { label: "Reunión", color: TASK_TYPE_COLORS.reunion },
  };

  const pieConfig = pieData.reduce((acc, d) => {
    acc[d.name] = { label: d.name, color: d.color };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{totalToday}</p>
            <p className="text-xs text-muted-foreground">Tareas Hoy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{totalTimeToday} min</p>
            <p className="text-xs text-muted-foreground">Tiempo Invertido Hoy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pendientes Abiertas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Zap className={`w-5 h-5 ${contextSwitches > 3 ? "text-amber-500" : "text-emerald-500"}`} />
              <p className="text-2xl font-bold text-foreground">{contextSwitches}</p>
            </div>
            <p className="text-xs text-muted-foreground">Cambios de Contexto</p>
            {contextSwitches > 3 && <p className="text-xs text-amber-500 mt-1">Considera agrupar tareas</p>}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Tareas por Tipo (Últimos 7 Días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barConfig} className="h-[250px] w-full">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="tecnica" stackId="a" fill={TASK_TYPE_COLORS.tecnica} radius={[0, 0, 0, 0]} />
                <Bar dataKey="coordinacion" stackId="a" fill={TASK_TYPE_COLORS.coordinacion} />
                <Bar dataKey="gestion" stackId="a" fill={TASK_TYPE_COLORS.gestion} />
                <Bar dataKey="reunion" stackId="a" fill={TASK_TYPE_COLORS.reunion} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Distribución de Tiempo por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={pieConfig} className="h-[250px] w-full">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}m`}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Avg time per type */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-primary" /> Tiempo Promedio por Tipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {avgTime.map((item) => (
              <div key={item.type} className="text-center p-3 rounded-lg bg-muted">
                <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ backgroundColor: item.color }} />
                <p className="text-lg font-bold">{item.avg} min</p>
                <p className="text-xs text-muted-foreground">{item.type}</p>
              </div>
            ))}
            {avgTime.length === 0 && <p className="text-sm text-muted-foreground col-span-4 text-center py-4">Sin datos aún</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskDashboard;
