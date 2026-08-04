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

/** Gancho metálico + etiqueta adhesiva numerada. Siempre visible, exista o no la llave. */
function KeyHookBase({ x, y, code, highlighted, empty, loan }: KeyHookProps) {
  return (
    <motion.g transform={`translate(${x}, ${y})`} variants={hookVariants} aria-hidden="true">
      {/* etiqueta adhesiva con el número de posición */}
      <g>
        <rect x={-17} y={-33.5} width={34} height={16} rx={2.5} fill="#0f172a" opacity={0.16} />
        <rect x={-17.5} y={-35} width={35} height={16} rx={2.5} fill="#f6f4ee" stroke="#b9bec4" strokeWidth={0.7} />
        <rect x={-17.5} y={-35} width={35} height={5} rx={2.5} fill="#ffffff" opacity={0.7} />
        <text
          x={0}
          y={-23.5}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#242a31"
          letterSpacing="0.8"
        >
          {code}
        </text>
      </g>

      {/* gancho metálico soldado al panel */}
      <motion.g variants={empty ? emptyHookVariants : undefined} animate={empty ? "visible" : undefined}>
        {/* base soldada */}
        <ellipse cx={0} cy={-14} rx={4.6} ry={2.6} fill="#7f868d" />
        <ellipse cx={0} cy={-14.8} rx={3.4} ry={1.8} fill="#cfd5da" opacity={0.8} />
        {/* sombra del gancho sobre la lámina */}
        <path
          d="M1.6 -13 L1.6 -2 M -4.4 -2 a 6 7 0 1 0 12 0"
          fill="none"
          stroke="#0f172a"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.16}
        />
        {/* cuerpo del gancho */}
        <path
          d="M0 -14 L0 -3 M -6 -3 a 6 7 0 1 0 12 0"
          fill="none"
          stroke={highlighted ? "url(#hookGoldGrad)" : "url(#hookGrad)"}
          strokeWidth={3.4}
          strokeLinecap="round"
        />
        {/* brillo especular */}
        <path
          d="M-1.1 -12.5 L-1.1 -4 M -4.6 -3.4 a 4.6 5.4 0 0 0 1.4 6.6"
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.9}
          strokeLinecap="round"
          opacity={0.65}
        />
      </motion.g>

      {/* etiqueta de préstamo */}
      {loan && (
        <g>
          <rect x={-22} y={11} width={44} height={26} rx={3} fill="#0f172a" opacity={0.14} />
          <rect x={-22} y={10} width={44} height={26} rx={3} fill="#f7f3e6" stroke="#c9c2ad" strokeWidth={0.8} />
          <text x={0} y={19} textAnchor="middle" fontSize={6.6} fill="#7a5f12" fontWeight={800}>
            Prestada
          </text>
          <text x={0} y={26.5} textAnchor="middle" fontSize={5.8} fill="#42474e" fontWeight={600}>
            {loan.responsable.slice(0, 16)}
          </text>
          <text x={0} y={33} textAnchor="middle" fontSize={5.2} fill="#6d747b">
            {loan.hora}
          </text>
        </g>
      )}
    </motion.g>
  );
}

export const KeyHook = memo(KeyHookBase);
export default KeyHook;
