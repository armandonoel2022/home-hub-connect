/**
 * Comparación de dos reportes Kronos (día a día).
 *
 * Dado el reporte anterior y el actual, calcula por cuenta si la situación
 * empeoró, mejoró, si es una cuenta nueva o si dejó de aparecer, además de
 * cambios en el estado de energía eléctrica. Se usa en Actividad Kronos para
 * resaltar los cambios que surgen de un día para otro.
 */
import type { KronosParsedReport, KronosAccountRow, CriticidadInactividad } from "./kronosHtmParser";

export type CritLevel = CriticidadInactividad | "ok";

/** Ranking de criticidad para comparar (mayor = peor). */
const CRIT_RANK: Record<CritLevel, number> = { ok: 0, baja: 1, media: 2, alta: 3 };

export type ChangeDirection = "worse" | "better" | "same" | "new" | "disappeared";

export interface AccountChange {
  accountCode: string;
  accountName: string;
  prevCrit: CritLevel | null;
  currCrit: CritLevel | null;
  direction: ChangeDirection;
  prevSignal: string | null;
  currSignal: string | null;
  prevPowerOk: boolean | null;
  currPowerOk: boolean | null;
  powerChanged: boolean;   // cambió el estado de energía (perdió/recuperó CA)
  lostPower: boolean;      // pasó a estar sin energía
  restoredPower: boolean;  // recuperó energía
  newLowBattery: boolean;  // batería baja apareció (no estaba antes)
}

export interface KronosDiff {
  byCode: Map<string, AccountChange>;
  worse: AccountChange[];
  better: AccountChange[];
  added: AccountChange[];
  disappeared: AccountChange[];
  powerChanges: AccountChange[];
  hasPrev: boolean;
}

function critOf(r?: KronosAccountRow): CritLevel {
  return (r?.criticidad ?? "alta") as CritLevel;
}

export function diffKronosReports(
  prev: KronosParsedReport | null | undefined,
  curr: KronosParsedReport | null | undefined,
): KronosDiff {
  const byCode = new Map<string, AccountChange>();
  const empty: KronosDiff = {
    byCode, worse: [], better: [], added: [], disappeared: [], powerChanges: [], hasPrev: false,
  };
  if (!curr) return empty;

  const prevMap = new Map<string, KronosAccountRow>();
  (prev?.rows || []).forEach(r => prevMap.set(r.accountCode.trim(), r));
  const currMap = new Map<string, KronosAccountRow>();
  curr.rows.forEach(r => currMap.set(r.accountCode.trim(), r));

  const hasPrev = !!prev && prevMap.size > 0;

  // Cuentas presentes hoy
  curr.rows.forEach(c => {
    const code = c.accountCode.trim();
    const p = prevMap.get(code);
    const currCrit = critOf(c);
    const prevCrit = p ? critOf(p) : null;

    let direction: ChangeDirection;
    if (!p) direction = hasPrev ? "new" : "same";
    else if (CRIT_RANK[currCrit] > CRIT_RANK[prevCrit!]) direction = "worse";
    else if (CRIT_RANK[currCrit] < CRIT_RANK[prevCrit!]) direction = "better";
    else direction = "same";

    const prevPowerOk = p?.powerOk ?? null;
    const currPowerOk = c.powerOk ?? null;
    const powerChanged = prevPowerOk !== currPowerOk && (prevPowerOk !== null || currPowerOk !== null);
    const lostPower = currPowerOk === false && prevPowerOk !== false;
    const restoredPower = currPowerOk === true && prevPowerOk === false;
    const newLowBattery = c.lowBattery && !(p?.lowBattery);

    const change: AccountChange = {
      accountCode: code,
      accountName: c.accountName,
      prevCrit, currCrit, direction,
      prevSignal: p?.lastSignal ?? null,
      currSignal: c.lastSignal,
      prevPowerOk, currPowerOk,
      powerChanged, lostPower, restoredPower, newLowBattery,
    };
    byCode.set(code, change);
  });

  // Cuentas que estaban ayer y no hoy
  if (hasPrev) {
    prevMap.forEach((p, code) => {
      if (currMap.has(code)) return;
      const change: AccountChange = {
        accountCode: code,
        accountName: p.accountName,
        prevCrit: critOf(p), currCrit: null,
        direction: "disappeared",
        prevSignal: p.lastSignal, currSignal: null,
        prevPowerOk: p.powerOk ?? null, currPowerOk: null,
        powerChanged: false, lostPower: false, restoredPower: false, newLowBattery: false,
      };
      byCode.set(code, change);
    });
  }

  const all = Array.from(byCode.values());
  return {
    byCode,
    worse: all.filter(c => c.direction === "worse"),
    better: all.filter(c => c.direction === "better"),
    added: all.filter(c => c.direction === "new"),
    disappeared: all.filter(c => c.direction === "disappeared"),
    powerChanges: all.filter(c => c.powerChanged || c.newLowBattery),
    hasPrev,
  };
}
