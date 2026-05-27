import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Image as ImageIcon, RefreshCw, CheckCircle2, AlertTriangle, FolderSearch } from "lucide-react";
import { photoSyncApi, getFileUrl, isApiConfigured, type PhotoSyncScan } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";

type RowSelection = Record<string, boolean>;

function Thumb({ url }: { url: string | null | undefined }) {
  if (!url) return <div className="w-14 h-14 rounded bg-muted flex items-center justify-center text-muted-foreground"><ImageIcon className="w-5 h-5" /></div>;
  const src = url.startsWith("/photos") ? getFileUrl(url) : url;
  return <img src={src} alt="" className="w-14 h-14 rounded object-cover border" loading="lazy" />;
}

export default function PhotoSync() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [scan, setScan] = useState<PhotoSyncScan | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [search, setSearch] = useState("");
  const [selEmp, setSelEmp] = useState<RowSelection>({});
  const [selArmed, setSelArmed] = useState<RowSelection>({});
  const [selUsers, setSelUsers] = useState<RowSelection>({});

  const canUse = user?.isAdmin || user?.department === "Recursos Humanos" || user?.department === "Operaciones" || user?.department === "Tecnología";

  const runScan = async () => {
    setLoading(true);
    try {
      const data = await photoSyncApi.scan();
      setScan(data);
      // Pre-select all matched rows that don't have a photo yet
      const e: RowSelection = {}, a: RowSelection = {}, u: RowSelection = {};
      data.employees.forEach(r => { if (r.match && (!r.currentPhoto || overwrite)) e[r.employeeCode] = true; });
      data.armed.forEach(r => { if (r.match && (!r.currentPhoto || overwrite)) a[r.id] = true; });
      data.users.forEach(r => { if (r.match && (!r.currentPhoto || overwrite)) u[r.id] = true; });
      setSelEmp(e); setSelArmed(a); setSelUsers(u);
    } catch (err: any) {
      toast({ title: "Error al escanear", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (canUse && isApiConfigured()) runScan(); /* eslint-disable-next-line */ }, [canUse]);

  const filtered = useMemo(() => {
    if (!scan) return null;
    const q = search.trim().toLowerCase();
    const f = (s: string) => !q || s.toLowerCase().includes(q);
    return {
      employees: scan.employees.filter(r => f(r.fullName) || f(r.employeeCode || "")),
      armed: scan.armed.filter(r => f(r.fullName) || f(r.employeeCode || "")),
      users: scan.users.filter(r => f(r.fullName) || f(r.email)),
      unmatchedFiles: scan.unmatchedFiles.filter(p => f(p.file)),
    };
  }, [scan, search]);

  const applySelected = async () => {
    if (!scan) return;
    const payload = {
      employees: scan.employees.filter(r => r.match && selEmp[r.employeeCode]).map(r => ({ employeeCode: r.employeeCode, url: r.match!.url })),
      armed: scan.armed.filter(r => r.match && selArmed[r.id]).map(r => ({ id: r.id, url: r.match!.url, fullName: r.fullName })),
      users: scan.users.filter(r => r.match && selUsers[r.id]).map(r => ({ id: r.id, url: r.match!.url })),
      overwrite,
      uploadedBy: user?.fullName || "Sistema",
    };
    const total = payload.employees.length + payload.armed.length + payload.users.length;
    if (total === 0) {
      toast({ title: "Nada seleccionado", description: "Marca al menos una fila para aplicar." });
      return;
    }
    setApplying(true);
    try {
      const r = await photoSyncApi.apply(payload);
      toast({
        title: "Fotos aplicadas",
        description: `Empleados: ${r.empUpdated} · Personal Armado: ${r.armedUpdated} · Usuarios: ${r.usersUpdated}`,
      });
      await runScan();
    } catch (err: any) {
      toast({ title: "Error al aplicar", description: err.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  if (!canUse) return <Navigate to="/" replace />;

  if (!isApiConfigured()) {
    return (
      <AppLayout>
        <div className="p-6 max-w-3xl mx-auto">
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Esta herramienta sólo funciona en el servidor local de SafeOne (donde está la carpeta <code>C:\intranet-nueva\FOTOS</code>).
              En el preview de Lovable la API no está configurada.
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gold flex items-center gap-2">
              <FolderSearch className="w-7 h-7" /> Sincronizar Fotos desde Carpeta
            </h1>
            <p className="text-muted-foreground mt-1">
              Lee {(scan?.photoSources?.length ? scan.photoSources : [{ dir: scan?.photosDir || "C:\\intranet-nueva\\FOTOS", base: "/photos" }]).map((src, idx) => (
                <code key={`${src.base}-${idx}`} className="text-xs bg-muted px-1 rounded mr-1">{src.dir}</code>
              ))}{" "}
              y vincula automáticamente cada archivo al empleado, agente armado o usuario correspondiente por nombre.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={runScan} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Re-escanear
            </Button>
            <Button onClick={applySelected} disabled={applying || !scan}>
              {applying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Aplicar selección
            </Button>
          </div>
        </div>

        {scan && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{scan.photosCount}</div><div className="text-xs text-muted-foreground">Fotos en carpeta</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{scan.counts.employees.matched}/{scan.counts.employees.total}</div><div className="text-xs text-muted-foreground">Empleados con coincidencia</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{scan.counts.armed.matched}/{scan.counts.armed.total}</div><div className="text-xs text-muted-foreground">Personal Armado con coincidencia</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{scan.unmatchedFiles.length}</div><div className="text-xs text-muted-foreground">Fotos sin coincidencia</div></CardContent></Card>
          </div>
        )}

        <Card>
          <CardContent className="pt-6 flex items-center gap-4 flex-wrap">
            <Input placeholder="Buscar por nombre, código o email…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={overwrite} onCheckedChange={v => setOverwrite(!!v)} />
              Sobrescribir foto existente
            </label>
          </CardContent>
        </Card>

        {!scan ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gold" /></div>
        ) : (
          <Tabs defaultValue="employees">
            <TabsList>
              <TabsTrigger value="employees">Empleados ({filtered?.employees.length})</TabsTrigger>
              <TabsTrigger value="armed">Personal Armado ({filtered?.armed.length})</TabsTrigger>
              <TabsTrigger value="users">Usuarios Intranet ({filtered?.users.length})</TabsTrigger>
              <TabsTrigger value="unmatched">Sin coincidencia ({filtered?.unmatchedFiles.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="employees">
              <MatchTable
                rows={filtered!.employees.map(r => ({
                  key: r.employeeCode, sel: selEmp[r.employeeCode], onSel: v => setSelEmp(s => ({ ...s, [r.employeeCode]: v })),
                  fullName: r.fullName, sub: `${r.employeeCode} · ${r.department || ""}`,
                  current: r.currentPhoto, match: r.match,
                }))}
              />
            </TabsContent>

            <TabsContent value="armed">
              <MatchTable
                rows={filtered!.armed.map(r => ({
                  key: r.id, sel: selArmed[r.id], onSel: v => setSelArmed(s => ({ ...s, [r.id]: v })),
                  fullName: r.fullName, sub: r.employeeCode || r.id,
                  current: r.currentPhoto, match: r.match,
                }))}
              />
            </TabsContent>

            <TabsContent value="users">
              <MatchTable
                rows={filtered!.users.map(r => ({
                  key: r.id, sel: selUsers[r.id], onSel: v => setSelUsers(s => ({ ...s, [r.id]: v })),
                  fullName: r.fullName, sub: r.email,
                  current: r.currentPhoto, match: r.match,
                }))}
              />
            </TabsContent>

            <TabsContent value="unmatched">
              <Card>
                <CardHeader><CardTitle className="text-base">Archivos sin coincidencia automática</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {filtered!.unmatchedFiles.map(p => (
                      <div key={p.file} className="border rounded p-2 text-center">
                        <Thumb url={p.url} />
                        <div className="text-xs mt-2 break-words">{p.cleanedName}</div>
                      </div>
                    ))}
                    {filtered!.unmatchedFiles.length === 0 && <div className="text-sm text-muted-foreground">Todas las fotos fueron asignadas 🎉</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}

interface MatchRow {
  key: string;
  sel: boolean | undefined;
  onSel: (v: boolean) => void;
  fullName: string;
  sub: string;
  current: string | null;
  match: { url: string; file: string; score: number; exact: boolean } | null;
}

function MatchTable({ rows }: { rows: MatchRow[] }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {rows.map(r => (
            <div key={r.key} className={`flex items-center gap-3 p-2 rounded border ${r.match ? "border-border" : "border-dashed border-muted opacity-70"}`}>
              <Checkbox checked={!!r.sel} disabled={!r.match} onCheckedChange={v => r.onSel(!!v)} />
              <Thumb url={r.current} />
              <div className="text-muted-foreground text-xs">→</div>
              <Thumb url={r.match?.url} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.fullName}</div>
                <div className="text-xs text-muted-foreground truncate">{r.sub}</div>
                {r.match && (
                  <div className="text-xs text-muted-foreground truncate">
                    📷 {r.match.file}
                  </div>
                )}
              </div>
              {r.match ? (
                r.match.exact
                  ? <Badge className="bg-emerald-600">Exacto</Badge>
                  : <Badge variant="secondary">{Math.round(r.match.score * 100)}%</Badge>
              ) : (
                <Badge variant="outline">Sin foto</Badge>
              )}
            </div>
          ))}
          {rows.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Sin resultados</div>}
        </div>
      </CardContent>
    </Card>
  );
}
