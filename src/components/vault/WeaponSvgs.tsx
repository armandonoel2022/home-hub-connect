// Representaciones vectoriales simples (no fotorrealistas) de las armas
// resguardadas: escopeta (vertical) y pistola / revólver (horizontal).

import type { WeaponKind } from "@/lib/vaultWeapons";

interface Props { className?: string; dim?: boolean }

export function ShotgunSvg({ className, dim }: Props) {
  return (
    <svg viewBox="0 0 40 200" className={className} aria-hidden="true" style={{ opacity: dim ? 0.35 : 1 }}>
      <defs>
        <linearGradient id="wgun-steel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4b5058" />
          <stop offset="45%" stopColor="#9aa3ad" />
          <stop offset="100%" stopColor="#3a3f46" />
        </linearGradient>
        <linearGradient id="wgun-wood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5a3418" />
          <stop offset="50%" stopColor="#8b5a2b" />
          <stop offset="100%" stopColor="#4a2b13" />
        </linearGradient>
      </defs>
      {/* cañón */}
      <rect x="15" y="8" width="9" height="96" rx="4" fill="url(#wgun-steel)" />
      {/* guardamanos */}
      <rect x="13" y="72" width="13" height="26" rx="5" fill="url(#wgun-wood)" />
      {/* cajón de mecanismos */}
      <rect x="12" y="104" width="15" height="30" rx="3" fill="url(#wgun-steel)" />
      {/* gatillo */}
      <path d="M19 134 q3 6 0 11" stroke="#2b2f35" strokeWidth="2" fill="none" />
      {/* culata */}
      <path d="M13 134 L26 134 L29 186 L16 192 Z" fill="url(#wgun-wood)" />
      <rect x="15" y="4" width="9" height="5" rx="2" fill="#2b2f35" />
    </svg>
  );
}

export function PistolSvg({ className, dim }: Props) {
  return (
    <svg viewBox="0 0 140 90" className={className} aria-hidden="true" style={{ opacity: dim ? 0.35 : 1 }}>
      <defs>
        <linearGradient id="wpis-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b8c0c9" />
          <stop offset="55%" stopColor="#5e666f" />
          <stop offset="100%" stopColor="#33383e" />
        </linearGradient>
      </defs>
      {/* corredera */}
      <rect x="8" y="14" width="118" height="20" rx="5" fill="url(#wpis-steel)" />
      <rect x="20" y="19" width="70" height="3" rx="1.5" fill="#2b2f35" opacity=".55" />
      {/* armazón */}
      <rect x="12" y="34" width="72" height="12" rx="3" fill="#454b52" />
      {/* guardamonte + empuñadura */}
      <path d="M30 46 q14 2 16 16 q-2 12 -12 24 l-22 4 l6 -44 Z" fill="#3b4046" />
      <path d="M34 48 q10 3 11 14 q-1 8 -8 14" fill="none" stroke="#22262b" strokeWidth="2" />
      <path d="M22 52 q0 8 -3 30 l16 -4 q8 -18 8 -26 Z" fill="#2f343a" />
      <circle cx="118" cy="24" r="2.4" fill="#22262b" />
    </svg>
  );
}

export function RevolverSvg({ className, dim }: Props) {
  return (
    <svg viewBox="0 0 140 90" className={className} aria-hidden="true" style={{ opacity: dim ? 0.35 : 1 }}>
      <defs>
        <linearGradient id="wrev-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c2cad3" />
          <stop offset="55%" stopColor="#646c75" />
          <stop offset="100%" stopColor="#343a40" />
        </linearGradient>
      </defs>
      {/* cañón */}
      <rect x="58" y="18" width="68" height="14" rx="4" fill="url(#wrev-steel)" />
      <rect x="58" y="14" width="60" height="5" rx="2" fill="#4d545c" />
      {/* tambor */}
      <circle cx="48" cy="28" r="16" fill="url(#wrev-steel)" />
      <circle cx="48" cy="28" r="6" fill="#22262b" />
      <circle cx="48" cy="18" r="2.4" fill="#22262b" />
      <circle cx="57" cy="31" r="2.4" fill="#22262b" />
      <circle cx="39" cy="31" r="2.4" fill="#22262b" />
      {/* armazón y empuñadura */}
      <path d="M30 22 q-6 6 -4 18 q10 2 14 14 q-2 12 -10 26 l-18 4 q6 -34 8 -50 Z" fill="#3b4046" />
      <path d="M20 46 q-4 20 -8 36 l16 -4 q6 -18 8 -30 Z" fill="#5a3418" />
      <path d="M36 46 q9 4 9 14 q-1 8 -7 13" fill="none" stroke="#22262b" strokeWidth="2" />
    </svg>
  );
}

export function WeaponGlyph({ kind, className, dim }: Props & { kind: WeaponKind }) {
  if (kind === "escopeta") return <ShotgunSvg className={className} dim={dim} />;
  if (kind === "revolver") return <RevolverSvg className={className} dim={dim} />;
  return <PistolSvg className={className} dim={dim} />;
}
