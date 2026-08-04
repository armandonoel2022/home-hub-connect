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
  [22, 22],
  [DOOR_WIDTH - 22, 22],
  [22, DOOR_HEIGHT - 22],
  [DOOR_WIDTH - 22, DOOR_HEIGHT - 22],
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
          {/* marco de aluminio */}
          <linearGradient id={`panel-${side}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e4e8ec" />
            <stop offset="18%" stopColor="#c9cfd5" />
            <stop offset="55%" stopColor="#b3bac1" />
            <stop offset="100%" stopColor="#8e959d" />
          </linearGradient>
          {/* lámina metálica pintada del interior */}
          <linearGradient id={`inner-${side}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#cfd4d9" />
            <stop offset="35%" stopColor="#c2c8ce" />
            <stop offset="70%" stopColor="#b7bec5" />
            <stop offset="100%" stopColor="#aab1b9" />
          </linearGradient>
          {/* textura metálica sutil (líneas finas verticales) */}
          <pattern id={`brush-${side}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="none" />
            <path d="M0 0 L0 6" stroke="#ffffff" strokeWidth="0.5" opacity="0.14" />
            <path d="M3 0 L3 6" stroke="#000000" strokeWidth="0.5" opacity="0.05" />
          </pattern>
          {/* luz cenital dentro del panel */}
          <linearGradient id={`innerLight-${side}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.30" />
            <stop offset="28%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
          </linearGradient>
          <linearGradient id="metalGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#eef1f4" />
            <stop offset="50%" stopColor="#9ea5ac" />
            <stop offset="100%" stopColor="#d3d8dd" />
          </linearGradient>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f6f8fa" />
            <stop offset="55%" stopColor="#aeb5bc" />
            <stop offset="100%" stopColor="#767d85" />
          </linearGradient>
          <linearGradient id="hookGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#767d85" />
            <stop offset="35%" stopColor="#eef1f4" />
            <stop offset="70%" stopColor="#9aa1a8" />
            <stop offset="100%" stopColor="#6d747b" />
          </linearGradient>
          <linearGradient id="hookGoldGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b98b23" />
            <stop offset="40%" stopColor="#ffe9a3" />
            <stop offset="100%" stopColor="#a97d18" />
          </linearGradient>
          <linearGradient id="fobGloss" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.62" />
            <stop offset="30%" stopColor="#ffffff" stopOpacity="0.10" />
            <stop offset="62%" stopColor="#000000" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
          </linearGradient>
          {/* riel metálico con volumen */}
          <linearGradient id={`rail-${side}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0f3f5" />
            <stop offset="16%" stopColor="#c3c9cf" />
            <stop offset="52%" stopColor="#8d949b" />
            <stop offset="82%" stopColor="#767d84" />
            <stop offset="100%" stopColor="#a8afb6" />
          </linearGradient>
          <linearGradient id={`sheen-${side}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.26" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
          </linearGradient>
          <filter id={`innerShadow-${side}`} x="-20%" y="-20%" width="140%" height="140%">
            <feOffset dx="0" dy="3" />
            <feGaussianBlur stdDeviation="4" result="off" />
            <feComposite in="SourceGraphic" in2="off" operator="out" result="inv" />
            <feColorMatrix in="inv" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.45 0" />
          </filter>
          <filter id={`softDrop-${side}`} x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="2.2" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* marco exterior metálico con profundidad */}
        <rect x={2} y={2} width={DOOR_WIDTH - 4} height={DOOR_HEIGHT - 4} rx={18} fill={`url(#panel-${side})`} stroke="#6f767d" strokeWidth={3} />
        <rect x={2} y={2} width={DOOR_WIDTH - 4} height={DOOR_HEIGHT - 4} rx={18} fill={`url(#sheen-${side})`} />
        <rect x={11} y={11} width={DOOR_WIDTH - 22} height={DOOR_HEIGHT - 22} rx={14} fill="none" stroke="#ffffff" strokeWidth={1.2} opacity={0.35} />
        <rect x={18} y={18} width={DOOR_WIDTH - 36} height={DOOR_HEIGHT - 36} rx={12} fill="none" stroke="#798087" strokeWidth={1.6} opacity={0.75} />

        {/* interior: lámina metálica gris mate */}
        <g>
          <rect x={26} y={26} width={DOOR_WIDTH - 52} height={DOOR_HEIGHT - 52} rx={10} fill={`url(#inner-${side})`} stroke="#82898f" strokeWidth={1.6} />
          <rect x={26} y={26} width={DOOR_WIDTH - 52} height={DOOR_HEIGHT - 52} rx={10} fill={`url(#brush-${side})`} opacity={0.6} />
          <rect x={26} y={26} width={DOOR_WIDTH - 52} height={DOOR_HEIGHT - 52} rx={10} fill={`url(#innerLight-${side})`} />
          {/* sombra interior superior (luz cenital) */}
          <rect x={26} y={26} width={DOOR_WIDTH - 52} height={16} rx={8} fill="#000000" opacity={0.10} />
          <rect x={26} y={26} width={DOOR_WIDTH - 52} height={DOOR_HEIGHT - 52} rx={10} fill="none" filter={`url(#innerShadow-${side})`} />
        </g>

        {/* tornillos en las esquinas */}
        {SCREWS.map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy + 1} r={5.4} fill="#000000" opacity={0.18} />
            <circle cx={cx} cy={cy} r={5.2} fill="url(#metalGrad)" stroke="#6f767d" strokeWidth={0.9} />
            <path d={`M${cx - 2.8} ${cy - 0.4} L${cx + 2.8} ${cy + 0.4}`} stroke="#6b7278" strokeWidth={1.2} strokeLinecap="round" />
            <circle cx={cx - 1.6} cy={cy - 1.8} r={1.2} fill="#ffffff" opacity={0.55} />
          </g>
        ))}

        {/* rieles porta-ganchos metálicos */}
        {railYs.map((y) => (
          <g key={y} filter={`url(#softDrop-${side})`}>
            <rect x={34} y={y - 47} width={DOOR_WIDTH - 68} height={19} rx={5} fill={`url(#rail-${side})`} stroke="#6f767d" strokeWidth={0.7} />
            {/* brillo superior */}
            <rect x={37} y={y - 45} width={DOOR_WIDTH - 74} height={4.5} rx={2.2} fill="#ffffff" opacity={0.45} />
            {/* línea de sombra inferior */}
            <rect x={34} y={y - 31} width={DOOR_WIDTH - 68} height={3} rx={1.5} fill="#000000" opacity={0.22} />
            {/* soportes laterales del riel */}
            <rect x={30} y={y - 50} width={7} height={25} rx={2.5} fill="url(#metalGrad)" stroke="#767d84" strokeWidth={0.6} />
            <rect x={DOOR_WIDTH - 37} y={y - 50} width={7} height={25} rx={2.5} fill="url(#metalGrad)" stroke="#767d84" strokeWidth={0.6} />
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

        {/* bisagras del lado exterior */}
        {[DOOR_HEIGHT * 0.24, DOOR_HEIGHT * 0.76].map((cy) => (
          <g key={`hinge-${cy}`} transform={`translate(${side === "left" ? 8 : DOOR_WIDTH - 8}, ${cy})`}>
            <rect x={-5} y={-24} width={10} height={48} rx={4} fill="url(#metalGrad)" stroke="#6b7278" strokeWidth={0.9} />
            <circle cx={0} cy={-12} r={1.8} fill="#6b7278" />
            <circle cx={0} cy={12} r={1.8} fill="#6b7278" />
          </g>
        ))}

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
