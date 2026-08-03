import { memo } from "react";
import { motion } from "framer-motion";
import { DOOR_HEIGHT, DOOR_WIDTH } from "./cabinetLayout";
import { springSoft } from "./animations";

interface CabinetClosedProps {
  /** Total de llaves resguardadas (se muestra en la placa). */
  total: number;
  onOpen: () => void;
}

const W = DOOR_WIDTH * 2;
const H = DOOR_HEIGHT;

/**
 * Gabinete cerrado: réplica del frente metálico real (panel de aluminio,
 * cantos redondeados, bisagras ocultas y cerradura cromada al centro).
 */
function CabinetClosedBase({ total, onOpen }: CabinetClosedProps) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      className="mx-auto block w-full max-w-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1, transition: springSoft }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.995 }}
      aria-label="Abrir gabinete de llaves"
      title="Click para abrir el gabinete"
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto drop-shadow-2xl" role="img" aria-label="Gabinete de llaves cerrado">
        <defs>
          <linearGradient id="closedBody" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9ba2a9" />
            <stop offset="12%" stopColor="#dfe3e7" />
            <stop offset="45%" stopColor="#c6ccd2" />
            <stop offset="72%" stopColor="#e6eaee" />
            <stop offset="100%" stopColor="#8e959c" />
          </linearGradient>
          <linearGradient id="closedEdge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eceff2" />
            <stop offset="50%" stopColor="#aeb5bc" />
            <stop offset="100%" stopColor="#7d848b" />
          </linearGradient>
          <linearGradient id="closedSheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="38%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
          </linearGradient>
          <linearGradient id="closedChrome" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f4f6f8" />
            <stop offset="45%" stopColor="#a7aeb5" />
            <stop offset="100%" stopColor="#6f767d" />
          </linearGradient>
        </defs>

        {/* sombra proyectada */}
        <ellipse cx={W / 2} cy={H - 6} rx={W / 2.4} ry={14} fill="#000" opacity={0.16} />

        {/* canto de aluminio */}
        <rect x={6} y={6} width={W - 12} height={H - 20} rx={20} fill="url(#closedEdge)" />

        {/* panel ABS frontal */}
        <rect x={16} y={16} width={W - 32} height={H - 40} rx={14} fill="url(#closedBody)" stroke="#7b8288" strokeWidth={2} />
        <rect x={16} y={16} width={W - 32} height={H - 40} rx={14} fill="url(#closedSheen)" />

        {/* junta central (unión de las dos hojas) */}
        <rect x={W / 2 - 1.5} y={20} width={3} height={H - 48} fill="#8d949b" opacity={0.55} />
        <rect x={W / 2 + 1.5} y={20} width={1.5} height={H - 48} fill="#ffffff" opacity={0.35} />

        {/* bisagras laterales */}
        {[H * 0.22, H * 0.5, H * 0.78].map((cy) => (
          <g key={cy}>
            <rect x={10} y={cy - 26} width={9} height={52} rx={4} fill="url(#closedChrome)" stroke="#6f767d" strokeWidth={0.8} />
            <rect x={W - 19} y={cy - 26} width={9} height={52} rx={4} fill="url(#closedChrome)" stroke="#6f767d" strokeWidth={0.8} />
          </g>
        ))}

        {/* cerradura cromada al centro-derecha */}
        <g transform={`translate(${W / 2 - 46}, ${H / 2})`}>
          <circle r={26} fill="url(#closedChrome)" stroke="#6b7278" strokeWidth={2.5} />
          <circle r={17} fill="#b9c0c6" stroke="#8b9298" strokeWidth={1.2} />
          <circle r={8} fill="#5c6369" />
          <rect x={-1.8} y={-5} width={3.6} height={13} rx={1.6} fill="#dfe3e7" />
        </g>

        {/* placa identificadora */}
        <g transform={`translate(${W / 2}, ${H * 0.2})`}>
          <rect x={-150} y={-30} width={300} height={60} rx={8} fill="#f4f6f8" stroke="#9aa1a8" strokeWidth={1.5} opacity={0.95} />
          <text textAnchor="middle" y={-4} fontSize={22} fontWeight={800} fill="#4a5158" letterSpacing="2">
            CONTROL DE LLAVES
          </text>
          <text textAnchor="middle" y={19} fontSize={15} fill="#7b8288" letterSpacing="1">
            SAFEONE · {total} llaves resguardadas
          </text>
        </g>

        {/* tornillos de esquina */}
        {[
          [34, 34],
          [W - 34, 34],
          [34, H - 54],
          [W - 34, H - 54],
        ].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r={6} fill="url(#closedChrome)" stroke="#6f767d" strokeWidth={0.9} />
            <path d={`M${cx - 3} ${cy} L${cx + 3} ${cy}`} stroke="#6f767d" strokeWidth={1.2} />
          </g>
        ))}

        <text textAnchor="middle" x={W / 2} y={H * 0.78} fontSize={16} fill="#6f767d" letterSpacing="1">
          Click para abrir
        </text>
      </svg>
    </motion.button>
  );
}

export const CabinetClosed = memo(CabinetClosedBase);
export default CabinetClosed;
