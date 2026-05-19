/**
 * Pestaña "Operadores" — asignación de LX al personal del centro de monitoreo.
 *
 * - Día: Brandon Díaz y César Pérez (cuentas con cierre 07:00–18:59)
 * - Noche: Alejandro Alcántara + Bradelin Almonte comparten siempre el listado nocturno
 *
 * La asignación se persiste en `monitoringAccountSettings.operatorId` y se calcula
 * sugerencia automática a partir de `expectedOpen`/`expectedClose` cuando una LX
 * aún no tiene operador asignado.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, Sun, Moon, Wand2, Search, UserCheck } from "lucide-react";
import {
  monitoringAccountSettingsApi, type MonitoringAccountSetting,
} from "@/lib/api";
import {
  MONITORING_OPERATORS, DAY_OPERATORS, NIGHT_OPERATORS, NIGHT_SHARED_LABEL,
  suggestOperator, isSharedNight, getOperator,
} from "@/lib/monitoringOperators";

interface Bucket {
  key: string;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  shift: "day" | "night" | "none";
  items: MonitoringAccountSetting[];
}

const NIGHT_KEY = "OP-NIGHT-SHARED";
const UNASSIGNED_KEY = "__none__";

export default function OperatorsTab() {
  const [settings, setSettings] = useState<MonitoringAccountSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const list = await monitoringAccountSettingsApi.list();
      setSettings(list);
    } catch (e: any) {
      if (e.message !== "API_NOT_CONFIGURED") toast.error(`No se pudo cargar: ${e.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const reassign = async (s: MonitoringAccountSetting, newOperatorId: string | null) => {
    try {
      const saved = await monitoringAccountSettingsApi.upsert(s.accountCode, {
        ...s, operatorId: newOperatorId,
      });
      setSettings(prev => prev.map(x => x.accountCode === s.accountCode ? saved : x));
    } catch (e: any) {
      toast.error(`Error al reasignar: ${e.message}`);
    }
  };

  const autoAssignAll = async () => {
    const targets = settings.filter(s => !s.operatorId);
    if (targets.length === 0) { toast.info("Todas las LX ya tienen operador asignado"); return; }
    let count = 0;
    for (const s of targets) {
      const opId = suggestOperator(s.accountCode, s.expectedOpen, s.expectedClose);
      if (!opId) continue;
      try {
        await monitoringAccountSettingsApi.upsert(s.accountCode, { ...s, operatorId: opId });
        count++;
      } catch {}
    }
    toast.success(`Sugerencia aplicada a ${count} LX`);
    await load();
  };

  const filterMatch = (s: MonitoringAccountSetting) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.accountCode || "").includes(q) ||
           (s.accountName || "").toLowerCase().includes(q);
  };

  const buckets: Bucket[] = useMemo(() => {
    const list = settings.filter(filterMatch);
    const out: Bucket[] = [];
    DAY_OPERATORS.forEach(op => {
      out.push({
        key: op.id, label: op.name, icon: <Sun className="h-3.5 w-3.5" />,
        colorClass: op.color, shift: "day",
        items: list.filter(s => s.operatorId === op.id),
      });
    });
    out.push({
      key: NIGHT_KEY, label: NIGHT_SHARED_LABEL,
      icon: <Moon className="h-3.5 w-3.5" />,
      colorClass: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
      shift: "night",
      items: list.filter(s => isSharedNight(s.operatorId)),
    });
    out.push({
      key: UNASSIGNED_KEY, label: "Sin asignar",
      icon: <Users className="h-3.5 w-3.5" />,
      colorClass: "text-muted-foreground border-border bg-muted/30",
      shift: "none",
      items: list.filter(s => !s.operatorId),
    });
    return out;
  }, [settings, search]);

  const stats = useMemo(() => {
    const total = settings.length;
    const assigned = settings.filter(s => !!s.operatorId).length;
    const day = settings.filter(s => {
      const op = getOperator(s.operatorId);
      return op?.shift === "day";
    }).length;
    const night = settings.filter(s => isSharedNight(s.operatorId)).length;
    const unassigned = total - assigned;
    return { total, assigned, day, night, unassigned };
  }, [settings]);

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" /> Asignación de operadores
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.assigned}/{stats.total} LX asignadas · Día: {stats.day} · Noche: {stats.night} · Sin asignar: {stats.unassigned}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar cuenta..." className="pl-7 h-8 w-48" />
              </div>
              <Button size="sm" variant="outline" onClick={autoAssignAll} disabled={loading}>
                <Wand2 className="h-3.5 w-3.5 mr-1" /> Sugerir por horario
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-muted-foreground">
            <strong>Día (07:00–18:59):</strong> Brandon Díaz y César Pérez ·{" "}
            <strong>Noche (19:00–06:59):</strong> Alejandro Alcántara y Bradelin Almonte
            (turno compartido). La sugerencia automática usa el horario de cierre
            esperado de cada LX y puede ajustarse manualmente debajo.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {buckets.map(b => (
          <Card key={b.key} className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className={`p-1 rounded ${b.colorClass}`}>{b.icon}</span>
                  {b.label}
                </CardTitle>
                <Badge variant="outline" className="text-xs">{b.items.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 max-h-[460px] overflow-y-auto">
              {b.items.length === 0 && (
                <p className="text-xs text-muted-foreground italic py-4 text-center">
                  Sin LX en este pool.
                </p>
              )}
              {b.items.map(s => (
                <div key={s.accountCode}
                  className="p-2 rounded-md border border-border bg-muted/20 hover:bg-muted/40 transition">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-muted-foreground">{s.accountCode}</p>
                      <p className="text-sm font-medium truncate">{s.accountName || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap text-[10px] text-muted-foreground mb-1">
                    {s.expectedOpen && <span>↑ {s.expectedOpen}</span>}
                    {s.expectedClose && <span>↓ {s.expectedClose}</span>}
                    {s.serviceType && <Badge variant="outline" className="text-[9px] h-4 px-1">{s.serviceType}</Badge>}
                  </div>
                  <Select value={s.operatorId || UNASSIGNED_KEY}
                    onValueChange={(v) => reassign(s, v === UNASSIGNED_KEY ? null : v)}>
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_KEY}>— Sin asignar —</SelectItem>
                      {DAY_OPERATORS.map(op => (
                        <SelectItem key={op.id} value={op.id}>☀️ {op.short}</SelectItem>
                      ))}
                      <SelectItem value={NIGHT_KEY}>🌙 Turno Nocturno (Alejandro + Bradelin)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
