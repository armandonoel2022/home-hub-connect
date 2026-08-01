import { memo } from "react";
import { motion } from "framer-motion";
import { boardVariants, doorVariants } from "./animations";
import { DOOR_HEIGHT, DOOR_WIDTH } from "./cabinetLayout";
import KeyHook from "./KeyHook";
import KeyItem from "./Key";
import type { CabinetKeyView } from "./types";

interface CabinetDoorProps {
  side: "left" | "right";
  open: boolean;
  items: CabinetKeyView[];
  railYs: number[];
  highlightedCode: string | null;
  onSelect: (view: CabinetKeyView) => void;
  showLock?: boolean;
}

function CabinetDoorBase({ side, open, items, railYs, highlightedCode, onSelect, showLock }: CabinetDoorProps) {
  const dir = side === "left" ? 1 : -1;

  return (
    <motion.div
      className="relative"
      style={{
        transformOrigin: side === "left" ? "left center" : "right center",
        transformStyle: "preserve-3d",
        flex: "1 1 0",
      }}
      custom={dir}
      variants={doorVariants}
      animate={open ? "open" : "closed"}
    >
      <svg
        viewBox={`0 0 ${DOOR_WIDTH} ${DOOR_HEIGHT}`}
        className="w-full h-auto drop-shadow-2xl"
        role="group"
        aria-label={`Puerta ${side === "left" ? "izquierda" : "derecha"} del gabinete de llaves`}
      >
        <defs>
          <linearGradient id={`panel-${side}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c9ced4" />
            <stop offset="45%" stopColor="#b3b9c0" />
            <stop offset="100%" stopColor="#98a0a8" />
          </linearGradient>
          <linearGradient id="metalGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#d7dbe0" />
            <stop offset="50%" stopColor="#9ea5ac" />
            <stop offset="100%" stopColor="#c6ccd2" />
          </linearGradient>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e6eaee" />
            <stop offset="100%" stopColor="#8b9299" />
          </linearGradient>
          <linearGradient id="hookGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cfd4d9" />
            <stop offset="100%" stopColor="#878e95" />
          </linearGradient>
          <linearGradient id="hookGoldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5d67a" />
            <stop offset="100%" stopColor="#b98b23" />
          </linearGradient>
          <linearGradient id={`rail-${side}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#aab1b8" />
            <stop offset="50%" stopColor="#7f868d" />
            <stop offset="100%" stopColor="#a4abb2" />
          </linearGradient>
        </defs>

        {/* marco exterior */}
        <rect x={2} y={2} width={DOOR_WIDTH - 4} height={DOOR_HEIGHT - 4} rx={18} fill={`url(#panel-${side})`} stroke="#7d848b" strokeWidth={3} />
        {/* interior hundido */}
        <rect x={22} y={22} width={DOOR_WIDTH - 44} height={DOOR_HEIGHT - 44} rx={12} fill="#aeb5bc" stroke="#8b9299" strokeWidth={1.5} />
        <rect x={22} y={22} width={DOOR_WIDTH - 44} height={26} rx={12} fill="#ffffff" opacity={0.12} />

        {/* rieles */}
        {railYs.map((y) => (
          <g key={y}>
            <rect x={30} y={y - 44} width={DOOR_WIDTH - 60} height={16} rx={5} fill={`url(#rail-${side})`} />
            <rect x={30} y={y - 44} width={DOOR_WIDTH - 60} height={4} rx={2} fill="#ffffff" opacity={0.25} />
          </g>
        ))}

        {/* cerradura (solo puerta con cierre) */}
        {showLock && (
          <g transform={`translate(${DOOR_WIDTH - 58}, ${DOOR_HEIGHT / 2})`}>
            <circle r={16} fill="url(#metalGrad)" stroke="#767d84" strokeWidth={2} />
            <circle r={6} fill="#5d646b" />
            <rect x={-1.4} y={-4} width={2.8} height={9} rx={1} fill="#cdd2d7" />
          </g>
        )}

        {/* ganchos siempre visibles */}
        {items.map((it) => (
          <KeyHook key={`hook-${it.slot.code}`} x={it.slot.x} y={it.slot.y} code={it.slot.code} highlighted={highlightedCode === it.slot.code} />
        ))}

        {/* llaves */}
        <motion.g variants={boardVariants} initial="hidden" animate={open ? "visible" : "hidden"}>
          {open &&
            items
              .filter((it) => it.record !== null)
              .map((it) => (
                <KeyItem
                  key={`key-${it.slot.code}`}
                  item={it}
                  highlighted={highlightedCode === it.slot.code}
                  onSelect={onSelect}
                />
              ))}
        </motion.g>
      </svg>
    </motion.div>
  );
}

export const CabinetDoor = memo(CabinetDoorBase);
export default CabinetDoor;
