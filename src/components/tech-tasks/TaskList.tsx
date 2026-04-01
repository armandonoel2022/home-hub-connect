import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Clock, AlertTriangle, Users, Search, Filter } from "lucide-react";
import { techTaskStorage } from "@/lib/techTaskStorage";
import type { TechTask, TaskType, TimeBlock } from "@/lib/techTaskTypes";
import { TASK_TYPE_LABELS, TASK_TYPE_BG, STATUS_LABELS, BLOCK_LABELS } from "@/lib/techTaskTypes";

interface TaskListProps {
  tasks: TechTask[];
  onRefresh: () => void;
}

const TaskList = ({ tasks, onRefresh }: TaskListProps) => {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDate, setFilterDate] = useState("");
  const [groupBy, setGroupBy] = useState<"block" | "type" | "none">("block");

  const filtered = useMemo(() => {
    let result = [...tasks];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) =>
        t.description.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q) ||
        t.thirdPartyName?.toLowerCase().includes(q)
      );
    }
    if (filterType !== "all") result = result.filter((t) => t.type === filterType);
    if (filterDate) result = result.filter((t) => t.date === filterDate);
    return result.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [tasks, search, filterType, filterDate]);

  const pendingTasks = useMemo(() =>
    tasks.filter((t) => t.status !== "completada"), [tasks]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return { "Todas las Tareas": filtered };
    const groups: Record<string, TechTask[]> = {};
    filtered.forEach((t) => {
      const key = groupBy === "block"
        ? (t.block === "personalizado" ? t.customBlockName || "Personalizado" : BLOCK_LABELS[t.block])
        : TASK_TYPE_LABELS[t.type];
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [filtered, groupBy]);

  const handleDelete = (id: string) => {
    techTaskStorage.delete(id);
    onRefresh();
  };

  const renderTask = (task: TechTask) => (
    <div key={task.id} className={`p-3 rounded-lg border bg-card space-y-2 ${task.dependsOnThirdParty ? "border-l-4 border-l-amber-500" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-xs ${TASK_TYPE_BG[task.type]}`}>
              {TASK_TYPE_LABELS[task.type]}
            </Badge>
            <Badge variant={task.status === "completada" ? "default" : "destructive"} className="text-xs">
              {task.status === "completada" ? "✓ Completada" : STATUS_LABELS[task.status]}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {task.startTime}{task.endTime ? ` – ${task.endTime}` : ""} ({task.timeSpent} min)
            </span>
          </div>
          <p className="text-sm font-medium mt-1">{task.description}</p>
          {task.statusDetail && (
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3 h-3" /> {task.statusDetail}
            </p>
          )}
          {task.dependsOnThirdParty && task.thirdPartyName && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Users className="w-3 h-3" /> Depende de: {task.thirdPartyName}
            </p>
          )}
          {task.notes && <p className="text-xs text-muted-foreground mt-1 italic">{task.notes}</p>}
          {task.decisions && (
            <div className="mt-1 p-2 bg-muted rounded text-xs">
              <strong>Decisiones:</strong> {task.decisions}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(task.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar tareas..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="w-36">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger><Filter className="w-3.5 h-3.5 mr-1" /><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input type="date" className="w-40" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Agrupar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="block">Por Bloque</SelectItem>
                <SelectItem value="type">Por Tipo</SelectItem>
                <SelectItem value="none">Sin Agrupar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todas ({filtered.length})</TabsTrigger>
          <TabsTrigger value="pending" className="text-destructive">
            Pendientes ({pendingTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-3">
          {Object.entries(grouped).map(([groupName, groupTasks]) => (
            <Card key={groupName}>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">{groupName} ({groupTasks.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4 pt-0">
                {groupTasks.map(renderTask)}
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No se encontraron tareas</p>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-2 mt-3">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Tareas Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 pt-0">
              {pendingTasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">¡No hay pendientes! 🎉</p>
              ) : (
                pendingTasks.map(renderTask)
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TaskList;
