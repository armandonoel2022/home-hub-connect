import { useState, useMemo } from "react";
import FixedAssetsManager from "@/components/admin/FixedAssetsManager";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Receipt, Banknote, Calculator, ShoppingCart, Package, FolderOpen,
  ChevronRight, CheckCircle2, Clock, AlertCircle, ClipboardList, Plus,
  FileText, Search, BarChart3, Trash2, Wrench,
} from "lucide-react";
import {
  ADMIN_CATEGORIES, ADMIN_PROCESSES,
  getAdminActivities, saveAdminActivity, deleteAdminActivity,
  getChecklistState, toggleChecklistItem,
  type AdminProcess, type AdminActivityEntry, type ChecklistState,
} from "@/lib/adminProcessData";

const CATEGORY_ICONS: Record<string, any> = {
  facturacion: Receipt,
  tesoreria: Banknote,
  contabilidad: Calculator,
  compras: ShoppingCart,
  activos: Package,
  documentacion: FolderOpen,
};

const AdminHub = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<AdminProcess | null>(null);
  const [showFixedAssets, setShowFixedAssets] = useState(false);
  const [checklistState, setChecklistState] = useState<ChecklistState>(getChecklistState);
  const [activities, setActivities] = useState<AdminActivityEntry[]>(getAdminActivities);
  const [newNote, setNewNote] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => {
    setActivities(getAdminActivities());
    setChecklistState(getChecklistState());
    setRefreshKey(k => k + 1);
  };

  // ── Stats per category ──
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number; processes: number }> = {};
    ADMIN_CATEGORIES.forEach(cat => {
      const procs = ADMIN_PROCESSES.filter(p => p.category === cat.key);
      let total = 0, completed = 0;
      procs.forEach(proc => {
        proc.checklist.forEach(item => {
          total++;
          if (checklistState[`${proc.id}_${item.id}`]?.completed) completed++;
        });
      });
      stats[cat.key] = { total, completed, processes: procs.length };
    });
    return stats;
  }, [checklistState, refreshKey]);

  // ── Search across processes ──
  const filteredProcesses = useMemo(() => {
    if (!searchTerm.trim()) return null;
    const term = searchTerm.toLowerCase();
    return ADMIN_PROCESSES.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.checklist.some(c => c.text.toLowerCase().includes(term))
    );
  }, [searchTerm]);

  const handleToggleChecklist = (processId: string, itemId: string) => {
    const newState = toggleChecklistItem(processId, itemId, user?.fullName || "Sistema");
    setChecklistState({ ...newState });
  };

  const handleAddActivity = (processId: string) => {
    if (!newNote.trim()) return;
    saveAdminActivity({
      processId,
      note: newNote.trim(),
      completedBy: user?.fullName || "Sistema",
      completedAt: new Date().toISOString(),
      status: "completado",
    });
    setNewNote("");
    refresh();
    toast({ title: "✅ Actividad registrada" });
  };

  const handleDeleteActivity = (activityId: string) => {
    deleteAdminActivity(activityId);
    refresh();
  };

  const processActivities = (processId: string) =>
    activities.filter(a => a.processId === processId);

  // ── Fixed Assets view ──
  if (showFixedAssets) {
    return (
      <AppLayout>
        <Navbar />
        <main className="flex-1 bg-background min-h-screen">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <Button variant="ghost" onClick={() => setShowFixedAssets(false)} className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" /> Volver al Hub
            </Button>
            <FixedAssetsManager onBack={() => setShowFixedAssets(false)} />
          </div>
        </main>
        <Footer />
      </AppLayout>
    );
  }

  // ── Process detail view ──
  if (selectedProcess) {
    const proc = selectedProcess;
    const pActivities = processActivities(proc.id);
    const completedCount = proc.checklist.filter(
      item => checklistState[`${proc.id}_${item.id}`]?.completed
    ).length;
    const progress = proc.checklist.length > 0
      ? Math.round((completedCount / proc.checklist.length) * 100)
      : 0;

    return (
      <AppLayout>
        <Navbar />
        <main className="flex-1 bg-background min-h-screen">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            <Button variant="ghost" onClick={() => setSelectedProcess(null)} className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" /> Volver a {ADMIN_CATEGORIES.find(c => c.key === proc.category)?.label}
            </Button>

            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{proc.name}</h1>
                <Badge variant="outline" className="mt-1">
                  {ADMIN_CATEGORIES.find(c => c.key === proc.category)?.label}
                </Badge>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold" style={{ color: progress === 100 ? "hsl(142 70% 45%)" : "hsl(42 100% 50%)" }}>
                  {progress}%
                </div>
                <p className="text-xs text-muted-foreground">{completedCount}/{proc.checklist.length} pasos</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-muted mb-8">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: progress === 100 ? "hsl(142 70% 45%)" : "var(--gradient-gold, hsl(42 100% 50%))",
                }}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Checklist */}
              <div className="border rounded-xl p-5 bg-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Checklist Operativo
                </h2>
                <div className="space-y-3">
                  {proc.checklist.map(item => {
                    const key = `${proc.id}_${item.id}`;
                    const state = checklistState[key];
                    return (
                      <div key={item.id} className="flex items-start gap-3 group">
                        <Checkbox
                          checked={!!state?.completed}
                          onCheckedChange={() => handleToggleChecklist(proc.id, item.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm", state?.completed && "line-through text-muted-foreground")}>
                            {item.text}
                          </p>
                          {state?.completed && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              ✓ {state.completedBy} — {format(new Date(state.completedAt), "dd MMM yyyy HH:mm", { locale: es })}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Activity log */}
              <div className="border rounded-xl p-5 bg-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Registro de Actividades
                </h2>

                <div className="flex gap-2 mb-4">
                  <Textarea
                    placeholder="Registrar actividad o nota..."
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    className="text-sm min-h-[60px]"
                  />
                  <Button size="sm" onClick={() => handleAddActivity(proc.id)} disabled={!newNote.trim()} className="self-end">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {pActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No hay actividades registradas</p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {pActivities.map(act => (
                      <div key={act.id} className="border rounded-lg p-3 text-sm group relative">
                        <div className="flex items-start justify-between">
                          <p className="text-foreground">{act.note}</p>
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={() => handleDeleteActivity(act.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {act.completedBy} — {format(new Date(act.completedAt), "dd MMM yyyy HH:mm", { locale: es })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </AppLayout>
    );
  }

  // ── Category detail view ──
  if (selectedCategory) {
    const cat = ADMIN_CATEGORIES.find(c => c.key === selectedCategory)!;
    const procs = ADMIN_PROCESSES.filter(p => p.category === selectedCategory);
    const CatIcon = CATEGORY_ICONS[selectedCategory] || FolderOpen;

    return (
      <AppLayout>
        <Navbar />
        <main className="flex-1 bg-background min-h-screen">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            <Button variant="ghost" onClick={() => setSelectedCategory(null)} className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" /> Volver al Hub
            </Button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl" style={{ background: cat.color }}>
                <CatIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{cat.label}</h1>
                <p className="text-sm text-muted-foreground">{procs.length} procesos</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {procs.map(proc => {
                const completedCount = proc.checklist.filter(
                  item => checklistState[`${proc.id}_${item.id}`]?.completed
                ).length;
                const progress = proc.checklist.length > 0
                  ? Math.round((completedCount / proc.checklist.length) * 100)
                  : 0;
                const actCount = processActivities(proc.id).length;

                return (
                  <button
                    key={proc.id}
                    onClick={() => {
                      if (proc.name === "Gestión de activos fijos") {
                        setShowFixedAssets(true);
                      } else {
                        setSelectedProcess(proc);
                      }
                    }}
                    className="border rounded-xl p-4 bg-card text-left hover:border-primary/50 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors leading-tight">
                        {proc.name}
                      </h3>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5" />
                    </div>

                    {/* Mini progress */}
                    <div className="w-full h-1.5 rounded-full bg-muted mb-2">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          background: progress === 100 ? "hsl(142 70% 45%)" : cat.color,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {progress === 100 ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : progress > 0 ? (
                          <Clock className="h-3 w-3 text-yellow-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-muted-foreground" />
                        )}
                        {completedCount}/{proc.checklist.length} pasos
                      </span>
                      {actCount > 0 && (
                        <span>{actCount} actividad{actCount !== 1 ? "es" : ""}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </main>
        <Footer />
      </AppLayout>
    );
  }

  // ── Main dashboard ──
  const processesToShow = filteredProcesses || [];

  return (
    <AppLayout>
      <Navbar />
      <main className="flex-1 bg-background min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Hub de Administración</h1>
              <p className="text-sm text-muted-foreground">Gestión integral de los procesos administrativos</p>
            </div>
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2 mt-4 mb-6">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/formularios")} className="gap-2">
              <FileText className="h-4 w-4" />
              Órdenes de Compra / Servicio
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/gastos-menores")} className="gap-2">
              <Receipt className="h-4 w-4" />
              Gastos Menores
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/flotilla-mantenimiento")} className="gap-2">
              <Wrench className="h-4 w-4" />
              Flotilla — Mantenimiento
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar procesos o actividades..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Search results */}
          {filteredProcesses && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                {processesToShow.length} resultado{processesToShow.length !== 1 ? "s" : ""}
              </h2>
              {processesToShow.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {processesToShow.map(proc => {
                    const cat = ADMIN_CATEGORIES.find(c => c.key === proc.category);
                    return (
                      <button
                        key={proc.id}
                        onClick={() => {
                          if (proc.name === "Gestión de activos fijos") {
                            setShowFixedAssets(true); setSearchTerm("");
                          } else {
                            setSelectedProcess(proc); setSearchTerm("");
                          }
                        }}
                        className="border rounded-lg p-3 bg-card text-left hover:border-primary/50 transition-all"
                      >
                        <p className="font-medium text-sm">{proc.name}</p>
                        <Badge variant="secondary" className="mt-1 text-[10px]">{cat?.label}</Badge>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No se encontraron procesos.</p>
              )}
            </div>
          )}

          {/* Category grid */}
          {!filteredProcesses && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {ADMIN_CATEGORIES.map(cat => {
                const stats = categoryStats[cat.key];
                const CatIcon = CATEGORY_ICONS[cat.key] || FolderOpen;
                const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className="border-2 rounded-xl overflow-hidden bg-card text-left hover:shadow-lg transition-all group"
                    style={{ borderColor: cat.color + "40" }}
                  >
                    <div className="px-5 py-4 flex items-center gap-4" style={{ background: cat.color }}>
                      <div className="p-2.5 rounded-xl bg-white/20">
                        <CatIcon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-sm truncate">{cat.label}</h3>
                        <p className="text-white/80 text-xs">{stats.processes} procesos</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-white/70 group-hover:text-white transition-colors" />
                    </div>

                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>Progreso general</span>
                        <span className="font-semibold" style={{ color: cat.color }}>{progress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%`, background: cat.color }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                        <span>{stats.completed}/{stats.total} pasos completados</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </AppLayout>
  );
};

export default AdminHub;
