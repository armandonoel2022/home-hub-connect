import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import type { FleetSupplier } from "@/lib/api";

interface Props {
  suppliers: FleetSupplier[];
  /** Nombre del taller guardado (puede ser un nombre antiguo sin vincular). */
  value: string | null | undefined;
  valueOid: number | null | undefined;
  onSelect: (s: FleetSupplier) => void;
  placeholder?: string;
  ariaLabel?: string;
}

/** Selector de taller a partir de los suplidores registrados en Adonis (SafeOne). */
export default function TallerSupplierPicker({ suppliers, value, valueOid, onSelect, placeholder, ariaLabel = "Taller" }: Props) {
  const [open, setOpen] = useState(false);
  const selected = valueOid != null ? suppliers.find((s) => s.oid === Number(valueOid)) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} aria-label={ariaLabel}
          className="w-full justify-between font-normal h-auto min-h-10 py-2 text-left">
          {selected ? (
            <span className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{selected.nombre}</span>
            </span>
          ) : value ? (
            <span className="truncate text-muted-foreground" title="Nombre sin vincular a un suplidor de Adonis">{value} · sin vincular</span>
          ) : (
            <span className="text-muted-foreground">{placeholder || "Seleccione el suplidor…"}</span>
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar suplidor por nombre o RNC…" />
          <CommandList className="max-h-72">
            <CommandEmpty>No hay un suplidor con ese nombre en Adonis.</CommandEmpty>
            <CommandGroup>
              {suppliers.map((s) => (
                <CommandItem key={s.oid} value={`${s.nombre} ${s.documento || ""} ${s.oid}`}
                  onSelect={() => { onSelect(s); setOpen(false); }}>
                  <Check className={`h-4 w-4 mr-2 shrink-0 ${selected?.oid === s.oid ? "opacity-100" : "opacity-0"}`} />
                  <span className="flex-1 truncate">{s.nombre}</span>
                  {s.documento && <span className="text-[10px] text-muted-foreground font-mono ml-2">{s.documento}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
