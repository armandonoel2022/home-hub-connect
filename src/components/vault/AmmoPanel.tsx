// Bóveda de Armas — panel editable de municiones (buenas y dañadas).

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Boxes, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import municionesImg from "@/assets/municiones-boveda.jpg";
import {
  getAmmo, saveAmmo, getDamagedAmmo, saveDamagedAmmo,
  newAmmoRow, newDamagedRow, totalAmmo, ammoByTipo,
  type AmmoRow, type DamagedAmmoRow,
} from "@/lib/vaultAmmo";

export default function AmmoPanel() {
  const { toast } = useToast();
  const [ammo, setAmmo] = useState<AmmoRow[]>([]);
  const [damaged, setDamaged] = useState<DamagedAmmoRow[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setAmmo(getAmmo());
    setDamaged(getDamagedAmmo());
  }, []);

  const upd = <T extends { id: string }>(list: T[], id: string, patch: Partial<T>) =>
    list.map((r) => (r.id === id ? { ...r, ...patch } : r));

  const guardar = () => {
    saveAmmo(ammo);
    saveDamagedAmmo(damaged);
    setDirty(false);
    toast({ title: "Municiones actualizadas", description: "El inventario de la bóveda fue guardado." });
  };

  const porTipo = ammoByTipo(ammo);

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div className="relative">
          <img
            src={municionesImg}
            alt="Municiones resguardadas en la bóveda de SafeOne"
            loading="lazy"
            width={1024}
            height={512}
            className="h-36 w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 to-background/20 flex flex-col justify-center px-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" /> Municiones en bóveda
            </h2>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary">Total: <strong className="ml-1">{totalAmmo(ammo)}</strong></Badge>
              {Object.entries(porTipo).map(([k, v]) => (
                <Badge key={k} variant="outline" className="capitalize">{k}: {v}</Badge>
              ))}
              <Badge variant="outline" className="text-destructive border-destructive/40">
                Dañadas: {totalAmmo(damaged)}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" onClick={guardar} disabled={!dirty}>
          <Save className="h-4 w-4 mr-1" /> Guardar cambios
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Inventario de municiones</h3>
            <Button size="sm" variant="outline" onClick={() => { setAmmo([...ammo, newAmmoRow()]); setDirty(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="py-1 pr-2">Calibre</th>
                  <th className="py-1 pr-2 w-28">Cantidad</th>
                  <th className="py-1 pr-2">Tipo</th>
                  <th className="py-1 w-10" />
                </tr>
              </thead>
              <tbody>
                {ammo.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-1 pr-2">
                      <Input aria-label="Calibre" className="h-8" value={r.calibre}
                        onChange={(e) => { setAmmo(upd(ammo, r.id, { calibre: e.target.value })); setDirty(true); }} />
                    </td>
                    <td className="py-1 pr-2">
                      <Input aria-label="Cantidad" type="number" className="h-8" value={r.cantidad}
                        onChange={(e) => { setAmmo(upd(ammo, r.id, { cantidad: Number(e.target.value) })); setDirty(true); }} />
                    </td>
                    <td className="py-1 pr-2">
                      <Input aria-label="Tipo" className="h-8" value={r.tipo}
                        onChange={(e) => { setAmmo(upd(ammo, r.id, { tipo: e.target.value })); setDirty(true); }} />
                    </td>
                    <td className="py-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Eliminar fila"
                        onClick={() => { setAmmo(ammo.filter((x) => x.id !== r.id)); setDirty(true); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Municiones dañadas
            </h3>
            <Button size="sm" variant="outline" onClick={() => { setDamaged([...damaged, newDamagedRow()]); setDirty(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="py-1 pr-2">Descripción</th>
                  <th className="py-1 pr-2 w-28">Cantidad</th>
                  <th className="py-1 pr-2 w-28">Calibre</th>
                  <th className="py-1 w-10" />
                </tr>
              </thead>
              <tbody>
                {damaged.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-1 pr-2">
                      <Input aria-label="Descripción" className="h-8" value={r.descripcion}
                        onChange={(e) => { setDamaged(upd(damaged, r.id, { descripcion: e.target.value })); setDirty(true); }} />
                    </td>
                    <td className="py-1 pr-2">
                      <Input aria-label="Cantidad dañada" type="number" className="h-8" value={r.cantidad}
                        onChange={(e) => { setDamaged(upd(damaged, r.id, { cantidad: Number(e.target.value) })); setDirty(true); }} />
                    </td>
                    <td className="py-1 pr-2">
                      <Input aria-label="Calibre dañada" className="h-8" value={r.calibre}
                        onChange={(e) => { setDamaged(upd(damaged, r.id, { calibre: e.target.value })); setDirty(true); }} />
                    </td>
                    <td className="py-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Eliminar fila dañada"
                        onClick={() => { setDamaged(damaged.filter((x) => x.id !== r.id)); setDirty(true); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
