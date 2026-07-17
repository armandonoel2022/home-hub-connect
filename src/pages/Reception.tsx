/**
 * Recepción — Registro de visitantes con escáner QR (cédula dominicana).
 *
 * Escaneo desde webcam con html5-qrcode; el QR de la cédula dominicana
 * suele venir con campos separados por `|` — extraemos cédula (11 dígitos)
 * y el nombre completo automáticamente.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { visitorsApi, isApiConfigured, type Visitor, type VisitorCategory, type VisitorStats } from "@/lib/api";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, LogOut, Trash2, RefreshCw, ScanLine, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const CATEGORY_LABELS: Record<VisitorCategory, string> = {
  cliente_corporativo: "Cliente Corporativo",
  cliente_residencial: "Cliente Residencial",
  solicitante_empleo: "Solicitante de Empleo",
  familiar_amigo: "Familiar / Amigo",
  ex_empleado: "Ex-Empleado",
  proveedor: "Proveedor",
  otro: "Otro",
};

const CATEGORY_COLORS: Record<VisitorCategory, string> = {
  cliente_corporativo: "bg-blue-500",
  cliente_residencial: "bg-cyan-500",
  solicitante_empleo: "bg-emerald-500",
  familiar_amigo: "bg-amber-500",
  ex_empleado: "bg-slate-500",
  proveedor: "bg-purple-500",
  otro: "bg-rose-500",
};

/** Extrae cédula (11 dígitos) y nombre del payload QR de la cédula dominicana. */
function parseCedulaQR(raw: string): { cedula: string; fullName: string } {
  if (!raw) return { cedula: "", fullName: "" };
  const clean = raw.trim();
  // 11 dígitos (con o sin guiones)
  const digitMatch = clean.replace(/\D+/g, "").match(/(\d{11})/);
  const cedula = digitMatch ? `${digitMatch[1].slice(0, 3)}-${digitMatch[1].slice(3, 10)}-${digitMatch[1].slice(10)}` : "";
  // Nombre: separado por | o por saltos. Tomamos el mayor bloque de letras.
  const parts = clean.split(/[|\n\r\t]+/).map((p) => p.trim()).filter(Boolean);
  const nameCandidates = parts.filter((p) => /^[A-Za-zÁÉÍÓÚÜÑñáéíóúü.\s]{5,}$/.test(p));
  const fullName = nameCandidates.sort((a, b) => b.length - a.length)[0] || "";
  return { cedula, fullName };
}

export default function Reception() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("registro");
  const [statusFilter, setStatusFilter] = useState<"all" | "in" | "out">("all");

  // form
  const [cedula, setCedula] = useState("");
  const [fullName, setFullName] = useState("");
  const [category, setCategory] = useState<VisitorCategory>("cliente_corporativo");
  const [host, setHost] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");

  // scanner
  const [scanning, setScanning] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [cameraId, setCameraId] = useState<string>("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const apiOk = isApiConfigured();

  const loadAll = async () => {
    if (!apiOk) return;
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        visitorsApi.list({ status: statusFilter }),
        visitorsApi.stats(),
      ]);
      setVisitors(list);
      setStats(s);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [statusFilter]);

  // Enumerar cámaras al abrir la pestaña
  useEffect(() => {
    if (tab !== "registro") return;
    Html5Qrcode.getCameras()
      .then((devs) => {
        setCameras(devs);
        if (devs.length && !cameraId) setCameraId(devs[0].id);
      })
      .catch(() => {});
  }, [tab]);

  const startScan = async () => {
    if (!cameraId) {
      toast({ title: "Sin cámara", description: "No se detectó una cámara disponible.", variant: "destructive" });
      return;
    }
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 280, height: 280 } },
        (decoded) => {
          const { cedula: c, fullName: n } = parseCedulaQR(decoded);
          if (c) setCedula(c);
          if (n) setFullName(n);
          toast({ title: "QR leído", description: c || decoded.slice(0, 60) });
          stopScan();
        },
        () => {}
      );
      setScanning(true);
    } catch (e: any) {
      toast({ title: "Error de cámara", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const stopScan = async () => {
    try {
      await scannerRef.current?.stop();
      await scannerRef.current?.clear();
    } catch { /* ignore */ }
    scannerRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => { stopScan(); }, []);

  const submit = async () => {
    if (!fullName.trim()) {
      toast({ title: "Falta nombre", description: "Escribe o escanea el nombre del visitante.", variant: "destructive" });
      return;
    }
    if (!apiOk) {
      toast({ title: "Backend no configurado", description: "La API de la intranet no está disponible.", variant: "destructive" });
      return;
    }
    try {
      await visitorsApi.create({ cedula, fullName, category, host, purpose, notes });
      toast({ title: "Visitante registrado", description: fullName });
      setCedula(""); setFullName(""); setHost(""); setPurpose(""); setNotes("");
      setCategory("cliente_corporativo");
      await loadAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const doCheckout = async (v: Visitor) => {
    try {
      await visitorsApi.checkout(v.id);
      toast({ title: "Salida registrada", description: v.fullName });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const doDelete = async (v: Visitor) => {
    if (!confirm(`¿Eliminar el registro de ${v.fullName}?`)) return;
    try {
      await visitorsApi.remove(v.id);
      await loadAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const totalByCat = useMemo(() => {
    if (!stats) return [] as { cat: VisitorCategory; count: number }[];
    return (Object.keys(stats.byCategory) as VisitorCategory[])
      .map((k) => ({ cat: k, count: stats.byCategory[k] || 0 }))
      .sort((a, b) => b.count - a.count);
  }, [stats]);

  const maxCount = Math.max(1, ...totalByCat.map((x) => x.count));

  return (
    <AppLayout>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold">Recepción</h1>
            <p className="text-sm text-muted-foreground">Control de visitantes con escaneo de cédula.</p>
          </div>
          <Button variant="outline" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </div>

        {!apiOk && (
          <Card className="border-destructive/40">
            <CardContent className="p-4 text-sm text-destructive">
              La API local no está configurada. Inicia el backend en el servidor para persistir los registros.
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total visitas</p>
            <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Dentro ahora</p>
            <p className="text-2xl font-bold text-emerald-600">{stats?.currentlyIn ?? 0}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Categoría top</p>
            <p className="text-sm font-semibold">{totalByCat[0] ? CATEGORY_LABELS[totalByCat[0].cat] : "—"}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Hoy</p>
            <p className="text-2xl font-bold">{stats?.byDay?.[new Date().toISOString().slice(0, 10)] ?? 0}</p>
          </CardContent></Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="registro"><UserPlus className="h-4 w-4 mr-2" />Registro</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>

          {/* REGISTRO */}
          <TabsContent value="registro" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><ScanLine className="h-5 w-5" /> Escanear cédula (QR)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Select value={cameraId} onValueChange={setCameraId}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar cámara" /></SelectTrigger>
                      <SelectContent>
                        {cameras.map((c) => <SelectItem key={c.id} value={c.id}>{c.label || c.id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!scanning ? (
                      <Button onClick={startScan}><Camera className="h-4 w-4 mr-2" />Iniciar</Button>
                    ) : (
                      <Button variant="destructive" onClick={stopScan}><CameraOff className="h-4 w-4 mr-2" />Detener</Button>
                    )}
                  </div>
                  <div id="qr-reader" className="rounded-md overflow-hidden bg-black/5 min-h-[280px]" />
                  <p className="text-xs text-muted-foreground">
                    Apunta el QR de la cédula al lector. La cédula y el nombre se completarán automáticamente.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Datos del visitante</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Cédula</Label>
                    <Input value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="001-1234567-8" />
                  </div>
                  <div>
                    <Label>Nombre completo *</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre y apellidos" />
                  </div>
                  <div>
                    <Label>Tipo de visitante *</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as VisitorCategory)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CATEGORY_LABELS) as VisitorCategory[]).map((k) => (
                          <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Persona a visitar</Label>
                      <Input value={host} onChange={(e) => setHost(e.target.value)} />
                    </div>
                    <div>
                      <Label>Motivo</Label>
                      <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Notas</Label>
                    <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <Button onClick={submit} className="w-full" size="lg">
                    <UserPlus className="h-4 w-4 mr-2" />Registrar entrada
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* HISTORIAL */}
          <TabsContent value="historial" className="space-y-3">
            <div className="flex gap-2">
              {(["all", "in", "out"] as const).map((s) => (
                <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)}>
                  {s === "all" ? "Todos" : s === "in" ? "Dentro" : "Salieron"}
                </Button>
              ))}
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-3">Visitante</th>
                        <th className="p-3">Cédula</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Visita a</th>
                        <th className="p-3">Entrada</th>
                        <th className="p-3">Salida</th>
                        <th className="p-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitors.length === 0 && (
                        <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sin registros.</td></tr>
                      )}
                      {visitors.map((v) => (
                        <tr key={v.id} className="border-t">
                          <td className="p-3 font-medium">{v.fullName}</td>
                          <td className="p-3 text-muted-foreground">{v.cedula || "—"}</td>
                          <td className="p-3">
                            <Badge className={`${CATEGORY_COLORS[v.category]} text-white`}>{CATEGORY_LABELS[v.category]}</Badge>
                          </td>
                          <td className="p-3">{v.host || "—"}</td>
                          <td className="p-3">{format(new Date(v.checkInAt), "dd/MM HH:mm", { locale: es })}</td>
                          <td className="p-3">{v.checkOutAt ? format(new Date(v.checkOutAt), "dd/MM HH:mm", { locale: es }) : <Badge variant="secondary">Dentro</Badge>}</td>
                          <td className="p-3 text-right space-x-1">
                            {!v.checkOutAt && (
                              <Button size="sm" variant="outline" onClick={() => doCheckout(v)}>
                                <LogOut className="h-3.5 w-3.5 mr-1" />Salida
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => doDelete(v)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DASHBOARD */}
          <TabsContent value="dashboard" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Visitas por tipo</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {totalByCat.map(({ cat, count }) => (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{CATEGORY_LABELS[cat]}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${CATEGORY_COLORS[cat]}`} style={{ width: `${(count / maxCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {totalByCat.length === 0 && <p className="text-sm text-muted-foreground">Sin datos.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
