import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { isApiConfigured, auditApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Shield, Search, Activity, Users, FileText, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  targetId?: string;
  targetName?: string;
  details: string;
  ip?: string;
  timestamp: string;
}

interface AuditStats {
  totalEntries: number;
  todayEntries: number;
  weekEntries: number;
  actionBreakdown: Record<string, number>;
}

const ACTION_LABELS: Record<string, string> = {
  create: "Creación", update: "Actualización", delete: "Eliminación",
  login: "Inicio de sesión", approve: "Aprobación", reject: "Rechazo",
  password_change: "Cambio de contraseña", password_reset: "Reset de contraseña",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800", update: "bg-blue-100 text-blue-800",
  delete: "bg-destructive/15 text-destructive", login: "bg-muted text-muted-foreground",
  approve: "bg-green-100 text-green-800", reject: "bg-destructive/15 text-destructive",
  password_change: "bg-yellow-100 text-yellow-800", password_reset: "bg-orange-100 text-orange-800",
};

const AuditLog = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const apiMode = isApiConfigured();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("all");
  const [filterModule, setFilterModule] = useState("all");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (!apiMode || !user?.isAdmin) { setLoading(false); return; }
    Promise.all([
      auditApi.getAll().catch(() => []),
      auditApi.getStats().catch(() => null),
    ]).then(([logsData, statsData]) => {
      setLogs(logsData);
      setStats(statsData);
    }).finally(() => setLoading(false));
  }, [apiMode, user]);

  if (!user?.isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <div className="flex-1 flex items-center justify-center">
            <Card className="max-w-md">
              <CardContent className="pt-6 text-center">
                <Lock className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h2 className="text-lg font-heading font-bold mb-2">Acceso Restringido</h2>
                <p className="text-muted-foreground text-sm">Solo administradores pueden ver el log de auditoría.</p>
              </CardContent>
            </Card>
          </div>
          <Footer />
        </div>
      </AppLayout>
    );
  }

  const filtered = logs.filter(l => {
    if (filterAction !== "all" && l.action !== filterAction) return false;
    if (filterModule !== "all" && l.module !== filterModule) return false;
    if (searchText && !l.userName?.toLowerCase().includes(searchText.toLowerCase()) && !l.details?.toLowerCase().includes(searchText.toLowerCase()) && !l.targetName?.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const modules = [...new Set(logs.map(l => l.module).filter(Boolean))];

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 w-full py-6">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" /> Auditoría del Sistema
              </h1>
              <p className="text-sm text-muted-foreground">Registro de acciones críticas</p>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Card><CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-heading font-bold">{stats.totalEntries}</p>
                <p className="text-xs text-muted-foreground">Total Registros</p>
              </CardContent></Card>
              <Card><CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-heading font-bold text-primary">{stats.todayEntries}</p>
                <p className="text-xs text-muted-foreground">Hoy</p>
              </CardContent></Card>
              <Card><CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-heading font-bold">{stats.weekEntries}</p>
                <p className="text-xs text-muted-foreground">Esta Semana</p>
              </CardContent></Card>
              <Card><CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-heading font-bold">{Object.keys(stats.actionBreakdown).length}</p>
                <p className="text-xs text-muted-foreground">Tipos de Acción</p>
              </CardContent></Card>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por usuario o detalle..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Acción" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                {Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Módulo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los módulos</SelectItem>
                {modules.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Log Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            </div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay registros de auditoría.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-1">
              {filtered.map(entry => (
                <Card key={entry.id} className="overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{entry.userName}</span>
                        <Badge className={`${ACTION_COLORS[entry.action] || "bg-muted text-muted-foreground"} text-xs`}>
                          {ACTION_LABELS[entry.action] || entry.action}
                        </Badge>
                        {entry.module && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{entry.module}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {entry.targetName && <span className="font-medium">{entry.targetName} — </span>}
                        {entry.details}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleDateString("es-DO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </AppLayout>
  );
};

export default AuditLog;
