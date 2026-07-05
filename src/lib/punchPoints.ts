/**
 * Registro de clientes de Active Track (bastones) y sus PUNTOS/PUESTOS de punche.
 *
 * Cada cliente factura uno o más puntos donde los vigilantes deben punchar con el
 * bastón Active Track. Los reportes de Kronos NET agrupan por cuenta y cada punch
 * trae una descripción de punto; aquí mapeamos ese texto libre al punto oficial de
 * cada cliente para poder:
 *   - filtrar los punches por punto,
 *   - comparar CADA punto consigo mismo en diferentes fechas (serie temporal),
 *     evitando el problema de comparar puntos distintos entre sí.
 *
 * Los datos de cliente provienen de la tabla `Cliente` de la base gSafeOne.
 */
import type { PunchParsedReport, PunchRow } from "./punchHtmParser";

export interface PunchClientDef {
  key: string;
  oid: number;
  clientCode: string; // Codigo en gSafeOne
  name: string;
  rnc?: string;
  contact?: string;
  phone?: string;
  points: string[];
}

export const PUNCH_CLIENTS: PunchClientDef[] = [
  {
    key: "seguinsa",
    oid: 24391,
    clientCode: "11897",
    name: "SERVICIOS DE GUARDIANES INDUSTRIALES, SRL",
    rnc: "130-41005-4",
    contact: "CLAUDIO ALMONTE",
    phone: "(829) 630-8831 / (829) 728-6082",
    points: ["NAVE A3", "NAVE A18", "NAVE B6"],
  },
  {
    key: "jade",
    oid: 24292,
    clientCode: "11798",
    name: "JADE TERIYAKI S A",
    rnc: "130-38958-6",
    contact: "Perla García / Miguel Angel",
    phone: "809-508-1575",
    points: ["Jade Administracion", "Jade Nine Mall"],
  },
  {
    key: "pages",
    oid: 8080,
    clientCode: "11587",
    name: "PAGES SOLIS INMOBILIARIA, SRL",
    rnc: "122-01206-2",
    contact: "FEDERICO PAGES",
    phone: "809-854-6660 / 809-701-6040",
    points: ["page solis 6 de noviembre", "page solis cuaba"],
  },
  {
    key: "citystorage",
    oid: 14109,
    clientCode: "11624",
    name: "CITY STORAGE SOLUTION SRL",
    rnc: "130-89204-2",
    contact: "Ivan Portalatín",
    phone: "809-564-4284",
    points: ["city storage"],
  },
];

export interface PunchPointRef {
  clientKey: string;
  clientName: string;
  point: string;
  id: string; // `${clientKey}::${point}` — clave estable
}

/** Todos los puntos registrados, aplanados. */
export const ALL_PUNCH_POINTS: PunchPointRef[] = PUNCH_CLIENTS.flatMap(c =>
  c.points.map(p => ({
    clientKey: c.key,
    clientName: c.name,
    point: p,
    id: `${c.key}::${p}`,
  })),
);

/** Normaliza texto para comparación tolerante (sin acentos, minúsculas, sin puntuación). */
function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Índice pre-normalizado de puntos, ordenado del nombre más largo al más corto
// para que "nave a18" gane sobre coincidencias más cortas.
const POINT_INDEX = ALL_PUNCH_POINTS
  .map(ref => ({ ref, n: norm(ref.point) }))
  .sort((a, b) => b.n.length - a.n.length);

/**
 * Dado un texto (descripción de punto o nombre de cuenta), devuelve el punto
 * oficial que coincide, o null. Coincide si el nombre normalizado del punto está
 * contenido en el texto (o viceversa para nombres muy cortos).
 */
export function matchPunchPoint(...texts: (string | null | undefined)[]): PunchPointRef | null {
  const targets = texts.map(norm).filter(Boolean);
  if (targets.length === 0) return null;
  for (const { ref, n } of POINT_INDEX) {
    for (const t of targets) {
      if (t.includes(n) || n.includes(t)) return ref;
    }
  }
  return null;
}

/** Asigna cada punch de un reporte a un punto oficial (usa pointDescription y luego accountName). */
export function assignPunchToPoint(
  punch: PunchRow,
  accountName: string,
): PunchPointRef | null {
  return matchPunchPoint(punch.pointDescription, accountName, punch.accountName);
}

export interface PointDaySummary {
  reportId: string;
  reportDate: string; // YYYY-MM-DD
  count: number;
  firstPunch: string | null;
  lastPunch: string | null;
  uniqueHardware: number;
  avgIntervalMin: number | null;
  punches: PunchRow[];
}

function intervalsMin(punches: PunchRow[]): number[] {
  const times = punches
    .map(p => (p.receivedAt ? new Date(p.receivedAt).getTime() : NaN))
    .filter(t => !isNaN(t))
    .sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 1; i < times.length; i++) out.push((times[i] - times[i - 1]) / 60_000);
  return out;
}

/** Extrae los punches de un reporte que pertenecen a un punto específico. */
export function extractPointPunches(report: PunchParsedReport, pointId: string): PunchRow[] {
  const out: PunchRow[] = [];
  report.clients.forEach(c => {
    c.punches.forEach(p => {
      const ref = assignPunchToPoint(p, c.accountName);
      if (ref && ref.id === pointId) out.push(p);
    });
  });
  out.sort((a, b) => (a.receivedAt || "").localeCompare(b.receivedAt || ""));
  return out;
}

/** Construye la serie temporal (una fila por reporte/fecha) de un punto. */
export function buildPointSeries(
  reports: { id: string; reportDate: string; report: PunchParsedReport }[],
  pointId: string,
): PointDaySummary[] {
  return reports
    .map(({ id, reportDate, report }) => {
      const punches = extractPointPunches(report, pointId);
      const iv = intervalsMin(punches);
      const uniqueHardware = new Set(punches.map(p => p.hardware).filter(Boolean)).size;
      return {
        reportId: id,
        reportDate: (reportDate || "").slice(0, 10),
        count: punches.length,
        firstPunch: punches[0]?.receivedAt || null,
        lastPunch: punches[punches.length - 1]?.receivedAt || null,
        uniqueHardware,
        avgIntervalMin: iv.length ? Math.round(iv.reduce((a, b) => a + b, 0) / iv.length) : null,
        punches,
      };
    })
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate));
}
