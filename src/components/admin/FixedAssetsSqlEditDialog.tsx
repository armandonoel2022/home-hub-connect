import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Lock, Save, History, ShieldAlert } from "lucide-react";
import {
  fixedAssetsSqlApi,
  SAFEONE_EDITABLE_FIELDS,
  type SafeOneEditableField,
  type SafeOneActivoFijoRow,
  type SafeOneAssetAuditEntry,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Props {
  row: SafeOneActivoFijoRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: (row: SafeOneActivoFijoRow) => void;
}

export default function FixedAssetsSqlEditDialog({ row, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState<SafeOneAssetAuditEntry[]>([]);

  useEffect(() => {
    if (!row || !open) return;
    const init: Record<string, string> = {};
    SAFEONE_EDITABLE_FIELDS.forEach(f => {
      const v = (row as any)[f.key];
      init[f.key] = v == null || v === "NULL" ? "" : String(v);
    });
    setValues(init);
    fixedAssetsSqlApi.audit(row.OID).then(setAudit).catch(() => setAudit([]));
  }, [row, open]);

  const dirty = row
    ? SAFEONE_EDITABLE_FIELDS.filter(f => {
        const orig = (row as any)[f.key];
        const o = orig == null || orig === "NULL" ? "" : String(orig);
        return (values[f.key] ?? "") !== o;
      })
    : [];

  const save = async () => {
    if (!row || !dirty.length) return;
    setSaving(true);
    try {
      const payload: Partial<Record<SafeOneEditableField, string | null>> = {};
      dirty.forEach(f => { payload[f.key] = values[f.key] === "" ? null : values[f.key]; });
      const res = await fixedAssetsSqlApi.updateActivoFijo(row.OID, payload);
      toast({
        title: res.updated ? "Activo actualizado en SafeOne" : "Sin cambios",
        description: res.updated ? `${dirty.length} campo(s) modificado(s) · OID ${row.OID}` : res.message,
      });
      if (res.updated && res.row) onSaved?.(res.row);
      const list = await fixedAssetsSqlApi.audit(row.OID).catch(() => []);
      setAudit(list);
      if (res.updated) onOpenChange(false);
    } catch (e: any) {
      toast({ title: "No se pudo actualizar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar activo · OID {row?.OID}</DialogTitle>
          <DialogDescription>
            Los cambios se escriben directamente en <code>[SafeOne].[dbo].[ActivoFijo]</code>. Solo se permite
            actualizar; eliminar está deshabilitado y cada cambio queda registrado en la auditoría.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
          <span>Costos, depreciaciones, fechas contables y el estado de retiro son <b>solo lectura</b>.</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {SAFEONE_EDITABLE_FIELDS.map(f => (
            <div key={f.key} className={f.key === "Comentario" ? "sm:col-span-2" : ""}>
              <Label className="text-xs">{f.label}</Label>
              <Input
                value={values[f.key] ?? ""}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder="—"
              />
            </div>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
          <ReadOnly label="Costo Adq." value={row?.CostoAdq == null ? "—" : Number(row.CostoAdq).toLocaleString("es-DO", { style: "currency", currency: "DOP" })} />
          <ReadOnly label="Fecha Adq." value={row?.FechaAdq ? new Date(row.FechaAdq).toLocaleDateString("es-DO") : "—"} />
          <ReadOnly label="Retirado" value={row?.Retirado ? "Sí" : "No"} />
        </div>

        {audit.length > 0 && (
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <History className="h-4 w-4" /> Historial de cambios ({audit.length})
            </div>
            <div className="space-y-2 max-h-48 overflow-auto">
              {audit.map(a => (
                <div key={a.id} className="text-xs border-t pt-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{a.by}</span>
                    <span>{new Date(a.at).toLocaleString("es-DO")}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(a.changes).map(([k, c]) => (
                      <Badge key={k} variant="outline" className="font-normal">
                        {k}: <span className="line-through mx-1 opacity-60">{String(c.from ?? "—")}</span> → {String(c.to ?? "—")}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <span className="mr-auto text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Sin eliminación · {dirty.length} cambio(s) pendiente(s)
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !dirty.length}>
            <Save className="h-4 w-4 mr-2" />{saving ? "Guardando..." : "Guardar en SafeOne"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <div className="uppercase tracking-wide text-[10px]">{label}</div>
      <div className="text-foreground font-medium">{value}</div>
    </div>
  );
}
