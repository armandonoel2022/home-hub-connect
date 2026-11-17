import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Loader2, Merge, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fleetMaintenanceApi, type FleetSupplier, type FleetTallerGroup } from "@/lib/api";
import { formatRD } from "@/lib/fleetMaintenanceData";
import TallerSupplierPicker from "./TallerSupplierPicker";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  suppliers: FleetSupplier[];
  onDone: () => void;
}

type Choice = { oid: number | null; include: boolean };

/**
 * Agrupa los talleres escritos de distintas formas ("La Chercha", "La Chercha SRL"…)
 * y los vincula al suplidor oficial de Adonis. Solo cambia datos de la intranet:
 * el nombre anterior queda guardado en cada gasto y se hace un respaldo antes.
 */
export default function TallerUnifyDialog({ open, onOpenChange, suppliers, onDone }: Props) {
  const { toast } = useToast();
  const [groups, setGroups] = useState<FleetTallerGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGroups(null); setError(null);
    fleetMaintenanceApi.tallerGroups()
      .then((r) => {
        if (!r.connected) setError(r.message || "No se pudo leer la lista de suplidores de SafeOne.");
        setGroups(r.grupos);
        const init: Record<string, Choice> = {};
        for (const g of r.grupos) {
          const linked = g.tallerOid != null && g.sugerencia?.oid === g.tallerOid && g.variantes.length === 1 && g.nombre === g.sugerencia?.nombre;
          init[g.clave] = { oid: g.sugerencia?.oid ?? null, include: !!g.sugerencia && !linked };
        }
        setChoices(init);
      })
      .catch((e) => setError(e.message));
  }, [open]);

  const selected = useMemo(
    () => (groups || []).filter((g) => choices[g.clave]?.include && choices[g.clave]?.oid != null),
    [groups, choices],
  );
  const affected = selected.reduce((s, g) => s + g.cantidad, 0);

  const apply = async () => {
    if (!selected.length) return;
    setSaving(true);
    try {
      const r = await fleetMaintenanceApi.unifyTalleres(selected.map((g) => ({ variantes: g.variantes, oid: choices[g.clave].oid! })));
      toast({ title: `${r.cambiados} gasto(s) vinculados a su suplidor`, description: r.respaldo ? `Respaldo guardado: ${r.respaldo}` : undefined });
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "No se pudo unificar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Merge className="h-5 w-5 text-primary" /> Unificar talleres con los suplidores de Adonis</DialogTitle>
          <DialogDescription>
            Cada fila agrupa los nombres escritos en la intranet. Elija el suplidor oficial y confirme.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p>No se borra nada. SafeOne solo se lee. Antes del cambio se guarda un respaldo completo de los gastos y cada gasto conserva el nombre que tenía.</p>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {!groups ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Leyendo talleres…</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Nombre en la intranet</TableHead>
                  <TableHead className="text-right">Gastos</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="min-w-[300px]">Suplidor en Adonis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => {
                  const c = choices[g.clave] || { oid: null, include: false };
                  const linked = g.tallerOid != null && g.tallerOid === c.oid && g.variantes.length === 1;
                  return (
                    <TableRow key={g.clave}>
                      <TableCell>
                        <Checkbox aria-label={`Incluir ${g.nombre}`} checked={c.include} disabled={c.oid == null}
                          onCheckedChange={(v) => setChoices((s) => ({ ...s, [g.clave]: { ...c, include: !!v } }))} />
                      </TableCell>
                      <TableCell className="text-xs">
                        <p className="font-medium">{g.nombre}</p>
                        {g.variantes.length > 1 && <p className="text-muted-foreground">También escrito: {g.variantes.filter((v) => v !== g.nombre).join(" · ")}</p>}
                        {linked && <Badge variant="secondary" className="mt-1 text-[10px]">Ya vinculado</Badge>}
                        {!g.sugerencia && <Badge variant="outline" className="mt-1 text-[10px] border-destructive/50 text-destructive">Sin coincidencia: elíjalo a mano</Badge>}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{g.cantidad}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{formatRD(g.monto)}</TableCell>
                      <TableCell>
                        <TallerSupplierPicker suppliers={suppliers} value={null} valueOid={c.oid} ariaLabel={`Suplidor para ${g.nombre}`}
                          onSelect={(s) => setChoices((st) => ({ ...st, [g.clave]: { oid: s.oid, include: true } }))} />
                        {g.sugerencia && !g.sugerencia.exacto && c.oid === g.sugerencia.oid && (
                          <p className="text-[10px] text-muted-foreground mt-1">Sugerido por nombre parecido · revise antes de confirmar</p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <p className="text-xs text-muted-foreground mr-auto self-center">{selected.length} taller(es) · {affected} gasto(s) se vincularán</p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={apply} disabled={!selected.length || saving} className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />} Unificar seleccionados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
