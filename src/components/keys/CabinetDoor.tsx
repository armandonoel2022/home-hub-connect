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

const SCREWS: Array<[number, number]> = [
  [24, 24],
  [DOOR_WIDTH - 24, 24],
  [24, DOOR_HEIGHT - 24],
  [DOOR_WIDTH - 24, DOOR_HEIGHT - 24],
];

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
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto drop-shadow-2xl"
        role="group"
        aria-label={`Puerta ${side === "left" ? "izquierda" : "derecha"} del gabinete de llaves`}
      >
        <defs>
          <linearGradient id={`panel-${side}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d3d8dd" />
            <stop offset="45%" stopColor="#bfc5cb" />
            <stop offset="100%" stopColor="#9aa2aa" />
          </linearGradient>
          <linearGradient id="metalGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e2e6ea" />
            <stop offset="50%" stopColor="#9ea5ac" />
            <stop offset="100%" stopColor="#cbd1d7" />
          </linearGradient>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eef1f4" />
            <stop offset="100%" stopColor="#818890" />
          </linearGradient>
          <linearGradient id="hookGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d6dade" />
            <stop offset="100%" stopColor="#828990" />
          </linearGradient>
          <linearGradient id="hookGoldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5d67a" />
            <stop offset="100%" stopColor="#b98b23" />
          </linearGradient>
          <linearGradient id="fobGloss" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id={`rail-${side}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b3bac1" />
            <stop offset="50%" stopColor="#7f868d" />
            <stop offset="100%" stopColor="#aab1b8" />
          </linearGradient>
          <linearGradient id={`sheen-${side}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.10" />
          </linearGradient>
        </defs>

        {/* marco exterior metálico */}
        <rect x={2} y={2} width={DOOR_WIDTH - 4} height={DOOR_HEIGHT - 4} rx={16} fill={`url(#panel-${side})`} stroke="#767d84" strokeWidth={3} />
        <rect x={2} y={2} width={DOOR_WIDTH - 4} height={DOOR_HEIGHT - 4} rx={16} fill={`url(#sheen-${side})`} />

        {/* interior hundido, fondo blanco */}
        <rect x={26} y={26} width={DOOR_WIDTH - 52} height={DOOR_HEIGHT - 52} rx={10} fill="#f6f7f8" stroke="#8b9299" strokeWidth={1.6} />
        <rect x={26} y={26} width={DOOR_WIDTH - 52} height={12} fill="#000000" opacity={0.06} />

        {/* tornillos en las esquinas */}
        {SCREWS.map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r={5} fill="url(#metalGrad)" stroke="#6f767d" strokeWidth={0.8} />
            <path d={`M${cx - 2.6} ${cy} L${cx + 2.6} ${cy}`} stroke="#6f767d" strokeWidth={1.1} />
          </g>
        ))}

        {/* rieles porta-ganchos */}
        {railYs.map((y) => (
          <g key={y}>
            <rect x={34} y={y - 46} width={DOOR_WIDTH - 68} height={17} rx={4} fill={`url(#rail-${side})`} />
            <rect x={34} y={y - 46} width={DOOR_WIDTH - 68} height={4} rx={2} fill="#ffffff" opacity={0.3} />
            <rect x={34} y={y - 30} width={DOOR_WIDTH - 68} height={3} fill="#000000" opacity={0.12} />
          </g>
        ))}

        {/* cerradura */}
        {showLock && (
          <g transform={`translate(${DOOR_WIDTH - 14}, ${DOOR_HEIGHT / 2})`}>
            <circle r={13} fill="url(#metalGrad)" stroke="#6f767d" strokeWidth={2} />
            <circle r={5} fill="#5d646b" />
            <rect x={-1.2} y={-3.4} width={2.4} height={8} rx={1} fill="#cdd2d7" />
          </g>
        )}

        {/* ganchos siempre visibles (aunque no exista la llave) */}
        {items.map((it) => (
          <KeyHook
            key={`hook-${it.slot.code}`}
            x={it.slot.x}
            y={it.slot.y}
            code={it.slot.code}
            highlighted={highlightedCode === it.slot.code}
            empty={!it.record || it.out}
            loan={
              it.record && it.out
                ? { responsable: it.record.responsable || "—", hora: it.record.fechaEntrega || "" }
                : null
            }
          />
        ))}

        {/* llaves colgadas */}
        <motion.g variants={boardVariants} initial="hidden" animate={open ? "visible" : "hidden"}>
          {open &&
            items
              .filter((it) => it.record && !it.out)
              .map((it, i) => (
                <KeyItem
                  key={`key-${it.slot.code}`}
                  item={it}
                  index={i}
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
