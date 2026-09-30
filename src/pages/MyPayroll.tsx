import { Fragment, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  myPayrollApi,
  employeesApi,
  usersApi,
  getFileUrl,
  isApiConfigured,
  generalSqlApi,
  photoSyncApi,
  type GeneralActiveEmployee,
  type MyPayrollScope,
  type MyPayrollPeriod,
  type MyPayrollPayslipsResponse,
  type GeneralPayslip,
  type GeneralPaymentDetail,
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
import { Wallet, ShieldCheck, Users, User, AlertTriangle, RefreshCw, Printer, Upload, X } from "lucide-react";
import { periodLabel, payDateLabel, generateGeneralPayslipPDF } from "@/lib/generalPayslipPdf";

const money = (n: number) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(Number(n) || 0);

/** Convierte un comprobante resumido en el detalle que consume el PDF membretado. */
const toPaymentDetail = (i: GeneralPayslip): GeneralPaymentDetail => ({
  empleado: i.empleado,
  codigo: i.codigo,
  cedula: i.cedula,
  puesto: i.puesto,
  fecha: i.fechaPago,
  periodo: i.periodo,
  mes: i.mes,
  ano: i.ano,
  nomina: i.nomina,
  totalDevengado: i.totalDevengado,
  totalDeducciones: i.totalDeducciones,
  neto: i.neto,
  lineas: [
    ...Object.entries(i.ingresos || {})
      .filter(([, v]) => Number(v) !== 0)
      .map(([concepto, v]) => ({
        concepto, tipo: 1, valor: Number(v), calculado: Number(v), monto: Number(v), comentario: null,
      })),
    ...Object.entries(i.deducciones || {})
      .filter(([, v]) => Number(v) !== 0)
      .map(([concepto, v]) => ({
        concepto, tipo: 2, valor: Number(v), calculado: Math.abs(Number(v)), monto: -Math.abs(Number(v)), comentario: null,
      })),
  ],
});

const LEVEL_META: Record<string, { label: string; desc: string; icon: typeof User }> = {
  full: { label: "Acceso total", desc: "Puedes ver la nómina completa de la empresa.", icon: ShieldCheck },
  dept: { label: "Mi equipo", desc: "Ves tu comprobante y el del personal de tu departamento.", icon: Users },
  team: { label: "Mi equipo", desc: "Ves tu comprobante y el del personal que se reporta a ti.", icon: Users },
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
  const [printing, setPrinting] = useState(false);

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

  const digits = (v?: string | null) => String(v || "").replace(/\D/g, "");
  const mine = useMemo(() => {
    const items = data?.items || [];
    const code = String(scope?.empleado?.codigo || "").trim();
    const ced = digits(scope?.empleado?.cedula);
    return (
      items.find(
        (i) =>
          (code && String(i.codigo || "").trim() === code) ||
          (ced && digits(i.cedula) === ced)
      ) || null
    );
  }, [data, scope]);

  const resolvePhoto = (url?: string | null) =>
    !url ? null : url.startsWith("/photos") || url.startsWith("/uploads") ? getFileUrl(url) : url;

  // ─── Datos del empleado: SIEMPRE por código de empleado o cédula (nunca por nombre) ───
  const [dir, setDir] = useState<{ local: any[]; users: any[]; active: GeneralActiveEmployee[]; photos: Record<string, { photoUrl: string }> }>({ local: [], users: [], active: [], photos: {} });
  const [foundPhotos, setFoundPhotos] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (!isApiConfigured()) return;
    Promise.all([
      employeesApi.getAll().catch(() => [] as any[]),
      usersApi.getAll().catch(() => [] as any[]),
      generalSqlApi.employeesActive().then(r => r.items).catch(() => [] as GeneralActiveEmployee[]),
      employeesApi.photoOverrides().catch(() => ({})),
    ]).then(([local, users, active, photos]) => setDir({ local: local || [], users: users || [], active: active || [], photos: photos || {} }));
  }, []);

  const keyOf = (i: GeneralPayslip) => String(i.codigo || digits(i.cedula) || i.empleado);
  const infoFor = (i: GeneralPayslip) => {
    const code = String(i.codigo || "").trim();
    const ced = digits(i.cedula);
    const match = (c?: any, d?: any) => (code && String(c ?? "").trim() === code) || (ced && digits(d) === ced);
    const l: any = dir.local.find(e => match(e.employeeCode, e.cedula));
    const a = dir.active.find(e => match(e.codigo, e.cedula));
    const u: any = dir.users.find(x => match(x.employeeCode, x.cedula));
    const override = (code && dir.photos[code]?.photoUrl) || null;
    return {
      photoUrl: override || resolvePhoto(l?.photoUrl || l?.photo || u?.photoUrl) || foundPhotos[keyOf(i)] || null,
      puesto: i.puesto || a?.puesto || l?.position || null,
      departamento: a?.departamento || l?.department || scope?.deptNombre || null,
      categoria: l?.category || null,
      nomina: l?.payrollType || i.nomina || null,
      fechaIngreso: a?.fechaIngreso || l?.hireDate || null,
      estatus: a?.estatus || l?.status || null,
    };
  };

  // Último recurso: buscar en carpetas de fotos por código/cédula
  useEffect(() => {
    if (!selected || !isApiConfigured()) return;
    const k = keyOf(selected);
    if (k in foundPhotos || infoFor(selected).photoUrl) return;
    photoSyncApi.find("", { employeeCode: selected.codigo || undefined, cedula: selected.cedula || undefined })
      .then((r: any) => setFoundPhotos(p => ({ ...p, [k]: r?.match?.url ? resolvePhoto(r.match.url) : null })))
      .catch(() => setFoundPhotos(p => ({ ...p, [k]: null })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, dir]);

  const canUploadPhoto = String(user?.email || "").toLowerCase() === "anoel@safeone.com.do";
  const [uploading, setUploading] = useState(false);
  const uploadPhoto = async (i: GeneralPayslip, file: File) => {
    if (!i.codigo) return;
    if (file.size > 2_000_000) { alert("La imagen debe pesar menos de 2 MB"); return; }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(file); });
      const saved = await employeesApi.uploadPhoto(String(i.codigo), dataUrl, i.cedula || undefined);
      setDir(d => ({ ...d, photos: { ...d.photos, [String(i.codigo)]: { photoUrl: saved.photoUrl } } }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo subir la foto");
    } finally { setUploading(false); }
  };

  const printPayslip = async (item: GeneralPayslip) => {
    setPrinting(true);
    try {
      // Preferimos el desglose real del pago (todos los conceptos, incluidos seguros).
      let detail: GeneralPaymentDetail | null = null;
      if (item.pagoOid && item.codigo) {
        try { detail = await myPayrollApi.paymentDetail(item.codigo, item.pagoOid); } catch { detail = null; }
      }
      const extra: any = infoFor(item);
      await generateGeneralPayslipPDF(
        detail || toPaymentDetail(item),
        {
          ...extra,
          nombre: item.empleado || "—",
          codigo: item.codigo,
          cedula: item.cedula,
          puesto: item.puesto || extra.puesto,
        },
        { open: true }
      );
    } finally {
      setPrinting(false);
    }
  };

  const meta = LEVEL_META[scope?.level || "self"];
  const Icon = meta.icon;

  const items = (data?.items || [])
    .filter((i) => !mine || i !== mine)
    .filter((i) =>
      !search.trim() || String(i.empleado || "").toLowerCase().includes(search.toLowerCase())
    );
  const multi = (data?.level === "dept" || data?.level === "full" || data?.level === "team");

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
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

        {!loading && mine && (
          <Card className="border-primary/40">
            <CardHeader className="pb-2 flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" /> Mi comprobante de pago
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {periodLabel(mine.periodo, mine.mes, mine.ano)} · {payDateLabel(mine.periodo, mine.mes, mine.ano)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelected(mine)}>
                  Ver desglose
                </Button>
                <Button size="sm" disabled={printing} onClick={() => void printPayslip(mine)}>
                  <Printer className="w-4 h-4 mr-1.5" /> Imprimir
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Devengado</div>
                <div className="font-semibold">{money(mine.totalDevengado)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Deducciones</div>
                <div className="font-semibold text-destructive">{money(mine.totalDeducciones)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Neto</div>
                <div className="font-bold text-primary">{money(mine.neto)}</div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className={`grid gap-4 items-start ${selected ? "lg:grid-cols-[minmax(0,1fr)_420px]" : ""}`}>
        <div className="min-w-0 space-y-4">
        {!loading && multi && items.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {data?.level === "team" ? "Personal que se reporta a mí" : "Personal de mi departamento"} ({items.length})
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
                      className={`cursor-pointer ${selected === i ? "bg-primary/10" : ""}`}
                      onClick={() => setSelected(i)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {infoFor(i).photoUrl
                            ? <img src={infoFor(i).photoUrl!} alt="" className="h-8 w-8 rounded-full object-cover border border-border" />
                            : <div className="h-8 w-8 rounded-full bg-muted text-[10px] flex items-center justify-center text-muted-foreground">{String(i.empleado || "").split(/\s+/).slice(0, 2).map(p => p[0]).join("")}</div>}
                          {i.empleado}
                        </div>
                      </TableCell>
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

        </div>

        {!loading && selected && (() => {
          const info = infoFor(selected);
          const rows: Array<[string, string]> = [
            ["Código", selected.codigo || "—"], ["Cédula", selected.cedula || "—"],
            ["Puesto", info.puesto || "—"], ["Departamento", info.departamento || "—"],
            ["Categoría", info.categoria || "—"], ["Nómina", info.nomina || "—"],
            ["Fecha de ingreso", info.fechaIngreso ? new Date(info.fechaIngreso).toLocaleDateString("es-DO") : "—"],
            ["Estatus", info.estatus || "—"], ["Fecha de pago", payDateLabel(selected.periodo, selected.mes, selected.ano)],
          ];
          return (
          <Card className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto border-primary/40">
            <CardHeader className="pb-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Comprobante de pago</CardTitle>
                  <p className="text-xs text-muted-foreground">{periodLabel(selected.periodo, selected.mes, selected.ano)}</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Cerrar" onClick={() => setSelected(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="flex gap-3 items-start">
                <div className="shrink-0 space-y-1">
                  {info.photoUrl
                    ? <img src={info.photoUrl} alt={selected.empleado || ""} className="w-24 h-28 object-cover rounded border border-border" />
                    : <div className="w-24 h-28 rounded border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">Sin foto</div>}
                  {canUploadPhoto && selected.codigo && (
                    <label className="flex items-center justify-center gap-1 text-xs text-primary cursor-pointer hover:underline">
                      <Upload className="w-3 h-3" />{uploading ? "Subiendo…" : info.photoUrl ? "Cambiar foto" : "Subir foto"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(selected, f); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
                <div className="min-w-0 text-sm">
                  <div className="font-semibold text-foreground leading-tight mb-1">{selected.empleado}</div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                    {rows.map(([k, v]) => (<Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="truncate">{v}</dd></Fragment>))}
                  </dl>
                </div>
              </div>
              <Button className="w-full" disabled={printing} onClick={() => void printPayslip(selected)}>
                <Printer className="w-4 h-4 mr-1.5" /> Descargar / Imprimir comprobante
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Ingresos</h3>
                <div className="space-y-1 text-sm">
                  {Object.entries(selected.ingresos).filter(([, v]) => v !== 0).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">{k}</span><span>{money(v)}</span></div>
                  ))}
                  <div className="flex justify-between pt-1 font-semibold"><span>Total devengado</span><span>{money(selected.totalDevengado)}</span></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1">Deducciones</h3>
                <div className="space-y-1 text-sm">
                  {Object.entries(selected.deducciones).filter(([, v]) => v !== 0).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">{k}</span><span className="text-destructive">{money(v)}</span></div>
                  ))}
                  <div className="flex justify-between pt-1 font-semibold"><span>Total deducciones</span><span className="text-destructive">{money(selected.totalDeducciones)}</span></div>
                </div>
              </div>
              <div className="rounded-lg bg-muted p-3 flex justify-between items-center">
                <span className="font-semibold">Neto a recibir</span>
                <span className="text-xl font-bold text-primary">{money(selected.neto)}</span>
              </div>
            </CardContent>
          </Card>
          );
        })()}
        </div>
      </div>
    </AppLayout>
  );
};

export default MyPayroll;
