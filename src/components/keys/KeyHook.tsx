import { memo } from "react";
import { motion } from "framer-motion";
import { emptyHookVariants, hookVariants } from "./animations";

interface KeyHookProps {
  x: number;
  y: number;
  code: string;
  highlighted?: boolean;
  /** true = no hay llave colgada (posición vacía o llave prestada) */
  empty?: boolean;
  /** Etiqueta de préstamo bajo el gancho */
  loan?: { responsable: string; hora: string } | null;
}

/** Gancho metálico + número impreso. Siempre visible, exista o no la llave. */
function KeyHookBase({ x, y, code, highlighted, empty, loan }: KeyHookProps) {
  return (
    <motion.g transform={`translate(${x}, ${y})`} variants={hookVariants} aria-hidden="true">
      {/* número impreso sobre el riel */}
      <rect x={-16} y={-32} width={32} height={14} rx={2} fill="#f7f8f9" stroke="#c8ccd1" strokeWidth={0.6} />
      <text x={0} y={-22} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="#3c4148" letterSpacing="0.5">
        {code}
      </text>

      {/* gancho metálico */}
      <motion.g variants={empty ? emptyHookVariants : undefined} animate={empty ? "visible" : undefined}>
        <path d="M0 -14 L0 -3" stroke="#6f767d" strokeWidth={3.4} strokeLinecap="round" />
        <path
          d="M0 -14 L0 -3 M -6 -3 a 6 7 0 1 0 12 0"
          fill="none"
          stroke={highlighted ? "url(#hookGoldGrad)" : "url(#hookGrad)"}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <circle cx={0} cy={-14.5} r={2} fill="#8d939a" />
        <path d="M-1 -12 L-1 -4" stroke="#ffffff" strokeWidth={0.7} opacity={0.5} />
      </motion.g>

      {/* etiqueta de préstamo */}
      {loan && (
        <g>
          <rect x={-22} y={10} width={44} height={26} rx={3} fill="#ffffff" stroke="#d3d7dc" strokeWidth={0.7} />
          <text x={0} y={19} textAnchor="middle" fontSize={6.4} fill="#8a6d1a" fontWeight={700}>
            Prestada
          </text>
          <text x={0} y={26.5} textAnchor="middle" fontSize={5.6} fill="#5c626a">
            {loan.responsable.slice(0, 16)}
          </text>
          <text x={0} y={33} textAnchor="middle" fontSize={5.2} fill="#8d939a">
            {loan.hora}
          </text>
        </g>
      )}
    </motion.g>
  );
}

export const KeyHook = memo(KeyHookBase);
export default KeyHook;
