import { memo, useCallback } from "react";
import { motion } from "framer-motion";
import { COLOR_TOKENS, type CabinetKeyView } from "./types";
import { hoverKey, keyVariants, swingVariants, tapKey } from "./animations";

interface KeyProps {
  item: CabinetKeyView;
  highlighted: boolean;
  index: number;
  onSelect: (view: CabinetKeyView) => void;
}

/**
 * Llave física colgando del gancho: aro metálico + llavero plástico de color +
 * cuerpo metálico con brillo y sombra. 100% SVG (sin iconos ni emojis).
 * Solo el llavero plástico cambia de color.
 */
function KeyBase({ item, highlighted, index, onSelect }: KeyProps) {
  const { slot, record, state, color, label } = item;
  const tokens = COLOR_TOKENS[state === "maintenance" ? "gray" : state === "lost" ? "red" : color];

  const handleClick = useCallback(() => onSelect(item), [item, onSelect]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGGElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(item);
      }
    },
    [item, onSelect],
  );

  const title = `${slot.code} · ${record?.descripcion || record?.code || ""}`;

  return (
    <g transform={`translate(${slot.x}, ${slot.y})`}>
    <motion.g variants={keyVariants} style={{ transformOrigin: "center top" }}>
      {highlighted && (
        <motion.circle
          cx={0}
          cy={26}
          r={26}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          animate={{ opacity: [0.15, 0.9, 0.15], r: [22, 30, 22] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <motion.g
        variants={swingVariants}
        animate="idle"
        custom={(index % 7) * 0.28}
        style={{ cursor: "pointer", transformOrigin: "0px -6px" }}
        whileHover={hoverKey}
        whileTap={tapKey}
        tabIndex={0}
        role="button"
        aria-label={title}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <title>{title}</title>

        {/* sombra proyectada en el tablero */}
        <ellipse cx={4} cy={44} rx={11} ry={3.2} fill="#0f172a" opacity={0.16} />

        {/* aro metálico enganchado */}
        <circle cx={0} cy={2} r={7.5} fill="none" stroke="url(#ringGrad)" strokeWidth={2.4} />
        <circle cx={-2.4} cy={-1.4} r={2.4} fill="#ffffff" opacity={0.55} />

        {/* llave metálica (detrás del llavero) */}
        <g transform="translate(10.5, 9) rotate(11)">
          <rect x={-1.8} y={0} width={3.6} height={28} rx={1.6} fill="url(#metalGrad)" stroke="#7f868d" strokeWidth={0.4} />
          <circle cx={0} cy={1.5} r={3.4} fill="none" stroke="url(#metalGrad)" strokeWidth={1.6} />
          <rect x={1.8} y={17} width={4.4} height={2.6} rx={0.6} fill="#9aa1a8" />
          <rect x={1.8} y={22} width={5.6} height={2.6} rx={0.6} fill="#9aa1a8" />
          <rect x={-0.8} y={4} width={0.9} height={20} fill="#ffffff" opacity={0.5} />
        </g>

        {/* llavero plástico de color */}
        <g transform="translate(0, 9)">
          <rect x={-9.5} y={0} width={19} height={31} rx={5.5} fill={tokens.body} stroke={tokens.edge} strokeWidth={1} />
          <rect
            x={-9.5}
            y={0}
            width={19}
            height={31}
            rx={5.5}
            fill="url(#fobGloss)"
            opacity={color === "transparent" ? 0.5 : 0.35}
          />
          <rect x={-6} y={3} width={12} height={11} rx={2} fill="#ffffff" opacity={0.9} />
          <text x={0} y={11.5} textAnchor="middle" fontSize={7} fill="#2b2f34" fontFamily="ui-monospace, monospace">
            {slot.code}
          </text>
          <text x={0} y={24.5} textAnchor="middle" fontSize={5.4} fill={tokens.text} opacity={0.92}>
            {label.slice(0, 9)}
          </text>
          {/* brillo superior */}
          <rect x={-7} y={1.4} width={5} height={8} rx={2.5} fill="#ffffff" opacity={0.28} />
        </g>
      </motion.g>
    </motion.g>
  );
}

export const KeyItem = memo(KeyBase);
export default KeyItem;
