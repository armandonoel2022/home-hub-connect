import { Flashlight, Footprints, HardHat, Minus, Plus, Shirt, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UNIFORM_CATEGORIES,
  UNIFORM_SIZES,
  type OpsUniformCategory,
  type OpsUniformItem,
} from "@/lib/opsHrRequests";

const iconFor = (category: OpsUniformCategory) => {
  if (category === "Zapatos" || category === "Botas tipo militar") return Footprints;
  if (category === "Gorras") return HardHat;
  if (category === "Linternas") return Flashlight;
  if (category === "Holster (funda o pistolera)" || category === "Correas") return ShoppingBag;
  return Shirt;
};

const sizeApplies = (category: OpsUniformCategory) => [
  "Camisas mangas largas",
  "Camisas mangas cortas",
  "T-shirts",
  "Pantalones tipo Cargo con bolsillos laterales",
  "Pantalones",
  "Zapatos",
  "Botas tipo militar",
  "Jackets",
].includes(category);

interface Props {
  value: OpsUniformItem[];
  onChange: (items: OpsUniformItem[]) => void;
}

export default function UniformItemPicker({ value, onChange }: Props) {
  const add = (category: OpsUniformCategory) => {
    onChange([...value, {
      id: `uniform-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category,
      quantity: 1,
      size: sizeApplies(category) ? "M" : "",
      customDescription: "",
    }]);
  };

  const countFor = (category: OpsUniformCategory) => value.filter(item => item.category === category).length;
  const update = (id: string, patch: Partial<OpsUniformItem>) => onChange(value.map(item => item.id === id ? { ...item, ...patch } : item));
  const remove = (id: string) => onChange(value.filter(item => item.id !== id));

  return (
    <section className="space-y-4 rounded-md border border-operations-border bg-muted/20 p-4" aria-labelledby="uniform-heading">
      <div>
        <h3 id="uniform-heading" className="text-sm font-semibold">Indumentaria solicitada</h3>
        <p className="mt-1 text-xs text-muted-foreground">Toque una categoría para agregar una prenda. Tóquela de nuevo para pedir la misma prenda en otra talla o más unidades.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {UNIFORM_CATEGORIES.map(category => {
          const Icon = iconFor(category);
          const count = countFor(category);
          return (
            <Button
              key={category}
              type="button"
              variant="outline"
              className={`relative h-24 whitespace-normal px-2 py-3 flex-col gap-2 text-center text-xs leading-tight ${count > 0 ? "border-operations bg-operations-soft text-operations" : "bg-card"}`}
              onClick={() => add(category)}
            >
              <Icon className="h-6 w-6 shrink-0" />
              <span>{category}</span>
              {count > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-operations px-1 text-[10px] font-bold text-primary-foreground" aria-label={`${count} en la solicitud`}>{count}</span>
              )}
            </Button>
          );
        })}
      </div>

      {value.length > 0 && (
        <div className="space-y-2" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{value.length} prenda(s) en la solicitud</span><span className="font-semibold text-operations">Total: {value.reduce((sum, item) => sum + item.quantity, 0)} unidad(es)</span></div>
          {value.map(item => {
            const Icon = iconFor(item.category);
            return (
              <div key={item.id} className="grid gap-2 rounded-md border border-border bg-card p-3 sm:grid-cols-[minmax(180px,1fr)_140px_130px_40px] sm:items-end">
                <div className="min-w-0">
                  <Label className="flex items-center gap-2 text-xs"><Icon className="h-4 w-4 text-operations" />Prenda</Label>
                  <div className="mt-2 text-sm font-semibold">{item.category}</div>
                  {item.category === "Otros" && (
                    <Input
                      className="mt-2"
                      maxLength={120}
                      placeholder="Escriba la indumentaria *"
                      value={item.customDescription || ""}
                      onChange={event => update(item.id, { customDescription: event.target.value })}
                    />
                  )}
                </div>
                <div>
                  <Label className="text-xs">Talla{sizeApplies(item.category) ? " *" : ""}</Label>
                  {sizeApplies(item.category) ? (
                    <Select value={item.size || "M"} onValueChange={size => update(item.id, { size })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{UNIFORM_SIZES.map(size => <SelectItem key={size} value={size}>{size}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <div className="mt-1 h-10 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">No aplica</div>}
                </div>
                <div>
                  <Label className="text-xs">Cantidad *</Label>
                  <div className="mt-1 flex h-10 items-center rounded-md border border-input bg-background">
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`Reducir cantidad de ${item.category}`} onClick={() => update(item.id, { quantity: Math.max(1, item.quantity - 1) })}><Minus className="h-3.5 w-3.5" /></Button>
                    <Input className="h-8 min-w-0 border-0 px-1 text-center shadow-none" type="number" min={1} max={50} value={item.quantity} onChange={event => update(item.id, { quantity: Math.min(50, Math.max(1, Number(event.target.value) || 1)) })} />
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`Aumentar cantidad de ${item.category}`} onClick={() => update(item.id, { quantity: Math.min(50, item.quantity + 1) })}><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label={`Quitar ${item.category}`} onClick={() => remove(item.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}