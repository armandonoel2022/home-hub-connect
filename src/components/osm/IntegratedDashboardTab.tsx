/**
 * Dashboard integrado de Seguimiento Clientes Monitoreo.
 *
 * Universo principal = clientes facturables (CxC). Sobre ellos se cruza:
 *  - LX vinculadas (monitoring-account-settings)
 *  - Último reporte Kronos (kind="kronos")    → cumplimiento de apertura/cierre, señal
 *  - Último reporte Punches (kind="punches")  → cumplimiento de rondas
 *
 * Vistas:
 *  - KPIs facturables / sin servicio / no facturadas / cumplimiento
 *  - Cumplimiento Kronos del último reporte
 *  - Cumplimiento de rondas (Bastones) del día
 *  - Tabla "Facturables sin servicio operativo"
 *  - Tabla "LX activas no facturadas"
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DollarSign, Activity, CheckCircle2, AlertTriangle, WifiOff,
  Radio, Footprints, RefreshCw, Link2Off, Receipt,
} from "lucide-react";
import {
  billingClientsApi, monitoringAccountSettingsApi, monitoringReportsApi,
  punchRulesApi,
  type BillingClient, type MonitoringAccountSetting,
  type MonitoringReportMeta, type PunchRule,
} from "@/lib/api";
import {
  evaluatePunchReport, type PunchParsedReport,
} from "@/lib/punchHtmParser";
import type { KronosParsedReport, KronosAccountRow } from "@/lib/kronosHtmParser";

interface Props { onNavigate?: (tab: string) => void; }

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function IntegratedDashboardTab({ onNavigate }: Props) {
  const [billing, setBilling] = useState<BillingClient[]>([]);
  const [settings, setSettings] = useState<MonitoringAccountSetting[]>([]);
  const [kronos, setKronos] = useState<KronosParsedReport | null>(null);
  const [kronosMeta, setKronosMeta] = useState<MonitoringReportMeta | null>(null);
  const [punches, setPunches] = useState<PunchParsedReport | null>(null);
  const [punchesMeta, setPunchesMeta] = useState<MonitoringReportMeta | null>(null);
  const [rules, setRules] = useState<PunchRule[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [b, s, kList, pList, r] = await Promise.all([
        billingClientsApi.list().catch(() => []),
        monitoringAccountSettingsApi.list().catch(() => []),
        monitoringReportsApi.list("kronos").catch(() => []),
        monitoringReportsApi.list("punches").catch(() => []),
        punchRulesApi.list().catch(() => []),
      ]);
      setBilling(b); setSettings(s); setRules(r);
      if (kList[0]) {
        const doc = await monitoringReportsApi.get<KronosParsedReport>(kList[0].id);
        setKronos(doc.payload); setKronosMeta(kList[0]);
      } else { setKronos(null); setKronosMeta(null); }
      if (pList[0]) {
        const doc = await monitoringReportsApi.get<PunchParsedReport>(pList[0].id);
        setPunches(doc.payload); setPunchesMeta(pList[0]);
      } else { setPunches(null); setPunchesMeta(null); }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  /** Punches evaluados con reglas actuales */
  const punchReport = useMemo(
    () => punches ? evaluatePunchReport(punches, rules) : null,
    [punches, rules]
  );

  const data = useMemo(() => {
    // Índices auxiliares
    const settingsByCode = new Map<string, MonitoringAccountSetting>();
    settings.forEach(s => settingsByCode.set(s.accountCode, s));
    const billingById = new Map<string, BillingClient>();
    billing.forEach(b => billingById.set(b.id, b));
    const billingByCode = new Map<string, BillingClient>();
    billing.forEach(b => billingByCode.set(b.code, b));

    // LX por cliente facturable
    const lxByClient = new Map<string, MonitoringAccountSetting[]>();
    settings.forEach(s => {
      if (s.clientId) {
        const arr = lxByClient.get(s.clientId) || [];
        arr.push(s); lxByClient.set(s.clientId, arr);
      }
    });

    const kronosRows: KronosAccountRow[] = kronos?.rows || [];
    const kronosByCode = new Map<string, KronosAccountRow>();
    kronosRows.forEach(r => kronosByCode.set(r.accountCode, r));

    // Universo facturable
    const totalFacturables = billing.length;
    const activeFacturables = billing.filter(b => b.active).length;

    // Facturables CON al menos una LX vinculada
    const facturablesConLX = billing.filter(b => (lxByClient.get(b.id) || []).length > 0).length;
    const facturablesSinLX = totalFacturables - facturablesConLX;

    // LX vistas en Kronos NO vinculadas a billing-client (sin facturación)
    const lxSinFacturacion: KronosAccountRow[] = [];
    kronosRows.forEach(r => {
      const st = settingsByCode.get(r.accountCode);
      const hasBilling = st?.clientId && billingById.has(st.clientId);
      // También considerar que el accountCode coincida con un billing.code
      const billingByAccountCode = billingByCode.get(r.accountCode);
      if (!hasBilling && !billingByAccountCode) lxSinFacturacion.push(r);
    });

    // Cumplimiento Kronos (solo sobre LX vinculadas a facturables)
    const facturableLX = settings.filter(s => s.clientId && billingById.has(s.clientId));
    let okCiclo = 0, sinApertura = 0, sinCierre = 0, sinSenal = 0, mute = 0;
    const facturablesSinServicioOperativo: { client: BillingClient; reason: string }[] = [];
    billing.forEach(b => {
      const lxs = lxByClient.get(b.id) || [];
      if (lxs.length === 0) {
        facturablesSinServicioOperativo.push({ client: b, reason: "Sin LX vinculada" });
        return;
      }
      // Si alguna LX está sin señal o sin apertura/cierre, marcar el cliente
      const reasons: string[] = [];
      lxs.forEach(lx => {
        const isMute = ["Botón de pánico", "Bastón", "Panel de Incendio"].includes(lx.serviceType || "")
                    || ["Cancelada", "Inactiva", "Suspendida", "Dada de baja", "Prueba", "Sin notificaciones"].includes(lx.lxStatus || "");
        if (isMute) { mute++; return; }
        const k = kronosByCode.get(lx.accountCode);
        if (!k || !k.lastSignal) { sinSenal++; reasons.push(`${lx.accountCode}: sin señal`); return; }
        if (k.daysSince !== null && k.daysSince >= 3) { sinSenal++; reasons.push(`${lx.accountCode}: ${k.daysSince}d sin señal`); return; }
        if (!k.lastOpen) { sinApertura++; reasons.push(`${lx.accountCode}: sin apertura`); return; }
        if (!k.lastClose) { sinCierre++; reasons.push(`${lx.accountCode}: sin cierre`); return; }
        okCiclo++;
      });
      if (reasons.length) facturablesSinServicioOperativo.push({ client: b, reason: reasons.join(" • ") });
    });

    // Cumplimiento rondas
    const punchStats = punchReport ? {
      total: punchReport.clients.length,
      ok: punchReport.clients.filter(c => c.compliance === "ok").length,
      partial: punchReport.clients.filter(c => c.compliance === "partial").length,
      missed: punchReport.clients.filter(c => c.compliance === "missed").length,
      noRules: punchReport.clients.filter(c => c.compliance === "no-rules").length,
    } : null;

    return {
      totalFacturables, activeFacturables,
      facturablesConLX, facturablesSinLX,
      lxSinFacturacion,
      facturableLX: facturableLX.length,
      okCiclo, sinApertura, sinCierre, sinSenal, mute,
      facturablesSinServicioOperativo,
      punchStats,
    };
  }, [billing, settings, kronos, punchReport]);

  const cumplimientoPct = (data.facturableLX - data.sinSenal) > 0 && data.facturableLX > 0
    ? Math.round(((data.facturableLX - data.sinSenal - data.sinApertura - data.sinCierre) / data.facturableLX) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Vista integrada — Facturación · Kronos · Rondas</h2>
          <p className="text-xs text-muted-foreground">
            Universo: <strong>{data.totalFacturables}</strong> clientes facturables CxC ·
            Último Kronos: <strong>{fmtDate(kronosMeta?.reportDate)}</strong> ·
            Último Punches: <strong>{fmtDate(punchesMeta?.reportDate)}</strong>
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refrescar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Kpi icon={Receipt} color="text-blue-400" label="Facturables CxC" value={data.totalFacturables} />
        <Kpi icon={DollarSign} color="text-emerald-400" label="CxC activos" value={data.activeFacturables} />
        <Kpi icon={Link2Off} color="text-amber-400" label="Sin LX vinculada" value={data.facturablesSinLX} />
        <Kpi icon={Activity} color="text-sky-400" label="LX facturables" value={data.facturableLX} />
        <Kpi icon={CheckCircle2} color="text-emerald-400" label="Cumplió ciclo" value={data.okCiclo} />
        <Kpi icon={WifiOff} color="text-red-400" label="Sin señal" value={data.sinSenal} />
        <Kpi icon={AlertTriangle} color="text-orange-400" label="LX sin facturar" value={data.lxSinFacturacion.length} />
      </div>

      {/* Cumplimiento Kronos */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-400" />
              Cumplimiento Kronos del último reporte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {kronos ? (
              <>
                <div className="flex items-center gap-3">
                  <Progress value={cumplimientoPct} className="flex-1" />
                  <span className="text-lg font-bold">{cumplimientoPct}%</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Row label="Cumplió apertura+cierre" value={data.okCiclo} className="text-emerald-400" />
                  <Row label="Sin apertura" value={data.sinApertura} className="text-amber-400" />
                  <Row label="Sin cierre" value={data.sinCierre} className="text-amber-400" />
                  <Row label="Sin señal (3+ días)" value={data.sinSenal} className="text-red-400" />
                  <Row label="Silenciadas (pánico/bastón/incendio/baja)" value={data.mute} className="text-muted-foreground" />
                </div>
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => onNavigate?.("kronos")}>
                  Ver detalle en Actividad Kronos →
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No hay reportes Kronos cargados todavía.</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Footprints className="h-4 w-4 text-cyan-400" />
              Cumplimiento de rondas (Bastones)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.punchStats ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Row label="Cumplió" value={data.punchStats.ok} className="text-emerald-400" />
                  <Row label="Parcial" value={data.punchStats.partial} className="text-amber-400" />
                  <Row label="Incumplió" value={data.punchStats.missed} className="text-red-400" />
                  <Row label="Sin regla" value={data.punchStats.noRules} className="text-muted-foreground" />
                </div>
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => onNavigate?.("punches")}>
                  Ver detalle en Punches →
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No hay reportes de punches cargados todavía.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Facturables sin servicio operativo */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Clientes facturables sin servicio operativo confirmado
            <Badge variant="outline" className="ml-2 text-xs">
              {data.facturablesSinServicioOperativo.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.facturablesSinServicioOperativo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos los facturables tienen al menos una LX con señal reciente. 🎉</p>
          ) : (
            <div className="max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.facturablesSinServicioOperativo.slice(0, 50).map(({ client, reason }) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-mono text-xs">{client.code}</TableCell>
                      <TableCell className="text-xs">{client.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{client.contact || "—"}</TableCell>
                      <TableCell className="text-xs text-amber-400">{reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.facturablesSinServicioOperativo.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2">… y {data.facturablesSinServicioOperativo.length - 50} más</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LX activas no facturadas */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Link2Off className="h-4 w-4 text-orange-400" />
            LX vistas en Kronos sin vínculo a cliente facturable
            <Badge variant="outline" className="ml-2 text-xs">
              {data.lxSinFacturacion.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.lxSinFacturacion.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todas las LX activas están vinculadas a un cliente CxC.</p>
          ) : (
            <div className="max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Última señal</TableHead>
                    <TableHead>Días s/act.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lxSinFacturacion.slice(0, 50).map(r => (
                    <TableRow key={r.accountCode}>
                      <TableCell className="font-mono text-xs">{r.accountCode}</TableCell>
                      <TableCell className="text-xs">{r.accountName || "—"}</TableCell>
                      <TableCell className="text-xs">{r.lastSignal ? fmtDate(r.lastSignal) : "—"}</TableCell>
                      <TableCell className="text-xs">{r.daysSince ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.lxSinFacturacion.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2">… y {data.lxSinFacturacion.length - 50} más</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, color, label, value }: any) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 text-center">
        <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${className || ""}`}>{value}</span>
    </div>
  );
}
