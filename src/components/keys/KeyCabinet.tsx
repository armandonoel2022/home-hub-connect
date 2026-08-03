import { memo, useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DoorOpen, DoorClosed, Search, KeyRound } from "lucide-react";
import type { KeyRecord } from "@/lib/keysData";
import CabinetDoor from "./CabinetDoor";
import CabinetClosed from "./CabinetClosed";

import { cabinetVariants, perspective } from "./animations";
import { cabinetLayout, leftRailYs, rightRailYs } from "./cabinetLayout";
import {
  COLOR_TOKENS,
  ESTADO_TO_CABINET,
  normalizeColor,
  type CabinetCounters,
  type CabinetKeyColor,
  type CabinetKeyView,
} from "./types";

export interface KeyCabinetProps {
  keys: KeyRecord[];
  onSelect: (key: KeyRecord) => void;
  editMode?: boolean;
  /** Persistencia opcional de cambios rápidos (color / posición / nombre). */
  onUpdate?: (id: string, patch: Partial<KeyRecord>) => void;
}

const COLOR_LABELS: Record<CabinetKeyColor, string> = {
  yellow: "Amarillo",
  red: "Rojo",
  green: "Verde",
  blue: "Azul",
  black: "Negro",
  white: "Blanco",
  gray: "Gris",
  orange: "Naranja",
  purple: "Morado",
  transparent: "Transparente",
};

const COLOR_TO_ES: Record<CabinetKeyColor, string> = {
  yellow: "Amarillo",
  red: "Rojo",
  green: "Verde",
  blue: "Azul",
  black: "Negro",
  white: "Blanco",
  gray: "Gris",
  orange: "Naranja",
  purple: "Morado",
  transparent: "",
};

/** Extrae el código de posición ("001"…"040") desde el código/id de la llave. */
function slotCodeOf(k: KeyRecord): string | null {
  // Busca un número de 3 dígitos en el código o id
  const text = `${k.code || ""} ${k.id || ""}`;
  const m = text.match(/(\d{3})/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0 || n > 41) return null;
  return String(n).padStart(3, "0");
}

/**
 * Una llave está "fuera" del gabinete (gancho vacío + etiqueta Prestada) solo
 * cuando no queda ninguna copia física en la caja o está extraviada/retirada.
 * El estado "asignada" con copia en caja sigue colgando del gancho.
 */
function isOut(k: KeyRecord): boolean {
  // Si está prestada, extraviada o retirada → está fuera del gabinete
  if (k.estado === "extraviada" || k.estado === "retirada") {
    return true;
  }
  // Si no tiene copias en caja, también está fuera
  if (typeof k.cantidadEnCaja === "number") {
    return k.cantidadEnCaja <= 0;
  }
  return false;
}

function KeyCabinetBase({ keys, onSelect, editMode = false, onUpdate }: KeyCabinetProps) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<KeyRecord | null>(null);

  const bySlot = useMemo(() => {
    const map = new Map<string, KeyRecord>();
    const leftovers: KeyRecord[] = [];
    keys.forEach((k) => {
      const code = slotCodeOf(k);
      if (code && !map.has(code)) map.set(code, k);
      else leftovers.push(k);
    });
    // Rellena posiciones libres con llaves sin código posicional
    for (const slot of cabinetLayout) {
      if (map.has(slot.code)) continue;
      const next = leftovers.shift();
      if (!next) break;
      map.set(slot.code, next);
    }
    return map;
  }, [keys]);

  const views = useMemo<CabinetKeyView[]>(
    () =>
      cabinetLayout.map((slot) => {
        const record = bySlot.get(slot.code) ?? null;
        return {
          slot,
          record,
          out: record ? isOut(record) : false,
          state: record ? ESTADO_TO_CABINET[record.estado] : "available",
          color: normalizeColor(record?.colorIdentificador),
          label: record?.descripcion || record?.perteneceA || "",
        };
      }),
    [bySlot],
  );

  const counters = useMemo<CabinetCounters>(() => {
    const c: CabinetCounters = { available: 0, assigned: 0, maintenance: 0, lost: 0, empty: 0 };
    views.forEach((v) => {
      if (!v.record) {
        c.empty++;
        return;
      }
      c[v.state]++;
    });
    return c;
  }, [views]);

  const highlightedCode = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return null;
    const hit = views.find(
      (v) =>
        v.record &&
        (v.slot.code.includes(t) ||
          v.record.code.toLowerCase().includes(t) ||
          v.record.descripcion.toLowerCase().includes(t) ||
          v.record.responsable.toLowerCase().includes(t) ||
          v.record.perteneceA.toLowerCase().includes(t)),
    );
    return hit ? hit.slot.code : null;
  }, [query, views]);

  const handleSelect = useCallback(
    (view: CabinetKeyView) => {
      if (!view.record) return;
      onSelect(view.record);
      if (editMode) setEditing(view.record);
    },
    [editMode, onSelect],
  );


  /** Registro de movimientos consolidado desde el historial de cada llave. */
  const movements = useMemo(() => {
    const rows = keys.flatMap((k) => (k.historial || []).map((h) => ({ ...h, keyCode: k.code || k.id })));
    return rows.sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 12);
  }, [keys]);

  const leftItems = useMemo(() => views.filter((v) => v.slot.door === "left"), [views]);
  const rightItems = useMemo(() => views.filter((v) => v.slot.door === "right"), [views]);

  return (
    <div className="space-y-4">
      {/* Barra de control */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setOpen((o) => !o)} variant={open ? "default" : "outline"} className="gap-2">
          {open ? <DoorOpen className="h-4 w-4" /> : <DoorClosed className="h-4 w-4" />}
          {open ? "Cerrar gabinete" : "Abrir gabinete"}
        </Button>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Resaltar llave en el gabinete..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar y resaltar llave en el gabinete"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="gap-1">
            <KeyRound className="h-3 w-3" /> {counters.available} disponibles
          </Badge>
          <Badge variant="secondary">{counters.assigned} prestadas</Badge>
          <Badge variant="outline">{counters.maintenance} mantenimiento</Badge>
          <Badge variant="destructive">{counters.lost} extraviadas</Badge>
        </div>
      </div>

      {/* Gabinete */}
      <div className="rounded-2xl border bg-gradient-to-b from-muted/60 to-background p-4 md:p-8 overflow-auto">
        {!open ? (
          <CabinetClosed total={keys.length} onOpen={() => setOpen(true)} />
        ) : (
          <motion.div
            className="mx-auto flex min-w-[720px] max-w-5xl items-stretch justify-center gap-1"
            style={{ perspective, transformStyle: "preserve-3d" }}
            variants={cabinetVariants}
            initial="hidden"
            animate="visible"
          >
            <CabinetDoor
              side="left"
              open={open}
              items={leftItems}
              railYs={leftRailYs}
              highlightedCode={highlightedCode}
              onSelect={handleSelect}
            />
            {/* bisagra central */}
            <div
              className="w-2.5 shrink-0 rounded-full bg-gradient-to-r from-slate-400 via-slate-200 to-slate-500 shadow-inner"
              aria-hidden="true"
            />
            <CabinetDoor
              side="right"
              open={open}
              items={rightItems}
              railYs={rightRailYs}
              highlightedCode={highlightedCode}
              onSelect={handleSelect}
              showLock
            />
          </motion.div>
        )}
      </div>


      {/* Registro de movimientos */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-2 text-sm font-semibold">Registro de movimientos</div>
        {movements.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Sin movimientos registrados.</p>
        ) : (
          <ul className="divide-y">
            {movements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  {m.fecha.slice(0, 16).replace("T", " ")}
                </span>
                <Badge variant="outline" className="capitalize">
                  {m.accion}
                </Badge>
                <span className="font-medium">{m.keyCode}</span>
                <span className="text-muted-foreground">{m.persona}</span>
                {m.motivo && <span className="text-xs text-muted-foreground">· {m.motivo}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modo edición */}
      {editMode && editing && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Editar {editing.code}</h4>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onSelect(editing)}>
                Abrir detalle
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cerrar
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Color</label>
              <Select
                value={normalizeColor(editing.colorIdentificador)}
                onValueChange={(v) => {
                  const patch = { colorIdentificador: COLOR_TO_ES[v as CabinetKeyColor] };
                  setEditing({ ...editing, ...patch });
                  onUpdate?.(editing.id, patch);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(COLOR_LABELS) as CabinetKeyColor[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full border" style={{ background: COLOR_TOKENS[c].body }} />
                        {COLOR_LABELS[c]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Posición (código)</label>
              <Input
                value={editing.code}
                onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                onBlur={() => onUpdate?.(editing.id, { code: editing.code })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nombre / pertenece a</label>
              <Input
                value={editing.perteneceA}
                onChange={(e) => setEditing({ ...editing, perteneceA: e.target.value })}
                onBlur={() => onUpdate?.(editing.id, { perteneceA: editing.perteneceA })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Descripción</label>
              <Input
                value={editing.descripcion}
                onChange={(e) => setEditing({ ...editing, descripcion: e.target.value })}
                onBlur={() => onUpdate?.(editing.id, { descripcion: editing.descripcion })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const KeyCabinet = memo(KeyCabinetBase);
export default KeyCabinet;
