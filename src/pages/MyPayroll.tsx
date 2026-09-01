import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  myPayrollApi,
  type MyPayrollScope,
  type MyPayrollPeriod,
  type MyPayrollPayslipsResponse,
  type GeneralPayslip,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet, ShieldCheck, Users, User, AlertTriangle, RefreshCw } from "lucide-react";
import { periodLabel, payDateLabel } from "@/lib/generalPayslipPdf";

const money = (n: number) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(Number(n) || 0);

const LEVEL_META: Record<string, { label: string; desc: string; icon: typeof User }> = {
  full: { label: "Acceso total", desc: "Puedes ver la nómina completa de la empresa.", icon: ShieldCheck },
  dept: { label: "Mi equipo", desc: "Ves tu información y la del personal a tu cargo.", icon: Users },
  self: { label: "Sólo mi información", desc: "Ves únicamente tu propio comprobante de pago.", icon: User },
  none: { label: "Sin registro", desc: "No encontramos tu registro de empleado en GENERAL.", icon: AlertTriangle },
};

const MyPayroll = () => {
  const { user } = useAuth();
  const [scope, setScope] = useState<MyPayrollScope | null>(null);
  const [periods, setPeriods] = useState<MyPayrollPeriod[]>([]);
  const [periodKey, setPeriodKey] = useState<string>("ultimo");
  const [data, setData] = useState<MyPayrollPayslipsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GeneralPayslip | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, p] = await Promise.all([myPayrollApi.scope(), myPayrollApi.periods()]);
        if (!alive) return;
        setScope(s);
        setPeriods(p);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Error al consultar GENERAL");
      }
    })();
    return () => { alive = false; };
  }, []);

  const load = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        const p = periods.find((x) => `${x.ano}-${x.mes}-${x.periodo}` === periodKey);
        const res = await myPayrollApi.payslips(
          p ? { ano: p.ano, mes: p.mes, periodo: p.periodo } : undefined
        );
        setData(res);
        setSelected(res.items.length === 1 ? res.items[0] : null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al consultar GENERAL");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [periodKey, periods]
  );

  useEffect(() => { void load(); }, [load]);

  const meta = LEVEL_META[scope?.level || "self"];
  const Icon = meta.icon;

  const items = (data?.items || []).filter((i) =>
    !search.trim() || String(i.empleado || "").toLowerCase().includes(search.toLowerCase())
  );
  const multi = (data?.level === "dept" || data?.level === "full");

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="w-6 h-6 text-primary" /> Mi Nómina
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.fullName} • Información salarial confidencial
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </header>

        <Card className="border-l-4 border-l-primary">
          <CardContent className="py-4 flex items-start gap-3">
            <Icon className="w-5 h-5 mt-0.5 text-primary shrink-0" />
            <div className="text-sm">
              <div className="font-semibold text-foreground flex items-center gap-2">
                {meta.label}
                {scope?.deptNombre && <Badge variant="secondary">{scope.deptNombre}</Badge>}
              </div>
              <p className="text-muted-foreground">{meta.desc}</p>
              {scope?.empleado && (
                <p className="text-xs text-muted-foreground mt-1">
                  Empleado: {scope.empleado.nombre} • Código {scope.empleado.codigo || "—"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2 items-center">
          <Select value={periodKey} onValueChange={setPeriodKey}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ultimo">Último pago registrado</SelectItem>
              {periods.map((p) => (
                <SelectItem key={`${p.ano}-${p.mes}-${p.periodo}`} value={`${p.ano}-${p.mes}-${p.periodo}`}>
                  {periodLabel(p.periodo, p.mes, p.ano)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {multi && (
            <Input
              placeholder="Buscar empleado…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[220px]"
            />
          )}
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="py-4 text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </CardContent>
          </Card>
        )}

        {loading && <Skeleton className="h-40 w-full" />}

        {!loading && data && data.items.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {data.message || "No hay pagos registrados para este período."}
            </CardContent>
          </Card>
        )}

        {!loading && multi && items.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Personal a tu cargo ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-right">Devengado</TableHead>
                    <TableHead className="text-right">Deducciones</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i) => (
                    <TableRow
                      key={`${i.codigo}-${i.ano}-${i.mes}-${i.periodo}`}
                      className="cursor-pointer"
                      onClick={() => setSelected(i)}
                    >
                      <TableCell className="font-medium">{i.empleado}</TableCell>
                      <TableCell>{i.codigo || "—"}</TableCell>
                      <TableCell className="text-right">{money(i.totalDevengado)}</TableCell>
                      <TableCell className="text-right text-destructive">
                        {money(i.totalDeducciones)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{money(i.neto)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {!loading && selected && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Desglose · {selected.empleado} ·{" "}
                {periodLabel(selected.periodo, selected.mes, selected.ano)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {payDateLabel(selected.periodo, selected.mes, selected.ano)}
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold mb-2">Ingresos</h3>
                <div className="space-y-1 text-sm">
                  {Object.entries(selected.ingresos)
                    .filter(([, v]) => v !== 0)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-border/50 py-1">
                        <span className="text-muted-foreground">{k}</span>
                        <span>{money(v)}</span>
                      </div>
                    ))}
                  <div className="flex justify-between pt-1 font-semibold">
                    <span>Total devengado</span>
                    <span>{money(selected.totalDevengado)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Deducciones</h3>
                <div className="space-y-1 text-sm">
                  {Object.entries(selected.deducciones)
                    .filter(([, v]) => v !== 0)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-border/50 py-1">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="text-destructive">{money(v)}</span>
                      </div>
                    ))}
                  <div className="flex justify-between pt-1 font-semibold">
                    <span>Total deducciones</span>
                    <span className="text-destructive">{money(selected.totalDeducciones)}</span>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2 rounded-lg bg-muted p-3 flex justify-between items-center">
                <span className="font-semibold">Neto a recibir</span>
                <span className="text-xl font-bold text-primary">{money(selected.neto)}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default MyPayroll;
