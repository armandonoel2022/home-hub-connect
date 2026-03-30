import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { isApiConfigured, processesApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronDown, ChevronRight, Plus, Trash2, Edit, Save, X,
  AlertTriangle, CheckCircle2, ListChecks, Filter, ArrowLeft,
} from "lucide-react";

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

interface DeptProcess {
  id: string;
  department: string;
  name: string;
  objective: string;
  criticality: number;
  checklist: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

const CRITICALITY_LABELS: Record<number, string> = {
  1: "Muy Bajo", 2: "Menor", 3: "Moderado", 4: "Alto", 5: "Crítico",
};
const CRITICALITY_COLORS: Record<number, string> = {
  1: "bg-muted text-muted-foreground",
  2: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  3: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  4: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  5: "bg-destructive/15 text-destructive",
};

const DEPARTMENTS_WITH_PROCESSES = [
  "Recursos Humanos", "Gerencia Comercial", "Administración",
  "Tecnología y Monitoreo", "Seguridad Electrónica",
];

const DepartmentProcesses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deptParam = searchParams.get("dept") || "";
  const apiMode = isApiConfigured();

  const [processes, setProcesses] = useState<DeptProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState(deptParam || "");
  const [critFilter, setCritFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingChecklist, setEditingChecklist] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [showAddProcess, setShowAddProcess] = useState(false);
  const [newProcess, setNewProcess] = useState({ name: "", objective: "", criticality: 4, department: "" });

  const isAdminOrLeader = user?.isAdmin || user?.isDepartmentLeader;

  // Determine which departments the user can see
  const availableDepts = user?.isAdmin
    ? DEPARTMENTS_WITH_PROCESSES
    : DEPARTMENTS_WITH_PROCESSES.filter(d => d === user?.department);

  useEffect(() => {
    if (!selectedDept && availableDepts.length > 0) {
      setSelectedDept(availableDepts[0]);
    }
  }, [availableDepts, selectedDept]);

  useEffect(() => {
    if (!selectedDept || !apiMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    processesApi.getByDepartment(selectedDept)
      .then(setProcesses)
      .catch(() => toast({ title: "Error cargando procesos", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [selectedDept, apiMode]);

  const filteredProcesses = processes.filter(p =>
    critFilter === "all" || p.criticality === Number(critFilter)
  );

  const handleToggleCheckItem = async (procId: string, itemId: string) => {
    const proc = processes.find(p => p.id === procId);
    if (!proc) return;
    const updated = proc.checklist.map(c =>
      c.id === itemId
        ? { ...c, completed: !c.completed, completedBy: user?.fullName, completedAt: new Date().toISOString() }
        : c
    );
    try {
      await processesApi.updateChecklist(procId, updated);
      setProcesses(prev => prev.map(p => p.id === procId ? { ...p, checklist: updated } : p));
    } catch {
      toast({ title: "Error actualizando checklist", variant: "destructive" });
    }
  };

  const handleAddCheckItem = async (procId: string) => {
    if (!newItemText.trim()) return;
    const proc = processes.find(p => p.id === procId);
    if (!proc) return;
    const newItem: ChecklistItem = {
      id: `CHK-${Date.now()}`,
      text: newItemText.trim(),
      completed: false,
    };
    const updated = [...proc.checklist, newItem];
    try {
      await processesApi.updateChecklist(procId, updated);
      setProcesses(prev => prev.map(p => p.id === procId ? { ...p, checklist: updated } : p));
      setNewItemText("");
    } catch {
      toast({ title: "Error agregando item", variant: "destructive" });
    }
  };

  const handleDeleteCheckItem = async (procId: string, itemId: string) => {
    const proc = processes.find(p => p.id === procId);
    if (!proc) return;
    const updated = proc.checklist.filter(c => c.id !== itemId);
    try {
      await processesApi.updateChecklist(procId, updated);
      setProcesses(prev => prev.map(p => p.id === procId ? { ...p, checklist: updated } : p));
    } catch {
      toast({ title: "Error eliminando item", variant: "destructive" });
    }
  };

  const handleAddProcess = async () => {
    if (!newProcess.name.trim()) return;
    try {
      const created = await processesApi.create({
        ...newProcess,
        department: newProcess.department || selectedDept,
      });
      setProcesses(prev => [...prev, created]);
      setShowAddProcess(false);
      setNewProcess({ name: "", objective: "", criticality: 4, department: "" });
      toast({ title: "Proceso creado exitosamente" });
    } catch {
      toast({ title: "Error creando proceso", variant: "destructive" });
    }
  };

  const handleDeleteProcess = async (id: string) => {
    if (!confirm("¿Eliminar este proceso permanentemente?")) return;
    try {
      await processesApi.delete(id);
      setProcesses(prev => prev.filter(p => p.id !== id));
      toast({ title: "Proceso eliminado" });
    } catch {
      toast({ title: "Error eliminando proceso", variant: "destructive" });
    }
  };

  const critStats = {
    critical: processes.filter(p => p.criticality === 5).length,
    high: processes.filter(p => p.criticality === 4).length,
    moderate: processes.filter(p => p.criticality <= 3).length,
    total: processes.length,
  };

  if (!apiMode) {
    return (
      <AppLayout>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <div className="flex-1 flex items-center justify-center">
            <Card className="max-w-md">
              <CardContent className="pt-6 text-center">
                <AlertTriangle className="h-12 w-12 text-primary mx-auto mb-4" />
                <h2 className="text-lg font-heading font-bold mb-2">API No Configurada</h2>
                <p className="text-muted-foreground text-sm">
                  La Matriz de Procesos requiere conexión al servidor backend.
                </p>
              </CardContent>
            </Card>
          </div>
          <Footer />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 w-full py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
                <ListChecks className="h-6 w-6 text-primary" />
                Matriz de Procesos
              </h1>
              <p className="text-sm text-muted-foreground">Checklist operativo por departamento</p>
            </div>
            {isAdminOrLeader && (
              <Button onClick={() => setShowAddProcess(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Nuevo Proceso
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Seleccionar departamento" />
              </SelectTrigger>
              <SelectContent>
                {availableDepts.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={critFilter} onValueChange={setCritFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Criticidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="5">Crítico</SelectItem>
                <SelectItem value="4">Alto</SelectItem>
                <SelectItem value="3">Moderado</SelectItem>
                <SelectItem value="2">Menor</SelectItem>
                <SelectItem value="1">Muy Bajo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Card>
              <CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-heading font-bold text-foreground">{critStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Procesos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-heading font-bold text-destructive">{critStats.critical}</p>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-heading font-bold text-orange-500">{critStats.high}</p>
                <p className="text-xs text-muted-foreground">Altos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-heading font-bold text-green-600">{critStats.moderate}</p>
                <p className="text-xs text-muted-foreground">Moderados</p>
              </CardContent>
            </Card>
          </div>

          {/* Processes Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Cargando procesos...</p>
            </div>
          ) : filteredProcesses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ListChecks className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay procesos para este filtro.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredProcesses.map(proc => {
                const isExpanded = expandedId === proc.id;
                const completedCount = proc.checklist.filter(c => c.completed).length;
                const totalItems = proc.checklist.length;
                const progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

                return (
                  <Card key={proc.id} className="overflow-hidden">
                    {/* Process Row */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : proc.id)}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{proc.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{proc.objective}</p>
                      </div>
                      <Badge className={`${CRITICALITY_COLORS[proc.criticality]} text-xs shrink-0`}>
                        {CRITICALITY_LABELS[proc.criticality]}
                      </Badge>
                      {totalItems > 0 && (
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">{completedCount}/{totalItems}</span>
                        </div>
                      )}
                      {isAdminOrLeader && user?.isAdmin && (
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                          onClick={(e) => { e.stopPropagation(); handleDeleteProcess(proc.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>

                    {/* Expanded Checklist */}
                    {isExpanded && (
                      <div className="border-t px-4 py-3 bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            Checklist Operativo
                          </h4>
                          {isAdminOrLeader && (
                            <Button
                              variant="outline" size="sm"
                              onClick={() => setEditingChecklist(editingChecklist === proc.id ? null : proc.id)}
                            >
                              {editingChecklist === proc.id ? <X className="h-3 w-3 mr-1" /> : <Edit className="h-3 w-3 mr-1" />}
                              {editingChecklist === proc.id ? "Cerrar" : "Editar"}
                            </Button>
                          )}
                        </div>

                        {proc.checklist.length === 0 && editingChecklist !== proc.id && (
                          <p className="text-xs text-muted-foreground italic py-2">
                            No hay items en el checklist. {isAdminOrLeader ? "Haz clic en 'Editar' para agregar." : ""}
                          </p>
                        )}

                        <div className="space-y-1.5">
                          {proc.checklist.map(item => (
                            <div key={item.id} className="flex items-center gap-2 group">
                              <Checkbox
                                checked={item.completed}
                                onCheckedChange={() => handleToggleCheckItem(proc.id, item.id)}
                                disabled={!isAdminOrLeader}
                              />
                              <span className={`text-sm flex-1 ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {item.text}
                              </span>
                              {item.completed && item.completedBy && (
                                <span className="text-xs text-muted-foreground">✓ {item.completedBy}</span>
                              )}
                              {editingChecklist === proc.id && (
                                <Button
                                  variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                  onClick={() => handleDeleteCheckItem(proc.id, item.id)}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>

                        {editingChecklist === proc.id && (
                          <div className="flex gap-2 mt-3">
                            <Input
                              placeholder="Nuevo item del checklist..."
                              value={newItemText}
                              onChange={(e) => setNewItemText(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleAddCheckItem(proc.id)}
                              className="text-sm"
                            />
                            <Button size="sm" onClick={() => handleAddCheckItem(proc.id)}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </main>
        <Footer />
      </div>

      {/* Add Process Dialog */}
      <Dialog open={showAddProcess} onOpenChange={setShowAddProcess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Proceso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Departamento</label>
              <Select value={newProcess.department || selectedDept} onValueChange={(v) => setNewProcess(p => ({ ...p, department: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableDepts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Nombre del Proceso</label>
              <Input value={newProcess.name} onChange={(e) => setNewProcess(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Objetivo</label>
              <Textarea value={newProcess.objective} onChange={(e) => setNewProcess(p => ({ ...p, objective: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Criticidad</label>
              <Select value={String(newProcess.criticality)} onValueChange={(v) => setNewProcess(p => ({ ...p, criticality: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5,4,3,2,1].map(n => <SelectItem key={n} value={String(n)}>{CRITICALITY_LABELS[n]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProcess(false)}>Cancelar</Button>
            <Button onClick={handleAddProcess}>Crear Proceso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default DepartmentProcesses;
