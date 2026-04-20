import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, KeyRound, Search, Edit2, Trash2, History as HistoryIcon,
  ShieldCheck, UserCheck, Copy as CopyIcon, AlertTriangle, Link2, Eye,
  FileText, Printer,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  type KeyRecord, type KeyEstado, type KeyHistorialAccion,
  TIPOS_CERRADURA, ESTADOS_LLAVE, ACCIONES_HISTORIAL,
  loadKeys, createKey, updateKey, deleteKey, addHistory,
  computeKPIs, isRevisionVigente, nextRevisionDate,
} from "@/lib/keysData";
import {
  loadFixedAssets, UBICACIONES, DEPARTAMENTOS, type FixedAsset,
} from "@/lib/fixedAssetsData";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onBack: () => void;
}

const EMPTY_FORM: Partial<KeyRecord> = {
  estado: "asignada",
  tieneCopia: false,
  cantidadCopias: 0,
  frecuenciaDias: 90,
};

export default function KeysManager({ onBack }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [filterUbic, setFilterUbic] = useState<string>("all");
  const [showOnlyVencidas, setShowOnlyVencidas] = useState(false);

  const [form, setForm] = useState<Partial<KeyRecord> | null>(null);
  const [historyOf, setHistoryOf] = useState<KeyRecord | null>(null);
  const [newHist, setNewHist] = useState<{ accion: KeyHistorialAccion; persona: string; motivo: string }>({
    accion: "entrega", persona: "", motivo: "",
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadKeys(), loadFixedAssets()]).then(([k, a]) => {
      setKeys(k); setAssets(a); setLoading(false);
    });
  }, []);

  const refresh = async () => setKeys(await loadKeys());

  const kpis = useMemo(() => computeKPIs(keys), [keys]);

  const filtered = useMemo(() => {
    let list = [...keys];
    if (filterEstado !== "all") list = list.filter(k => k.estado === filterEstado);
    if (filterUbic !== "all") list = list.filter(k => k.ubicacion === filterUbic);
    if (showOnlyVencidas) list = list.filter(k => !isRevisionVigente(k));
    if (search.trim()) {
      const t = search.toLowerCase();
      list = list.filter(k =>
        k.id.toLowerCase().includes(t) ||
        k.code.toLowerCase().includes(t) ||
        k.descripcion.toLowerCase().includes(t) ||
        k.responsable.toLowerCase().includes(t) ||
        k.perteneceA.toLowerCase().includes(t) ||
        k.linkedAssetId.toLowerCase().includes(t)
      );
    }
    return list;
  }, [keys, filterEstado, filterUbic, showOnlyVencidas, search]);

  // ── Save form ──
  const handleSave = async () => {
    if (!form) return;
    if (!form.descripcion?.trim()) {
      toast({ title: "⚠️ Descripción requerida", variant: "destructive" });
      return;
    }
    try {
      if (form.id) {
        await updateKey(form.id, form);
        toast({ title: `✅ Llave ${form.id} actualizada` });
      } else {
        const created = await createKey(form);
        toast({ title: `✅ Llave ${created.id} registrada` });
      }
      setForm(null);
      await refresh();
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e?.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteKey(id);
      toast({ title: "🗑️ Llave eliminada" });
      setDeleteId(null);
      await refresh();
    } catch (e: any) {
      toast({ title: "Error al eliminar", description: e?.message, variant: "destructive" });
    }
  };

  const handleAddHistory = async () => {
    if (!historyOf) return;
    if (!newHist.persona.trim()) {
      toast({ title: "⚠️ Indica la persona", variant: "destructive" });
      return;
    }
    try {
      const updated = await addHistory(historyOf.id, {
        fecha: new Date().toISOString(),
        accion: newHist.accion,
        persona: newHist.persona,
        motivo: newHist.motivo,
        registradoPor: user?.fullName || user?.email,
      });
      setHistoryOf(updated);
      setNewHist({ accion: "entrega", persona: "", motivo: "" });
      await refresh();
      toast({ title: "✅ Movimiento registrado" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    }
  };

  const linkedLabel = (k: KeyRecord) => {
    if (!k.linkedAssetId) return "—";
    if (k.linkedAssetType === "asset") {
      const a = assets.find(x => x.id === k.linkedAssetId);
      return a ? `${a.id} · ${a.descripcion}` : k.linkedAssetId;
    }
    return k.linkedAssetId; // vehicle plate
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <Button onClick={() => setForm({ ...EMPTY_FORM })} className="gap-2">
          <Plus className="h-4 w-4" /> Nueva Llave
        </Button>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" /> Control de Llaves
        </h2>
        <p className="text-sm text-muted-foreground">Registro, asignación y revisión periódica de llaves físicas y dispositivos de acceso</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <KpiCard
          title="Revisión vigente"
          icon={<ShieldCheck className="h-4 w-4" />}
          value={kpis.vigentes}
          total={kpis.total}
          pct={kpis.pctVigentes}
          tone="emerald"
        />
        <KpiCard
          title="Con responsable asignado"
          icon={<UserCheck className="h-4 w-4" />}
          value={kpis.asignadas}
          total={kpis.total}
          pct={kpis.pctAsignadas}
          tone="blue"
        />
        <KpiCard
          title="Con copia registrada"
          icon={<CopyIcon className="h-4 w-4" />}
          value={kpis.conCopia}
          total={kpis.total}
          pct={kpis.pctConCopia}
          tone="amber"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por código, descripción, responsable..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {ESTADOS_LLAVE.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterUbic} onValueChange={setFilterUbic}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Ubicación" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las ubicaciones</SelectItem>
            {UBICACIONES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={showOnlyVencidas ? "default" : "outline"}
          size="sm"
          onClick={() => setShowOnlyVencidas(v => !v)}
          className="gap-2"
        >
          <AlertTriangle className="h-4 w-4" /> Solo revisión vencida
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-2">{filtered.length} llaves</p>

      {/* Tabla */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="overflow-auto max-h-[520px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Código</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Descripción</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Pertenece a</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Responsable</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Última revisión</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 w-[140px]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                  No hay llaves registradas. Usa "Nueva Llave" para empezar.
                </td></tr>
              )}
              {filtered.map(k => {
                const est = ESTADOS_LLAVE.find(e => e.value === k.estado);
                const vigente = isRevisionVigente(k);
                return (
                  <tr key={k.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">{k.code || k.id}</td>
                    <td className="px-3 py-2 max-w-[220px] truncate">{k.descripcion}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs text-muted-foreground">
                      <div className="flex flex-col">
                        <span>{k.perteneceA || "—"}</span>
                        {k.linkedAssetId && (
                          <span className="font-mono text-[10px] text-primary flex items-center gap-1">
                            <Link2 className="h-3 w-3" /> {linkedLabel(k)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell text-xs">{k.responsable || "—"}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs">
                      <div className="flex flex-col">
                        <span className={vigente ? "text-foreground" : "text-destructive font-medium"}>
                          {k.ultimaRevision || "Sin revisar"}
                        </span>
                        {k.ultimaRevision && (
                          <span className="text-[10px] text-muted-foreground">
                            Próx.: {nextRevisionDate(k)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <Badge className="text-[10px] w-fit" style={{ background: est?.color + "20", color: est?.color }}>
                          {est?.label}
                        </Badge>
                        {!vigente && k.estado !== "retirada" && (
                          <span className="text-[9px] text-destructive flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> revisión vencida
                          </span>
                        )}
                        {k.tieneCopia && (
                          <span className="text-[9px] text-muted-foreground">📋 {k.cantidadCopias || 1} copia(s)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setHistoryOf(k)} title="Historial">
                          <HistoryIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForm(k)} title="Editar">
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(k.id)} title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Form Dialog ── */}
      <Dialog open={!!form} onOpenChange={() => setForm(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? `Editar ${form.id}` : "Registrar nueva llave"}</DialogTitle>
            <DialogDescription>Completa la información de la llave o dispositivo de acceso</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Código interno">
                <Input value={form.code || ""} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Ej: K-001 (auto si vacío)" />
              </Field>
              <Field label="Tipo de cerradura">
                <Select value={form.tipoCerradura || ""} onValueChange={v => setForm({ ...form, tipoCerradura: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{TIPOS_CERRADURA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Descripción *" full>
                <Input value={form.descripcion || ""} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: Llave puerta principal almacén" />
              </Field>
              <Field label="Pertenece a (mueble/dispositivo/área)" full>
                <Input value={form.perteneceA || ""} onChange={e => setForm({ ...form, perteneceA: e.target.value })} placeholder="Ej: Archivo metálico oficina RRHH" />
              </Field>
              <Field label="Vincular a Activo Fijo (opcional)">
                <Select
                  value={form.linkedAssetId || "__none__"}
                  onValueChange={v => setForm({ ...form, linkedAssetId: v === "__none__" ? "" : v, linkedAssetType: v === "__none__" ? "" : "asset" })}
                >
                  <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Ninguno —</SelectItem>
                    {assets.slice(0, 200).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.id} · {a.descripcion.slice(0, 40)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="O placa de vehículo">
                <Input
                  value={form.linkedAssetType === "vehicle" ? form.linkedAssetId || "" : ""}
                  onChange={e => setForm({ ...form, linkedAssetId: e.target.value, linkedAssetType: e.target.value ? "vehicle" : "" })}
                  placeholder="Ej: A123456"
                />
              </Field>
              <Field label="Ubicación">
                <Select value={form.ubicacion || ""} onValueChange={v => setForm({ ...form, ubicacion: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{UBICACIONES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Departamento">
                <Select value={form.departamento || ""} onValueChange={v => setForm({ ...form, departamento: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{DEPARTAMENTOS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Responsable / Asignado a">
                <Input value={form.responsable || ""} onChange={e => setForm({ ...form, responsable: e.target.value })} placeholder="Nombre completo" />
              </Field>
              <Field label="Fecha de entrega">
                <Input type="date" value={form.fechaEntrega || ""} onChange={e => setForm({ ...form, fechaEntrega: e.target.value })} />
              </Field>
              <Field label="Estado">
                <Select value={form.estado || "asignada"} onValueChange={v => setForm({ ...form, estado: v as KeyEstado })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTADOS_LLAVE.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Última revisión">
                <Input type="date" value={form.ultimaRevision || ""} onChange={e => setForm({ ...form, ultimaRevision: e.target.value })} />
              </Field>
              <Field label="Frecuencia de revisión (días)">
                <Input type="number" min={1} value={form.frecuenciaDias || 90} onChange={e => setForm({ ...form, frecuenciaDias: parseInt(e.target.value) || 90 })} />
              </Field>
              <div className="md:col-span-2 border rounded-md p-3 bg-muted/30 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox checked={!!form.tieneCopia} onCheckedChange={v => setForm({ ...form, tieneCopia: !!v })} />
                  ¿Existe copia de esta llave?
                </label>
                {form.tieneCopia && (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Cantidad de copias">
                      <Input type="number" min={1} value={form.cantidadCopias || 1} onChange={e => setForm({ ...form, cantidadCopias: parseInt(e.target.value) || 1 })} />
                    </Field>
                    <Field label="Ubicación de la copia">
                      <Input value={form.ubicacionCopia || ""} onChange={e => setForm({ ...form, ubicacionCopia: e.target.value })} placeholder="Ej: Caja fuerte gerencia" />
                    </Field>
                  </div>
                )}
              </div>
              <Field label="Notas" full>
                <Textarea rows={2} value={form.notas || ""} onChange={e => setForm({ ...form, notas: e.target.value })} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={handleSave}>{form?.id ? "Guardar cambios" : "Registrar llave"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Historial ── */}
      <Dialog open={!!historyOf} onOpenChange={() => setHistoryOf(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="h-4 w-4" /> Historial · {historyOf?.code || historyOf?.id}
            </DialogTitle>
            <DialogDescription>{historyOf?.descripcion}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="border rounded-md p-3 bg-muted/30 grid grid-cols-3 gap-2">
              <Field label="Acción">
                <Select value={newHist.accion} onValueChange={v => setNewHist({ ...newHist, accion: v as KeyHistorialAccion })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACCIONES_HISTORIAL.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Persona">
                <Input value={newHist.persona} onChange={e => setNewHist({ ...newHist, persona: e.target.value })} />
              </Field>
              <Field label="Motivo">
                <Input value={newHist.motivo} onChange={e => setNewHist({ ...newHist, motivo: e.target.value })} />
              </Field>
              <div className="col-span-3 flex justify-end">
                <Button size="sm" onClick={handleAddHistory} className="gap-1"><Plus className="h-3.5 w-3.5" /> Registrar</Button>
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto border rounded-md">
              {(historyOf?.historial || []).length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">Sin movimientos registrados</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr><th className="text-left px-2 py-1.5">Fecha</th><th className="text-left px-2 py-1.5">Acción</th><th className="text-left px-2 py-1.5">Persona</th><th className="text-left px-2 py-1.5">Motivo</th></tr>
                  </thead>
                  <tbody>
                    {(historyOf?.historial || []).map(h => (
                      <tr key={h.id} className="border-t">
                        <td className="px-2 py-1.5 text-muted-foreground">{new Date(h.fecha).toLocaleString()}</td>
                        <td className="px-2 py-1.5"><Badge variant="secondary" className="text-[10px]">{ACCIONES_HISTORIAL.find(a => a.value === h.accion)?.label}</Badge></td>
                        <td className="px-2 py-1.5">{h.persona}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{h.motivo || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOf(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar llave {deleteId}?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer y se perderá todo el historial.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function KpiCard({ title, icon, value, total, pct, tone }: {
  title: string; icon: React.ReactNode; value: number; total: number; pct: number;
  tone: "emerald" | "blue" | "amber";
}) {
  const colorByTone: Record<string, string> = {
    emerald: "hsl(142 70% 45%)",
    blue: "hsl(220 70% 50%)",
    amber: "hsl(42 100% 50%)",
  };
  const color = colorByTone[tone];
  return (
    <div className="border rounded-xl p-4 bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color }}>{icon} {title}</div>
        <span className="text-2xl font-bold" style={{ color }}>{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" />
      <p className="text-xs text-muted-foreground mt-2">{value} de {total} llaves</p>
    </div>
  );
}
