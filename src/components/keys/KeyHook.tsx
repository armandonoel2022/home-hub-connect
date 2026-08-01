import { memo } from "react";

interface KeyHookProps {
  x: number;
  y: number;
  code: string;
  highlighted?: boolean;
}

/** Gancho metálico + etiqueta numérica. Siempre visible, exista o no la llave. */
function KeyHookBase({ x, y, code, highlighted }: KeyHookProps) {
  return (
    <g transform={`translate(${x}, ${y})`} aria-hidden="true">
      {/* etiqueta numérica sobre el riel */}
      <rect x={-16} y={-30} width={32} height={14} rx={2} fill="#f4f5f6" stroke="#c8ccd1" strokeWidth={0.6} />
      <text
        x={0}
        y={-20}
        textAnchor="middle"
        fontSize={9}
        fontFamily="ui-monospace, monospace"
        fill="#3c4148"
        letterSpacing="0.5"
      >
        {code}
      </text>
      {/* gancho */}
      <path
        d="M0 -12 L0 -2 M -6 -2 a 6 7 0 1 0 12 0"
        fill="none"
        stroke={highlighted ? "url(#hookGoldGrad)" : "url(#hookGrad)"}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <circle cx={0} cy={-13} r={1.8} fill="#8d939a" />
    </g>
  );
}

export const KeyHook = memo(KeyHookBase);
export default KeyHook;
