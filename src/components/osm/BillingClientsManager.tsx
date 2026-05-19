/**
 * Gestor del catálogo maestro de Clientes facturados (Cuentas por Cobrar).
 *
 * - Lista paginable/filtrable
 * - Crear/editar/eliminar manual
 * - Importación masiva desde Excel/CSV
 *   Columnas reconocidas (insensible a mayúsculas y acentos):
 *     codigo / code / cuenta            → code        (obligatorio)
 *     nombre / razon social / cliente   → name        (obligatorio)
 *     contacto                          → contact
 *     telefono                          → phone
 *     correo / email                    → email
 *     direccion / ubicacion             → locationAddress
 *     maps / google maps / enlace       → locationMapsUrl
 *     notas / observaciones             → notes
 *
 * Modo de importación:
 *   - "upsert" (por defecto): agrega nuevos, actualiza existentes por code
 *   - "replace": borra todo y reemplaza con el archivo
 */
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Upload, Search, Download, X } from "lucide-react";
import { toast } from "sonner";
import { billingClientsApi, type BillingClient } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Notifica al padre cuando hubo cambios (para refrescar selectores) */
  onChanged?: () => void;
}

const HEADER_MAP: Record<string, keyof BillingClient | "_skip"> = {
  codigo: "code", code: "code", cuenta: "code", "no. cuenta": "code",
  nombre: "name", "razon social": "name", cliente: "name", "nombre comercial": "name",
  contacto: "contact",
  telefono: "phone", tel: "phone",
  correo: "email", email: "email", "e-mail": "email",
  direccion: "locationAddress", ubicacion: "locationAddress",
  maps: "locationMapsUrl", "google maps": "locationMapsUrl",
  enlace: "locationMapsUrl", url: "locationMapsUrl",
  notas: "notes", observaciones: "notes",
};

function norm(s: any): string {
  return String(s || "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}

async function parseSpreadsheet(file: File): Promise<Partial<BillingClient>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });

  // Encontrar la fila de cabecera
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const joined = (rows[i] || []).map(norm).join("|");
    if ((joined.includes("codigo") || joined.includes("cuenta") || joined.includes("code"))
      && (joined.includes("nombre") || joined.includes("razon social") || joined.includes("cliente"))) {
      headerIdx = i; break;
    }
  }
  if (headerIdx === -1) throw new Error("No se encontró fila de cabecera con 'código/cuenta' y 'nombre/cliente'");

  const headers = (rows[headerIdx] || []).map((h: any) => HEADER_MAP[norm(h)] || "_skip");
  const out: Partial<BillingClient>[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c: any) => String(c || "").trim() === "")) continue;
    const obj: any = {};
    headers.forEach((key, idx) => {
      if (key === "_skip") return;
      const val = String(row[idx] ?? "").trim();
      if (val) obj[key] = val;
    });
    if (obj.code && obj.name) out.push(obj);
  }
  return out;
}

const EMPTY: Partial<BillingClient> = {
  code: "", name: "", contact: "", phone: "", email: "",
  locationAddress: "", locationMapsUrl: "", notes: "", active: true,
};

export default function BillingClientsManager({ open, onOpenChange, onChanged }: Props) {
  const [list, setList] = useState<BillingClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<BillingClient | null>(null);
  const [draft, setDraft] = useState<Partial<BillingClient>>(EMPTY);
  const [importMode, setImportMode] = useState<"upsert" | "replace">("upsert");

  const load = async () => {
    try {
      setLoading(true);
      const items = await billingClientsApi.list();
      setList(items);
    } catch (e: any) {
      if (e.message !== "API_NOT_CONFIGURED") toast.error(`Error al cargar clientes: ${e.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.contact || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q));
  }, [list, search]);

  const startNew = () => { setEditing({} as any); setDraft(EMPTY); };
  const startEdit = (c: BillingClient) => { setEditing(c); setDraft({ ...c }); };
  const cancelEdit = () => { setEditing(null); setDraft(EMPTY); };

  const save = async () => {
    if (!draft.code?.trim() || !draft.name?.trim()) {
      toast.error("Código y nombre son obligatorios"); return;
    }
    try {
      if (editing?.id) {
        await billingClientsApi.update(editing.id, draft);
        toast.success("Cliente actualizado");
      } else {
        await billingClientsApi.create(draft);
        toast.success("Cliente creado");
      }
      cancelEdit();
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(`No se pudo guardar: ${e.message}`);
    }
  };

  const remove = async (c: BillingClient) => {
    if (!confirm(`¿Eliminar cliente ${c.code} — ${c.name}?\nLas LX asociadas quedarán sin cliente vinculado.`)) return;
    try {
      await billingClientsApi.remove(c.id);
      toast.success("Cliente eliminado");
      await load();
      onChanged?.();
    } catch (e: any) { toast.error(`No se pudo eliminar: ${e.message}`); }
  };

  const handleImport = async (file: File) => {
    try {
      setLoading(true);
      const items = await parseSpreadsheet(file);
      if (items.length === 0) { toast.error("No se detectaron clientes válidos en el archivo"); return; }
      const confirmMsg = importMode === "replace"
        ? `MODO REEMPLAZO: se eliminarán los ${list.length} clientes actuales y se cargarán ${items.length} desde el archivo. ¿Continuar?`
        : `MODO ACTUALIZAR: ${items.length} filas detectadas. Los existentes se actualizan por código, los nuevos se agregan. ¿Continuar?`;
      if (!confirm(confirmMsg)) return;
      const res = await billingClientsApi.bulkImport(items, importMode);
      toast.success(`Importación OK — creados: ${res.created}, actualizados: ${res.updated}, omitidos: ${res.skipped}`);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(`Error al importar: ${e.message}`);
    } finally { setLoading(false); }
  };

  const exportCsv = () => {
    const headers = ["code","name","contact","phone","email","locationAddress","locationMapsUrl","notes","active"];
    const csv = [headers.join(",")]
      .concat(list.map(c => headers.map(h => `"${String((c as any)[h] ?? "").replace(/"/g,'""')}"`).join(",")))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Clientes_CxC_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Clientes facturados (Cuentas por Cobrar)</DialogTitle>
          <DialogDescription>
            Catálogo maestro. Cada cliente puede tener varias LX (cuentas Kronos) vinculadas desde el editor de cada cuenta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar código, nombre, contacto, teléfono..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button size="sm" variant="default" onClick={startNew}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo
          </Button>
          <Select value={importMode} onValueChange={(v: any) => setImportMode(v)}>
            <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upsert">Actualizar/agregar</SelectItem>
              <SelectItem value="replace">Reemplazar todo</SelectItem>
            </SelectContent>
          </Select>
          <label>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
            <Button size="sm" variant="outline" disabled={loading} asChild>
              <span className="cursor-pointer">
                <Upload className="h-4 w-4 mr-1" />
                {loading ? "Procesando..." : "Importar"}
              </span>
            </Button>
          </label>
          <Button size="sm" variant="ghost" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
          <Button size="sm" variant="secondary" disabled={loading} onClick={async () => {
            try {
              setLoading(true);
              const res = await fetch("/data/billing_clients_cristy.json");
              const items: Partial<BillingClient>[] = await res.json();
              if (!confirm(`Cargar ${items.length} clientes del listado de Cristy (CxC) en modo UPSERT (no borra los existentes, solo actualiza por código y agrega los nuevos). ¿Continuar?`)) return;
              const r = await billingClientsApi.bulkImport(items, "upsert");
              toast.success(`Listado Cristy aplicado — creados: ${r.created}, actualizados: ${r.updated}, omitidos: ${r.skipped}`);
              await load(); onChanged?.();
            } catch (e: any) { toast.error(`No se pudo cargar listado Cristy: ${e.message}`); }
            finally { setLoading(false); }
          }}>
            📋 Cargar listado Cristy
          </Button>
        </div>

        {editing && (
          <div className="border rounded-md p-3 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{editing?.id ? `Editando ${editing.code}` : "Nuevo cliente CxC"}</p>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}><X className="h-3 w-3" /></Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div><Label className="text-xs">Código *</Label>
                <Input value={draft.code || ""} disabled={!!editing?.id}
                  onChange={e => setDraft(d => ({ ...d, code: e.target.value }))} /></div>
              <div className="col-span-2"><Label className="text-xs">Nombre *</Label>
                <Input value={draft.name || ""} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></div>
              <div><Label className="text-xs">Activo</Label>
                <Select value={draft.active === false ? "no" : "si"}
                  onValueChange={v => setDraft(d => ({ ...d, active: v === "si" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="si">Activo</SelectItem>
                    <SelectItem value="no">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Contacto</Label>
                <Input value={draft.contact || ""} onChange={e => setDraft(d => ({ ...d, contact: e.target.value }))} /></div>
              <div><Label className="text-xs">Teléfono</Label>
                <Input value={draft.phone || ""} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} /></div>
              <div className="col-span-2"><Label className="text-xs">Email</Label>
                <Input value={draft.email || ""} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} /></div>
              <div className="col-span-2"><Label className="text-xs">Dirección</Label>
                <Input value={draft.locationAddress || ""}
                  onChange={e => setDraft(d => ({ ...d, locationAddress: e.target.value }))} /></div>
              <div className="col-span-2"><Label className="text-xs">Google Maps (URL)</Label>
                <Input placeholder="https://maps.app.goo.gl/..." value={draft.locationMapsUrl || ""}
                  onChange={e => setDraft(d => ({ ...d, locationMapsUrl: e.target.value }))} /></div>
              <div className="col-span-4"><Label className="text-xs">Notas</Label>
                <Input value={draft.notes || ""} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancelar</Button>
              <Button size="sm" onClick={save}>Guardar</Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[100px]">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead className="w-[80px]">Estado</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {loading ? "Cargando..." : "Sin clientes. Importa el listado o crea uno nuevo."}
                </TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.code}</TableCell>
                  <TableCell className="text-sm font-medium">{c.name}</TableCell>
                  <TableCell className="text-xs">{c.contact || "—"}</TableCell>
                  <TableCell className="text-xs">{c.phone || "—"}</TableCell>
                  <TableCell className="text-xs max-w-[260px] truncate" title={c.locationAddress}>
                    {c.locationAddress || (c.locationMapsUrl ? <span className="text-blue-400">📍 Maps</span> : "—")}
                  </TableCell>
                  <TableCell>
                    {c.active ? <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Activo</Badge>
                      : <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={() => remove(c)}>
                        <Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="text-xs text-muted-foreground">
          {list.length} clientes en catálogo · {filtered.length} mostrados
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
