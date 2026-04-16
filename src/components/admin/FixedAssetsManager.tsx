import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft, Plus, Search, Trash2, Edit2, Eye, Printer, X,
  Package, Shield, Laptop, Monitor, Car, Radio, Phone,
  Camera, Wind, Zap, Calculator, Archive, Armchair,
  BarChart3, Filter, Download, ChevronDown,
} from "lucide-react";
import {
  type FixedAsset, type AssetTypeCode,
  ASSET_TYPES, ESTADOS, CONDICIONES, UBICACIONES, DEPARTAMENTOS,
  loadFixedAssets, saveFixedAssets, generateAssetId, getAssetTypeLabel,
} from "@/lib/fixedAssetsData";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const ICON_MAP: Record<string, any> = {
  Shield, Laptop, Monitor, MonitorSmartphone: Monitor, Printer: Monitor,
  Car, Bike: Car, Armchair, Table: Package, Archive, Wind, Radio, Phone,
  Camera, Refrigerator: Package, Zap, Calculator, Paperclip: Package, Package,
};

const getIcon = (iconName: string) => ICON_MAP[iconName] || Package;

interface Props {
  onBack: () => void;
}

export default function FixedAssetsManager({ onBack }: Props) {
  const { toast } = useToast();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"dashboard" | "list" | "detail" | "form" | "label">("dashboard");
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [editingAsset, setEditingAsset] = useState<Partial<FixedAsset> | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [filterCondicion, setFilterCondicion] = useState<string>("all");
  const [filterUbicacion, setFilterUbicacion] = useState<string>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadFixedAssets().then(data => { setAssets(data); setLoading(false); });
  }, []);

  const save = (updated: FixedAsset[]) => {
    setAssets(updated);
    saveFixedAssets(updated);
  };

  // ── Stats ──
  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    const byEstado: Record<string, number> = {};
    const byCondicion: Record<string, number> = {};
    const byUbicacion: Record<string, number> = {};
    let totalCosto = 0;

    assets.forEach(a => {
      byType[a.tipo] = (byType[a.tipo] || 0) + 1;
      byEstado[a.estado] = (byEstado[a.estado] || 0) + 1;
      byCondicion[a.condicion] = (byCondicion[a.condicion] || 0) + 1;
      if (a.ubicacion) byUbicacion[a.ubicacion] = (byUbicacion[a.ubicacion] || 0) + 1;
      totalCosto += a.costoAdquisicion || 0;
    });

    return { byType, byEstado, byCondicion, byUbicacion, totalCosto, total: assets.length };
  }, [assets]);

  // ── Filtered list ──
  const filtered = useMemo(() => {
    let list = [...assets];
    if (filterType !== "all") list = list.filter(a => a.tipo === filterType);
    if (filterEstado !== "all") list = list.filter(a => a.estado === filterEstado);
    if (filterUbicacion !== "all") list = list.filter(a => a.ubicacion === filterUbicacion);
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      list = list.filter(a =>
        a.id.toLowerCase().includes(t) ||
        a.descripcion.toLowerCase().includes(t) ||
        a.serial.toLowerCase().includes(t) ||
        a.asignadoA.toLowerCase().includes(t) ||
        a.marca.toLowerCase().includes(t)
      );
    }
    return list;
  }, [assets, filterType, filterEstado, filterUbicacion, searchTerm]);

  // ── CRUD handlers ──
  const handleSaveAsset = () => {
    if (!editingAsset?.tipo || !editingAsset?.descripcion) {
      toast({ title: "⚠️ Tipo y descripción son requeridos", variant: "destructive" });
      return;
    }
    const isNew = !editingAsset.id || !assets.find(a => a.id === editingAsset.id);
    let updated: FixedAsset[];

    if (isNew) {
      const newAsset: FixedAsset = {
        id: generateAssetId(editingAsset.tipo as AssetTypeCode, assets),
        codigoOriginal: "",
        tipo: editingAsset.tipo as AssetTypeCode,
        descripcion: editingAsset.descripcion || "",
        marca: editingAsset.marca || "",
        modelo: editingAsset.modelo || "",
        serial: editingAsset.serial || "",
        fechaAdquisicion: editingAsset.fechaAdquisicion || new Date().toISOString().slice(0, 10),
        costoAdquisicion: editingAsset.costoAdquisicion || 0,
        categoria: editingAsset.categoria || "Categoria II",
        ubicacion: editingAsset.ubicacion || "",
        departamento: editingAsset.departamento || "",
        depreciacion: editingAsset.depreciacion || 0,
        estado: editingAsset.estado || "disponible",
        condicion: editingAsset.condicion || "funcionando",
        asignadoA: editingAsset.asignadoA || "",
        vidaUtilAnios: editingAsset.vidaUtilAnios,
        notas: editingAsset.notas,
      };
      updated = [newAsset, ...assets];
      toast({ title: `✅ Activo ${newAsset.id} registrado` });
    } else {
      updated = assets.map(a => a.id === editingAsset.id ? { ...a, ...editingAsset } as FixedAsset : a);
      toast({ title: `✅ Activo ${editingAsset.id} actualizado` });
    }

    save(updated);
    setEditingAsset(null);
    setView("list");
  };

  const handleDelete = (id: string) => {
    save(assets.filter(a => a.id !== id));
    setDeleteConfirm(null);
    setSelectedAsset(null);
    setView("list");
    toast({ title: "🗑️ Activo eliminado" });
  };

  const handlePrintLabel = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Etiqueta Activo Fijo</title>
      <style>
        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // ══════════════════════════════════════════
  //  LABEL VIEW
  // ══════════════════════════════════════════
  if (view === "label" && selectedAsset) {
    const a = selectedAsset;
    const qrData = JSON.stringify({
      empresa: "SAFEONE SECURITY",
      codigo: a.id,
      tipo: getAssetTypeLabel(a.tipo),
      marca: a.marca,
      modelo: a.modelo,
      serial: a.serial,
      asignado: a.asignadoA,
      ubicacion: a.ubicacion,
      estado: a.estado,
      condicion: a.condicion,
      fecha: a.fechaAdquisicion,
    });

    return (
      <div>
        <Button variant="ghost" onClick={() => setView("detail")} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver al detalle
        </Button>

        <div className="flex justify-end mb-4">
          <Button onClick={handlePrintLabel} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir Etiqueta
          </Button>
        </div>

        <div ref={printRef} className="max-w-md mx-auto border-2 border-foreground rounded-lg p-4 bg-white text-black">
          <div className="flex gap-4">
            {/* Left: Logo placeholder */}
            <div className="flex-shrink-0 w-16 h-16 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
            {/* Right: Data */}
            <div className="flex-1 text-xs space-y-1">
              <p className="font-bold text-sm">Propiedad de SafeOne Security Company</p>
              <p><span className="font-semibold">Activo Fijo:</span> {a.id}</p>
              <p><span className="font-semibold">Serie:</span> {a.serial || "N/A"}</p>
            </div>
          </div>
          {/* QR */}
          <div className="mt-3 flex justify-center">
            <QRCodeSVG value={qrData} size={120} level="M" />
          </div>
          <p className="text-center text-[9px] mt-1 text-gray-500">
            Escanear para ver información del activo
          </p>
        </div>

        {/* QR Preview Info */}
        <div className="max-w-md mx-auto mt-4 border rounded-lg p-4 bg-card">
          <h3 className="font-semibold text-sm mb-2">Datos visibles al escanear:</h3>
          <div className="text-xs space-y-1 text-muted-foreground">
            <p><strong>SAFEONE SECURITY</strong></p>
            <p>{a.id}</p>
            <p>Tipo: {getAssetTypeLabel(a.tipo)}</p>
            <p>Marca: {a.marca || "—"}</p>
            <p>Modelo: {a.modelo || "—"}</p>
            <p>Serie: {a.serial || "—"}</p>
            <p>Asignado: {a.asignadoA || "—"}</p>
            <p>Ubicación: {a.ubicacion || "—"}</p>
            <p>Estado: {ESTADOS.find(e => e.value === a.estado)?.label}</p>
            <p>Condición: {CONDICIONES.find(c => c.value === a.condicion)?.label}</p>
            <p>Fecha: {a.fechaAdquisicion || "—"}</p>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════
  //  DETAIL VIEW
  // ══════════════════════════════════════════
  if (view === "detail" && selectedAsset) {
    const a = selectedAsset;
    const estadoInfo = ESTADOS.find(e => e.value === a.estado);
    const condInfo = CONDICIONES.find(c => c.value === a.condicion);

    return (
      <div>
        <Button variant="ghost" onClick={() => { setSelectedAsset(null); setView("list"); }} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver a la lista
        </Button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">{a.id}</h2>
            <p className="text-muted-foreground">{a.descripcion}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setView("label")} className="gap-1">
              <Printer className="h-3.5 w-3.5" /> Etiqueta
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setEditingAsset(a); setView("form"); }} className="gap-1">
              <Edit2 className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(a.id)} className="gap-1">
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-xl p-4 bg-card space-y-3">
            <h3 className="font-semibold text-sm text-primary">Información General</h3>
            <InfoRow label="Código" value={a.id} />
            <InfoRow label="Tipo" value={getAssetTypeLabel(a.tipo)} />
            <InfoRow label="Descripción" value={a.descripcion} />
            <InfoRow label="Marca" value={a.marca} />
            <InfoRow label="Modelo" value={a.modelo} />
            <InfoRow label="Serial" value={a.serial} />
          </div>
          <div className="border rounded-xl p-4 bg-card space-y-3">
            <h3 className="font-semibold text-sm text-primary">Ubicación y Estado</h3>
            <InfoRow label="Ubicación" value={a.ubicacion} />
            <InfoRow label="Departamento" value={a.departamento} />
            <InfoRow label="Asignado a" value={a.asignadoA} />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estado</span>
              <Badge style={{ background: estadoInfo?.color, color: "white" }}>{estadoInfo?.label}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Condición</span>
              <Badge style={{ background: condInfo?.color, color: "white" }}>{condInfo?.label}</Badge>
            </div>
          </div>
          <div className="border rounded-xl p-4 bg-card space-y-3">
            <h3 className="font-semibold text-sm text-primary">Datos Financieros</h3>
            <InfoRow label="Costo Adquisición" value={a.costoAdquisicion ? `RD$ ${a.costoAdquisicion.toLocaleString()}` : "—"} />
            <InfoRow label="Fecha Adquisición" value={a.fechaAdquisicion} />
            <InfoRow label="Depreciación" value={a.depreciacion ? `${a.depreciacion}%` : "—"} />
            <InfoRow label="Vida Útil" value={a.vidaUtilAnios ? `${a.vidaUtilAnios} años` : "—"} />
          </div>
          {a.notas && (
            <div className="border rounded-xl p-4 bg-card space-y-3">
              <h3 className="font-semibold text-sm text-primary">Notas</h3>
              <p className="text-sm text-foreground">{a.notas}</p>
            </div>
          )}
        </div>

        {/* Delete confirmation */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>¿Eliminar activo {deleteConfirm}?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => handleDelete(deleteConfirm!)}>Eliminar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ══════════════════════════════════════════
  //  FORM VIEW (Create/Edit)
  // ══════════════════════════════════════════
  if (view === "form") {
    const form = editingAsset || {};
    const update = (field: string, value: any) => setEditingAsset({ ...form, [field]: value });
    const isNew = !form.id;

    return (
      <div>
        <Button variant="ghost" onClick={() => { setEditingAsset(null); setView("list"); }} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Cancelar
        </Button>

        <h2 className="text-xl font-bold text-foreground mb-4">
          {isNew ? "Registrar Nuevo Activo" : `Editar ${form.id}`}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          <div className="space-y-3">
            <FormField label="Tipo de Activo *">
              <Select value={form.tipo || ""} onValueChange={v => update("tipo", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map(t => (
                    <SelectItem key={t.code} value={t.code}>{t.code} — {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Descripción *">
              <Input value={form.descripcion || ""} onChange={e => update("descripcion", e.target.value)} />
            </FormField>
            <FormField label="Marca">
              <Input value={form.marca || ""} onChange={e => update("marca", e.target.value)} placeholder="Ej: Dell, HP, Samsung" />
            </FormField>
            <FormField label="Modelo">
              <Input value={form.modelo || ""} onChange={e => update("modelo", e.target.value)} placeholder="Ej: Inspiron 14 7430" />
            </FormField>
            <FormField label="Serial">
              <Input value={form.serial || ""} onChange={e => update("serial", e.target.value)} />
            </FormField>
            <FormField label="Fecha de Adquisición">
              <Input type="date" value={form.fechaAdquisicion || ""} onChange={e => update("fechaAdquisicion", e.target.value)} />
            </FormField>
          </div>

          <div className="space-y-3">
            <FormField label="Costo Adquisición (RD$)">
              <Input type="number" value={form.costoAdquisicion || ""} onChange={e => update("costoAdquisicion", parseFloat(e.target.value) || 0)} />
            </FormField>
            <FormField label="Ubicación">
              <Select value={form.ubicacion || ""} onValueChange={v => update("ubicacion", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar ubicación" /></SelectTrigger>
                <SelectContent>
                  {UBICACIONES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Departamento">
              <Select value={form.departamento || ""} onValueChange={v => update("departamento", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar departamento" /></SelectTrigger>
                <SelectContent>
                  {DEPARTAMENTOS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Estado">
              <Select value={form.estado || "disponible"} onValueChange={v => update("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Condición">
              <Select value={form.condicion || "funcionando"} onValueChange={v => update("condicion", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDICIONES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Asignado A">
              <Input value={form.asignadoA || ""} onChange={e => update("asignadoA", e.target.value)} placeholder="Nombre del responsable" />
            </FormField>
            <FormField label="Notas">
              <Input value={form.notas || ""} onChange={e => update("notas", e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button onClick={handleSaveAsset} className="gap-2">
            {isNew ? <><Plus className="h-4 w-4" /> Registrar Activo</> : "Guardar Cambios"}
          </Button>
          <Button variant="outline" onClick={() => { setEditingAsset(null); setView("list"); }}>Cancelar</Button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════
  //  LIST VIEW
  // ══════════════════════════════════════════
  if (view === "list") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => setView("dashboard")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
          <Button onClick={() => { setEditingAsset({}); setView("form"); }} className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo Activo
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, descripción, serial, asignado..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {ASSET_TYPES.map(t => (
                <SelectItem key={t.code} value={t.code}>{t.code} — {t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground mb-2">{filtered.length} activos encontrados</p>

        {/* Table */}
        <div className="border rounded-xl overflow-hidden bg-card">
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Código</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Descripción</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Ubicación</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Serial</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Estado</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[80px]"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map(a => {
                  const est = ESTADOS.find(e => e.value === a.estado);
                  return (
                    <tr key={a.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => { setSelectedAsset(a); setView("detail"); }}>
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">{a.id}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{a.descripcion}</td>
                      <td className="px-3 py-2 hidden md:table-cell text-muted-foreground text-xs">{a.ubicacion || "—"}</td>
                      <td className="px-3 py-2 hidden lg:table-cell font-mono text-xs text-muted-foreground">{a.serial || "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className="text-[10px]" style={{ background: est?.color + "20", color: est?.color }}>
                          {est?.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); setSelectedAsset(a); setView("detail"); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 100 && (
            <p className="text-center text-xs text-muted-foreground py-2">
              Mostrando 100 de {filtered.length} resultados. Use los filtros para refinar.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════
  //  DASHBOARD VIEW
  // ══════════════════════════════════════════
  const topTypes = Object.entries(stats.byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Activos Fijos</h2>
          <p className="text-sm text-muted-foreground">Gestión integral del inventario de activos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView("list")} className="gap-2">
            <Search className="h-4 w-4" /> Ver Inventario
          </Button>
          <Button onClick={() => { setEditingAsset({}); setView("form"); }} className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo Activo
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Activos" value={stats.total} color="hsl(220 70% 50%)" onClick={() => { setFilterType("all"); setFilterEstado("all"); setFilterUbicacion("all"); setView("list"); }} />
        <StatCard label="Funcionando" value={stats.byCondicion["funcionando"] || 0} color="hsl(142 70% 45%)" onClick={() => { setFilterType("all"); setFilterEstado("all"); setFilterUbicacion("all"); setSearchTerm(""); setView("list"); setTimeout(() => setFilterEstado("funcionando"), 0); }} />
        <StatCard label="Averiados" value={(stats.byCondicion["averiado"] || 0) + (stats.byCondicion["en_reparacion"] || 0)} color="hsl(0 70% 50%)" onClick={() => { setFilterType("all"); setFilterEstado("all"); setFilterUbicacion("all"); setSearchTerm(""); setView("list"); setTimeout(() => setFilterEstado("averiado"), 0); }} />
        <StatCard label="Valor Total" value={`RD$ ${(stats.totalCosto / 1000).toFixed(0)}K`} color="hsl(42 100% 50%)" onClick={() => { setFilterType("all"); setFilterEstado("all"); setFilterUbicacion("all"); setView("list"); }} />
      </div>

      {/* Type breakdown */}
      <div className="border rounded-xl p-4 bg-card mb-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Distribución por Tipo
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {topTypes.map(([code, count]) => (
            <button
              key={code}
              className="flex items-center gap-2 p-2 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-all text-left"
              onClick={() => { setFilterType(code); setView("list"); }}
            >
              <span className="text-xs font-mono font-bold text-primary">{code}</span>
              <span className="text-xs truncate flex-1">{getAssetTypeLabel(code)}</span>
              <Badge variant="secondary" className="text-[10px]">{count}</Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Estado breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4 bg-card">
          <h3 className="font-semibold text-sm mb-3">Por Estado</h3>
          <div className="space-y-2">
            {ESTADOS.map(e => {
              const count = stats.byEstado[e.value] || 0;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <button key={e.value} className="flex items-center gap-2 w-full hover:bg-muted/50 rounded-md px-1 py-0.5 transition-colors" onClick={() => { setFilterType("all"); setFilterEstado(e.value); setFilterUbicacion("all"); setSearchTerm(""); setView("list"); }}>
                  <span className="text-xs w-24 text-muted-foreground text-left">{e.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: e.color }} />
                  </div>
                  <span className="text-xs font-semibold w-8 text-right">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="border rounded-xl p-4 bg-card">
          <h3 className="font-semibold text-sm mb-3">Por Condición</h3>
          <div className="space-y-2">
            {CONDICIONES.map(c => {
              const count = stats.byCondicion[c.value] || 0;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <button key={c.value} className="flex items-center gap-2 w-full hover:bg-muted/50 rounded-md px-1 py-0.5 transition-colors" onClick={() => { setFilterType("all"); setFilterEstado(c.value); setFilterUbicacion("all"); setSearchTerm(""); setView("list"); }}>
                  <span className="text-xs w-24 text-muted-foreground text-left">{c.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                  </div>
                  <span className="text-xs font-semibold w-8 text-right">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Nomenclature reference */}
      <div className="border rounded-xl p-4 bg-card mt-4">
        <h3 className="font-semibold text-sm mb-3">📋 Nomenclatura SSC</h3>
        <p className="text-xs text-muted-foreground mb-2">Formato: <code className="bg-muted px-1 rounded">SSC-[TIPO]-[XXXXX]</code></p>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-1.5">
          {ASSET_TYPES.map(t => (
            <div key={t.code} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-muted/50">
              <span className="font-mono font-bold text-primary">{t.code}</span>
              <span className="truncate text-muted-foreground">{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Helper components ──
function StatCard({ label, value, color, onClick }: { label: string; value: number | string; color: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="border rounded-xl p-3 bg-card text-left hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right max-w-[60%] truncate">{value || "—"}</span>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}
