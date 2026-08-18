// Bóveda de Armas — escena interactiva.
// Puerta acorazada (framer-motion) que se abre y revela el interior: racks de
// madera con escopetas en vertical y pistolas / revólveres en horizontal.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DoorClosed, DoorOpen, Crosshair } from "lucide-react";
import { KIND_LABEL, type VaultWeaponState, type WeaponKind } from "@/lib/vaultWeapons";
import { WeaponGlyph } from "./WeaponSvgs";

interface Props {
  weapons: VaultWeaponState[];
  counts: Record<WeaponKind, { total: number; boveda: number; puesto: number }>;
  onSelect: (w: VaultWeaponState) => void;
}

const spring = { type: "spring" as const, stiffness: 90, damping: 18, mass: 1 };

export default function VaultRoom({ weapons, counts, onSelect }: Props) {
  const [open, setOpen] = useState(true);

  const escopetas = weapons.filter((w) => w.kind === "escopeta");
  const cortas = weapons.filter((w) => w.kind !== "escopeta");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} aria-pressed={open}>
          {open ? <DoorOpen className="h-4 w-4 mr-1" /> : <DoorClosed className="h-4 w-4 mr-1" />}
          {open ? "Cerrar bóveda" : "Abrir bóveda"}
        </Button>
        {(Object.keys(KIND_LABEL) as WeaponKind[]).map((k) => (
          <Badge key={k} variant="secondary" className="text-[11px] gap-1">
            {KIND_LABEL[k]}: <strong>{counts[k].total}</strong>
            <span className="text-muted-foreground">({counts[k].boveda} bóveda · {counts[k].puesto} puesto)</span>
          </Badge>
        ))}
      </div>

      <div
        className="relative rounded-xl overflow-hidden border border-border bg-[#1b1e22] min-h-[420px]"
        style={{ perspective: 2000 }}
        role="region"
        aria-label="Bóveda de armas"
      >
        {/* Interior */}
        <motion.div
          className="p-4 sm:p-6"
          initial={false}
          animate={{ opacity: open ? 1 : 0.25, scale: open ? 1 : 0.98 }}
          transition={spring}
        >
          {/* Rack vertical — escopetas */}
          <div className="rounded-lg p-3 mb-4" style={{ background: "linear-gradient(180deg,#6b4423,#40270f)" }}>
            <p className="text-[11px] uppercase tracking-wide text-amber-100/80 mb-2">
              Rack vertical · Escopetas ({escopetas.length})
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {escopetas.length === 0 && <p className="text-xs text-amber-100/60">Sin escopetas registradas.</p>}
              {escopetas.map((w, i) => (
                <motion.button
                  key={w.serial}
                  type="button"
                  onClick={() => onSelect(w)}
                  aria-label={`Escopeta ${w.serial}, ${w.enBoveda ? "en bóveda" : "en puesto"}`}
                  className="shrink-0 w-[68px] rounded-md bg-black/25 border border-amber-900/50 p-1 focus:outline-none focus:ring-2 focus:ring-gold"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring, delay: open ? 0.15 + i * 0.03 : 0 }}
                  whileHover={{ y: -4, scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <WeaponGlyph kind="escopeta" className="h-28 w-full" dim={!w.enBoveda} />
                  <span className="block text-[9px] text-amber-50/90 truncate">{w.serial}</span>
                  <span className={`block text-[9px] ${w.enBoveda ? "text-emerald-300" : "text-amber-300"}`}>
                    {w.enBoveda ? "En bóveda" : "En puesto"}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Estantes horizontales — pistolas y revólveres */}
          <div className="rounded-lg p-3" style={{ background: "linear-gradient(180deg,#5f3d1f,#3a230e)" }}>
            <p className="text-[11px] uppercase tracking-wide text-amber-100/80 mb-2">
              Estantes horizontales · Pistolas y revólveres ({cortas.length})
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[320px] overflow-y-auto pr-1">
              {cortas.length === 0 && <p className="text-xs text-amber-100/60">Sin armas cortas registradas.</p>}
              {cortas.map((w, i) => (
                <motion.button
                  key={w.serial}
                  type="button"
                  onClick={() => onSelect(w)}
                  aria-label={`${w.kind} ${w.serial}, ${w.enBoveda ? "en bóveda" : "en puesto"}`}
                  className="rounded-md bg-black/25 border border-amber-900/50 p-2 text-left focus:outline-none focus:ring-2 focus:ring-gold"
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...spring, delay: open ? 0.2 + i * 0.012 : 0 }}
                  whileHover={{ y: -3, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <WeaponGlyph kind={w.kind} className="h-12 w-full" dim={!w.enBoveda} />
                  <span className="block text-[10px] text-amber-50/90 truncate">{w.serial}</span>
                  <span className={`block text-[9px] truncate ${w.enBoveda ? "text-emerald-300" : "text-amber-300"}`}>
                    {w.enBoveda ? "En bóveda" : w.asignadoA || "En puesto"}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Puerta acorazada */}
        <AnimatePresence>
          {!open && (
            <motion.button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Abrir la puerta de la bóveda"
              className="absolute inset-0 origin-left focus:outline-none"
              style={{ transformStyle: "preserve-3d" }}
              initial={{ rotateY: -95, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: -95, opacity: 0 }}
              transition={spring}
            >
              <div
                className="h-full w-full relative"
                style={{ background: "linear-gradient(105deg,#9aa1a8,#6f767d 45%,#565c62 70%,#7d848b)" }}
              >
                {/* bisagras / pernos laterales */}
                <div className="absolute inset-y-0 right-0 w-8 flex flex-col justify-around items-center bg-[#5c6268]">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <span key={i} className="h-5 w-5 rounded-full bg-[#c9ced3] shadow-inner" />
                  ))}
                </div>
                {/* volante */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
                  <motion.div
                    className="h-28 w-28 rounded-full border-[10px] border-[#c9ced3] bg-[#7d848b] flex items-center justify-center"
                    animate={{ rotate: [0, 8, -8, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Crosshair className="h-10 w-10 text-[#e6eaee]" />
                  </motion.div>
                  <span className="text-xs font-semibold tracking-[0.3em] text-[#e6eaee]">SAFEONE</span>
                  <span className="text-[11px] text-[#e6eaee]/80">Clic para abrir la bóveda</span>
                </div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
