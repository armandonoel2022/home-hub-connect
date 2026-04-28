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
  FileText, Printer, X,
} from "lucide-react";

// Mapa de colores identificadores (etiqueta visual SafeOne)
const COLOR_MAP: Record<string, { bg: string; ring: string; text: string }> = {
  azul:     { bg: "hsl(220 85% 55%)", ring: "hsl(220 85% 45%)", text: "#fff" },
  amarillo: { bg: "hsl(48 100% 55%)", ring: "hsl(42 90% 45%)",  text: "#1a1a1a" },
  rojo:     { bg: "hsl(0 80% 55%)",   ring: "hsl(0 80% 45%)",   text: "#fff" },
  verde:    { bg: "hsl(142 65% 45%)", ring: "hsl(142 65% 35%)", text: "#fff" },
  naranja:  { bg: "hsl(28 95% 55%)",  ring: "hsl(28 95% 45%)",  text: "#fff" },
  blanco:   { bg: "hsl(0 0% 96%)",    ring: "hsl(0 0% 70%)",    text: "#1a1a1a" },
  negro:    { bg: "hsl(0 0% 18%)",    ring: "hsl(0 0% 8%)",     text: "#fff" },
  gris:     { bg: "hsl(0 0% 60%)",    ring: "hsl(0 0% 45%)",    text: "#fff" },
  morado:   { bg: "hsl(270 60% 55%)", ring: "hsl(270 60% 45%)", text: "#fff" },
  rosa:     { bg: "hsl(330 75% 65%)", ring: "hsl(330 75% 55%)", text: "#fff" },
};

function parseColors(raw?: string): { name: string; style: { bg: string; ring: string; text: string } }[] {
  if (!raw) return [];
  return raw
    .split(/[\/,;]+| y /i)
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => {
      const key = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const style = COLOR_MAP[key] || { bg: "hsl(var(--muted))", ring: "hsl(var(--border))", text: "hsl(var(--foreground))" };
      return { name, style };
    });
}

function ColorChips({ raw, size = "sm" }: { raw?: string; size?: "sm" | "md" }) {
  const colors = parseColors(raw);
  if (colors.length === 0) return null;
  const dim = size === "sm" ? 14 : 20;
  return (
    <div className="inline-flex items-center gap-1" title={raw}>
      {colors.map((c, i) => (
        <span
          key={i}
          className="rounded-full border-2 shadow-sm"
          style={{ width: dim, height: dim, background: c.style.bg, borderColor: c.style.ring }}
        />
      ))}
      {size === "md" && (
        <span className="ml-1 text-xs text-muted-foreground">{colors.map(c => c.name).join(" / ")}</span>
      )}
    </div>
  );
}
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
  const [kpiFilter, setKpiFilter] = useState<null | "vigentes" | "asignadas" | "conCopia">(null);

  const [form, setForm] = useState<Partial<KeyRecord> | null>(null);
  const [historyOf, setHistoryOf] = useState<KeyRecord | null>(null);
  const [detailOf, setDetailOf] = useState<KeyRecord | null>(null);
  const [newHist, setNewHist] = useState<{ accion: KeyHistorialAccion; persona: string; motivo: string }>({
    accion: "entrega", persona: "", motivo: "",
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [reviewIntercept, setReviewIntercept] = useState<KeyRecord | null>(null);

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
    if (kpiFilter === "vigentes")  list = list.filter(k => k.estado !== "retirada" && isRevisionVigente(k));
    if (kpiFilter === "asignadas") list = list.filter(k => k.estado === "asignada" && k.responsable.trim());
    if (kpiFilter === "conCopia")  list = list.filter(k => k.tieneCopia);
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
  }, [keys, filterEstado, filterUbic, showOnlyVencidas, kpiFilter, search]);

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

  const openProcedimiento = () => {
    window.open("/docs/PRO-G-03_Procedimiento_Control_de_Llaves.docx", "_blank");
  };

  const printFG08 = () => {
    const rows = filtered;
    const today = new Date().toLocaleDateString("es-DO");
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const body = rows.map(k => `
      <tr>
        <td>${k.code || k.id}</td>
        <td>${k.responsable || ""}</td>
        <td>${k.fechaEntrega || ""}</td>
        <td>${k.perteneceA || k.descripcion || ""}</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>`).join("");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>F-G-08 Asignación y Devolución de Llaves</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border: 1px solid #000; padding: 8px; margin-bottom: 4px; }
        .header .left { font-size: 9pt; }
        .header .title { text-align: center; flex: 1; font-weight: 800; font-size: 11pt; line-height: 1.3; }
        .meta { display:flex; justify-content: space-between; font-size:9pt; margin: 6px 2px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
        th { background: #f0f0f0; font-size: 9pt; }
        td { height: 22px; }
        .foot { margin-top: 12px; font-size: 8pt; color: #555; display:flex; justify-content: space-between; }
      </style></head><body>
      <div class="header">
        <div class="left">SAFEONE<br/>SECURITY COMPANY</div>
        <div class="title">FORMULARIO: F-G-08<br/>FORMULARIO ASIGNACIÓN Y DEVOLUCIÓN DE LLAVES,<br/>TOKENS, TARJETAS Y CONTROL DE ACCESO</div>
        <div class="left" style="text-align:right">Fecha impresión:<br/><strong>${today}</strong></div>
      </div>
      <div class="meta"><span>Total de registros: <strong>${rows.length}</strong></span><span>Procedimiento de referencia: <strong>PRO-G-03</strong></span></div>
      <table>
        <thead>
          <tr>
            <th style="width:7%">No. Llave</th>
            <th style="width:18%">NOMBRE (Firma de persona que se le asigna la llave)</th>
            <th style="width:9%">Fecha</th>
            <th style="width:20%">Área o lugar</th>
            <th style="width:13%">Despachado por</th>
            <th style="width:13%">Devuelta por</th>
            <th style="width:9%">Fecha</th>
            <th style="width:11%">Recibe</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      <div class="foot"><span>F-G-08 · Rev. 1.5 · 13/03/2026</span><span>SafeOne Security Company · Tel: 809 548 3100</span></div>
      <script>window.onload=()=>{setTimeout(()=>window.print(),300);};</script>
      </body></html>`);
    win.document.close();
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
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={openProcedimiento} className="gap-2" title="Procedimiento PRO-G-03">
            <FileText className="h-4 w-4" /> Procedimiento PRO-G-03
          </Button>
          <Button variant="outline" size="sm" onClick={printFG08} className="gap-2" title="Formulario F-G-08 Asignación y Devolución de Llaves">
            <Printer className="h-4 w-4" /> Imprimir F-G-08
          </Button>
          <Button onClick={() => setForm({ ...EMPTY_FORM })} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva Llave
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" /> Control de Llaves
        </h2>
        <p className="text-sm text-muted-foreground">
          Inventario oficial · Procedimiento <strong>PRO-G-03</strong> · Formulario <strong>F-G-08</strong> Asignación y Devolución de Llaves
        </p>
      </div>

      {/* KPIs (clicables → filtran la lista) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <KpiCard
          title="Revisión vigente"
          icon={<ShieldCheck className="h-4 w-4" />}
          value={kpis.vigentes} total={kpis.total} pct={kpis.pctVigentes}
          tone="emerald"
          active={kpiFilter === "vigentes"}
          onClick={() => setKpiFilter(kpiFilter === "vigentes" ? null : "vigentes")}
        />
        <KpiCard
          title="Con responsable asignado"
          icon={<UserCheck className="h-4 w-4" />}
          value={kpis.asignadas} total={kpis.total} pct={kpis.pctAsignadas}
          tone="blue"
          active={kpiFilter === "asignadas"}
          onClick={() => setKpiFilter(kpiFilter === "asignadas" ? null : "asignadas")}
        />
        <KpiCard
          title="Con copia registrada"
          icon={<CopyIcon className="h-4 w-4" />}
          value={kpis.conCopia} total={kpis.total} pct={kpis.pctConCopia}
          tone="amber"
          active={kpiFilter === "conCopia"}
          onClick={() => setKpiFilter(kpiFilter === "conCopia" ? null : "conCopia")}
        />
      </div>

      {kpiFilter && (
        <div className="mb-4 flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <p className="text-xs text-foreground">
            <span className="font-semibold">Filtro activo:</span>{" "}
            {kpiFilter === "vigentes" && "Llaves con revisión vigente"}
            {kpiFilter === "asignadas" && "Llaves con responsable asignado"}
            {kpiFilter === "conCopia" && "Llaves con copia registrada"}
            <span className="text-muted-foreground"> · {filtered.length} resultados</span>
          </p>
          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setKpiFilter(null)}>
            <X className="h-3 w-3" /> Quitar filtro
          </Button>
        </div>
      )}

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
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[60px]">Color</th>
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
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                  No hay llaves que coincidan con el filtro.
                </td></tr>
              )}
              {filtered.map(k => {
                const est = ESTADOS_LLAVE.find(e => e.value === k.estado);
                const vigente = isRevisionVigente(k);
                return (
                  <tr
                    key={k.id}
                    className="border-t hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => setDetailOf(k)}
                  >
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">{k.code || k.id}</td>
                    <td className="px-3 py-2"><ColorChips raw={k.colorIdentificador} /></td>
                    <td className="px-3 py-2 max-w-[220px]">
                      <div className="truncate">{k.descripcion}</div>
                    </td>
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
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailOf(k)} title="Ver detalle">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
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
              <Field label="Cantidad en caja de llaves">
                <Input type="number" min={0} value={form.cantidadEnCaja ?? 0} onChange={e => setForm({ ...form, cantidadEnCaja: parseInt(e.target.value) || 0 })} />
              </Field>
              <Field label="Cantidad asignadas">
                <Input type="number" min={0} value={form.cantidadAsignadas ?? 0} onChange={e => setForm({ ...form, cantidadAsignadas: parseInt(e.target.value) || 0 })} />
              </Field>
              <Field label="Color identificador" full>
                <Input value={form.colorIdentificador || ""} onChange={e => setForm({ ...form, colorIdentificador: e.target.value })} placeholder="Ej: Azul, Amarillo, Verde/Rojo" />
              </Field>
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

      {/* ── Detalle (reporte clicable + imprimible) ── */}
      <KeyDetailDialog
        keyRecord={detailOf}
        linkedLabel={detailOf ? linkedLabel(detailOf) : ""}
        onClose={() => setDetailOf(null)}
        onEdit={() => { if (detailOf) { setForm(detailOf); setDetailOf(null); } }}
        onAddHistory={() => { if (detailOf) { setHistoryOf(detailOf); setDetailOf(null); } }}
      />

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

function KpiCard({ title, icon, value, total, pct, tone, active, onClick }: {
  title: string; icon: React.ReactNode; value: number; total: number; pct: number;
  tone: "emerald" | "blue" | "amber";
  active?: boolean;
  onClick?: () => void;
}) {
  const colorByTone: Record<string, string> = {
    emerald: "hsl(142 70% 45%)",
    blue: "hsl(220 70% 50%)",
    amber: "hsl(42 100% 50%)",
  };
  const color = colorByTone[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left border rounded-xl p-4 bg-card transition-all hover:shadow-md hover:-translate-y-0.5 ${active ? "ring-2 shadow-md" : ""}`}
      style={{ borderColor: active ? color : undefined, boxShadow: active ? `0 0 0 2px ${color}33` : undefined }}
      title={active ? "Click para quitar filtro" : "Click para filtrar la lista"}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color }}>{icon} {title}</div>
        <span className="text-2xl font-bold" style={{ color }}>{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" />
      <p className="text-xs text-muted-foreground mt-2">
        {value} de {total} llaves {active && <span className="ml-1 text-primary font-medium">· filtrando</span>}
      </p>
    </button>
  );
}

// ── Detalle de Llave (reporte clicable, expandible e imprimible) ──
function KeyDetailDialog({ keyRecord, linkedLabel, onClose, onEdit, onAddHistory }: {
  keyRecord: KeyRecord | null;
  linkedLabel: string;
  onClose: () => void;
  onEdit: () => void;
  onAddHistory: () => void;
}) {
  if (!keyRecord) {
    return <Dialog open={false} onOpenChange={onClose}><DialogContent /></Dialog>;
  }
  const k = keyRecord;
  const est = ESTADOS_LLAVE.find(e => e.value === k.estado);
  const vigente = isRevisionVigente(k);
  const colors = parseColors(k.colorIdentificador);
  const hist = k.historial || [];

  const printDetail = () => {
    const today = new Date().toLocaleString("es-DO");
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const histRows = hist.map(h => `
      <tr>
        <td>${new Date(h.fecha).toLocaleString("es-DO")}</td>
        <td>${ACCIONES_HISTORIAL.find(a => a.value === h.accion)?.label || h.accion}</td>
        <td>${h.persona || ""}</td>
        <td>${h.motivo || ""}</td>
        <td>${h.registradoPor || ""}</td>
      </tr>`).join("") || `<tr><td colspan="5" style="text-align:center;color:#888;padding:12px">Sin movimientos registrados</td></tr>`;

    const colorChips = colors.map(c =>
      `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c.style.bg};border:2px solid ${c.style.ring};margin-right:4px;vertical-align:middle"></span>${c.name}`
    ).join(" &nbsp; ") || "—";

    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ficha de Llave ${k.code || k.id}</title>
      <style>
        @page { size: A4; margin: 14mm; }
        body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; }
        h1 { font-size: 14pt; margin: 0 0 4px; }
        .sub { color: #555; font-size: 9pt; margin-bottom: 12px; }
        .header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; margin-bottom: 14px; }
        .row { border-bottom: 1px dotted #ccc; padding: 4px 0; }
        .label { color: #666; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .3px; }
        .value { font-weight: 600; font-size: 10pt; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9pt; font-weight: 700; }
        .section-title { font-size: 11pt; font-weight: 700; margin: 14px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #999; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #999; padding: 4px 6px; font-size: 9pt; vertical-align: top; }
        th { background: #f0f0f0; }
        .foot { margin-top: 18px; font-size: 8pt; color: #666; display:flex; justify-content: space-between; border-top:1px solid #ccc; padding-top:6px; }
      </style></head><body>
      <div class="header">
        <div>
          <h1>Ficha de Llave · ${k.code || k.id}</h1>
          <div class="sub">${k.descripcion || ""}</div>
        </div>
        <div style="text-align:right;font-size:9pt">
          <strong>SAFEONE</strong><br/>SECURITY COMPANY<br/>
          <span style="color:#666">Impreso: ${today}</span>
        </div>
      </div>

      <div class="grid">
        <div class="row"><div class="label">Estado</div><div class="value"><span class="badge" style="background:${est?.color}22;color:${est?.color}">${est?.label || "—"}</span> ${!vigente && k.estado !== "retirada" ? '<span style="color:#c00;font-size:9pt">· Revisión vencida</span>' : ""}</div></div>
        <div class="row"><div class="label">Tipo de cerradura</div><div class="value">${k.tipoCerradura || "—"}</div></div>
        <div class="row"><div class="label">Pertenece a</div><div class="value">${k.perteneceA || "—"}</div></div>
        <div class="row"><div class="label">Activo / Vehículo vinculado</div><div class="value">${linkedLabel || "—"}</div></div>
        <div class="row"><div class="label">Ubicación</div><div class="value">${k.ubicacion || "—"}</div></div>
        <div class="row"><div class="label">Departamento</div><div class="value">${k.departamento || "—"}</div></div>
        <div class="row"><div class="label">Responsable</div><div class="value">${k.responsable || "—"}</div></div>
        <div class="row"><div class="label">Fecha de entrega</div><div class="value">${k.fechaEntrega || "—"}</div></div>
        <div class="row"><div class="label">Última revisión</div><div class="value">${k.ultimaRevision || "Sin revisar"}</div></div>
        <div class="row"><div class="label">Próxima revisión</div><div class="value">${nextRevisionDate(k) || "—"} (cada ${k.frecuenciaDias || 90} días)</div></div>
        <div class="row"><div class="label">Identificador de color</div><div class="value">${colorChips}</div></div>
        <div class="row"><div class="label">Copias</div><div class="value">${k.tieneCopia ? `Sí · ${k.cantidadCopias || 1} copia(s)${k.ubicacionCopia ? ` · ${k.ubicacionCopia}` : ""}` : "No"}</div></div>
        <div class="row"><div class="label">Cantidad en caja</div><div class="value">${k.cantidadEnCaja ?? 0}</div></div>
        <div class="row"><div class="label">Cantidad asignadas</div><div class="value">${k.cantidadAsignadas ?? 0}</div></div>
      </div>

      ${k.notas ? `<div class="section-title">Notas</div><div style="border:1px solid #ccc;padding:8px;border-radius:4px;background:#fafafa">${k.notas}</div>` : ""}

      <div class="section-title">Historial de movimientos (${hist.length})</div>
      <table>
        <thead><tr><th style="width:18%">Fecha</th><th style="width:14%">Acción</th><th style="width:22%">Persona</th><th>Motivo</th><th style="width:18%">Registrado por</th></tr></thead>
        <tbody>${histRows}</tbody>
      </table>

      <div class="foot">
        <span>Procedimiento de referencia: <strong>PRO-G-03</strong> · Formulario: <strong>F-G-08</strong></span>
        <span>SafeOne Security Company · Tel: 809 548 3100</span>
      </div>
      <script>window.onload=()=>{setTimeout(()=>window.print(),300);};</script>
      </body></html>`);
    win.document.close();
  };

  return (
    <Dialog open={!!keyRecord} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <KeyRound className="h-5 w-5 text-primary" />
            <span className="font-mono">{k.code || k.id}</span>
            <span className="text-sm font-normal text-muted-foreground">· {k.descripcion}</span>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <Badge style={{ background: est?.color + "22", color: est?.color }}>{est?.label}</Badge>
            {!vigente && k.estado !== "retirada" && (
              <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Revisión vencida</Badge>
            )}
            {colors.length > 0 && <ColorChips raw={k.colorIdentificador} size="md" />}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <DetailRow label="Tipo de cerradura" value={k.tipoCerradura} />
          <DetailRow label="Pertenece a" value={k.perteneceA} />
          <DetailRow label="Activo / Vehículo vinculado" value={linkedLabel} mono={!!k.linkedAssetId} />
          <DetailRow label="Ubicación" value={k.ubicacion} />
          <DetailRow label="Departamento" value={k.departamento} />
          <DetailRow label="Responsable" value={k.responsable} />
          <DetailRow label="Fecha de entrega" value={k.fechaEntrega} />
          <DetailRow label="Última revisión" value={k.ultimaRevision || "Sin revisar"} />
          <DetailRow label="Próxima revisión" value={`${nextRevisionDate(k) || "—"} · cada ${k.frecuenciaDias || 90} días`} />
          <DetailRow label="Copias" value={k.tieneCopia ? `Sí · ${k.cantidadCopias || 1}${k.ubicacionCopia ? ` · ${k.ubicacionCopia}` : ""}` : "No"} />
          <DetailRow label="Cantidad en caja" value={String(k.cantidadEnCaja ?? 0)} />
          <DetailRow label="Cantidad asignadas" value={String(k.cantidadAsignadas ?? 0)} />
        </div>

        {k.notas && (
          <div className="mt-3 border rounded-md p-3 bg-muted/30 text-sm">
            <p className="text-xs font-medium text-muted-foreground mb-1">Notas</p>
            <p className="whitespace-pre-wrap">{k.notas}</p>
          </div>
        )}

        {/* Historial expandido (collapsible nativo) */}
        <details className="mt-3 border rounded-md bg-card" open={hist.length > 0}>
          <summary className="cursor-pointer px-3 py-2 font-medium text-sm flex items-center gap-2 hover:bg-muted/30 rounded-md">
            <HistoryIcon className="h-4 w-4 text-primary" />
            Historial de movimientos
            <Badge variant="secondary" className="ml-1">{hist.length}</Badge>
          </summary>
          <div className="border-t">
            {hist.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">Sin movimientos registrados</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-2 py-1.5">Fecha</th>
                    <th className="text-left px-2 py-1.5">Acción</th>
                    <th className="text-left px-2 py-1.5">Persona</th>
                    <th className="text-left px-2 py-1.5">Motivo</th>
                    <th className="text-left px-2 py-1.5">Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {hist.map(h => (
                    <tr key={h.id} className="border-t">
                      <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{new Date(h.fecha).toLocaleString("es-DO")}</td>
                      <td className="px-2 py-1.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {ACCIONES_HISTORIAL.find(a => a.value === h.accion)?.label}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5">{h.persona}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{h.motivo || "—"}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{h.registradoPor || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </details>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button variant="outline" onClick={onAddHistory} className="gap-2">
            <HistoryIcon className="h-4 w-4" /> Agregar movimiento
          </Button>
          <Button variant="outline" onClick={onEdit} className="gap-2">
            <Edit2 className="h-4 w-4" /> Editar
          </Button>
          <Button onClick={printDetail} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir ficha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="border-b border-dashed border-border pb-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm ${mono ? "font-mono text-primary" : ""}`}>{value || "—"}</p>
    </div>
  );
}
