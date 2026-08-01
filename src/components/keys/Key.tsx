import { memo, useCallback } from "react";
import { motion } from "framer-motion";
import { COLOR_TOKENS, type CabinetKeyView } from "./types";
import { hoverKey, keyVariants, tapKey } from "./animations";

interface KeyProps {
  item: CabinetKeyView;
  highlighted: boolean;
  onSelect: (view: CabinetKeyView) => void;
}

/**
 * Llave colgante: aro metálico + llavero plástico de color + llave metálica.
 * Todo SVG, sin imágenes ni emojis.
 */
function KeyBase({ item, highlighted, onSelect }: KeyProps) {
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

  const assigned = state === "assigned";
  const title = record
    ? `${slot.code} · ${record.descripcion || record.code}${assigned && record.responsable ? ` — Prestada a ${record.responsable}` : ""}`
    : `${slot.code} · Posición vacía`;

  return (
    <motion.g
      variants={keyVariants}
      transform={`translate(${slot.x}, ${slot.y})`}
      style={{ cursor: record ? "pointer" : "default", transformOrigin: "center top" }}
      whileHover={record ? hoverKey : undefined}
      whileTap={record ? tapKey : undefined}
      tabIndex={record ? 0 : -1}
      role={record ? "button" : undefined}
      aria-label={title}
      onClick={record ? handleClick : undefined}
      onKeyDown={record ? handleKeyDown : undefined}
    >
      <title>{title}</title>

      {highlighted && (
        <motion.circle
          cx={0}
          cy={24}
          r={26}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          animate={{ opacity: [0.15, 0.9, 0.15], r: [22, 30, 22] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {assigned ? (
        <g>
          <text x={0} y={12} textAnchor="middle" fontSize={7.5} fill="#7c828a" fontWeight={600}>
            Prestada
          </text>
          <text x={0} y={22} textAnchor="middle" fontSize={7} fill="#9aa0a8">
            {(record?.responsable || "—").slice(0, 16)}
          </text>
          <text x={0} y={32} textAnchor="middle" fontSize={6.5} fill="#9aa0a8">
            {record?.fechaEntrega || ""}
          </text>
        </g>
      ) : (
        <g>
          {/* aro metálico */}
          <circle cx={0} cy={4} r={7} fill="none" stroke="url(#ringGrad)" strokeWidth={2.2} />
          {/* llave metálica detrás del llavero */}
          <g transform="translate(9, 12) rotate(12)">
            <rect x={-1.6} y={0} width={3.2} height={26} rx={1.4} fill="url(#metalGrad)" />
            <rect x={1.6} y={17} width={4} height={2.4} fill="#a8aeb5" />
            <rect x={1.6} y={22} width={5} height={2.4} fill="#a8aeb5" />
          </g>
          {/* llavero plástico */}
          <g transform="translate(0, 11)">
            <rect
              x={-9}
              y={0}
              width={18}
              height={30}
              rx={5}
              fill={tokens.body}
              stroke={tokens.edge}
              strokeWidth={1}
              opacity={color === "transparent" && state === "available" ? 0.8 : 1}
            />
            <rect x={-6} y={3} width={12} height={11} rx={2} fill="#ffffff" opacity={0.85} />
            <text x={0} y={11.5} textAnchor="middle" fontSize={7} fill="#2b2f34" fontFamily="ui-monospace, monospace">
              {slot.code}
            </text>
            <text
              x={0}
              y={24}
              textAnchor="middle"
              fontSize={5.4}
              fill={tokens.text}
              opacity={0.9}
            >
              {label.slice(0, 9)}
            </text>
          </g>
        </g>
      )}
    </motion.g>
  );
}

export const KeyItem = memo(KeyBase);
export default KeyItem;
