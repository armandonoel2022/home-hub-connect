import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Database, RefreshCw, CheckCircle2, AlertCircle, Search, Download } from "lucide-react";
import { fixedAssetsSqlApi, type FixedAssetsCompareResponse, isApiConfigured } from "@/lib/api";
import { type FixedAsset } from "@/lib/fixedAssetsData";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Props {
  onBack: () => void;
  intranetAssets: FixedAsset[];
}

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 2 });

const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-DO");
};

export default function FixedAssetsSqlCompare({ onBack, intranetAssets }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FixedAssetsCompareResponse | null>(null);
  const [conn, setConn] = useState<{ connected: boolean; message: string; host?: string | null; database?: string | null } | null>(null);
  const [search, setSearch] = useState("");

  const testConnection = async () => {
    try {
      const s = await fixedAssetsSqlApi.status();
      setConn(s);
      if (!s.connected) toast({ title: "Sin conexión a SafeOne", description: s.message, variant: "destructive" });
      else toast({ title: "Conexión OK", description: `${s.host} / ${s.database}` });
    } catch (e: any) {
      setConn({ connected: false, message: e.message });
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const runCompare = async () => {
    if (!isApiConfigured()) {
      toast({ title: "API no configurada", description: "Configura VITE_API_URL para conectar al backend.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fixedAssetsSqlApi.compare(intranetAssets);
      setData(res);
      toast({ title: "Comparación lista", description: `SQL: ${res.stats.sqlTotal} · Intranet: ${res.stats.intranetTotal} · Coinciden: ${res.stats.matched}` });
    } catch (e: any) {
      toast({ title: "Error al comparar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filterSql = (rows: any[]) => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      [r.Descripcion, r.Serial, r.CodigoBarra, r.Modelo, r.Ubicacion, r.Encargado, r.Departamento]
        .some(v => String(v || "").toLowerCase().includes(q))
    );
  };
  const filterIntranet = (rows: FixedAsset[]) => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(a =>
      [a.descripcion, a.serial, a.codigoOriginal, a.id, a.marca, a.modelo, a.ubicacion, a.asignadoA, a.departamento]
        .some(v => String(v || "").toLowerCase().includes(q))
    );
  };

  const exportCsv = (kind: "onlyInSql" | "onlyInIntranet" | "matched") => {
    if (!data) return;
    let csv = "";
    if (kind === "onlyInSql") {
      csv = "OID,Descripcion,Serial,CodigoBarra,Modelo,Ubicacion,Departamento,Encargado,FechaAdq,CostoAdq\n";
      data.onlyInSql.forEach(r => {
        csv += [r.OID, r.Descripcion, r.Serial, r.CodigoBarra, r.Modelo, r.Ubicacion, r.Departamento, r.Encargado, r.FechaAdq, r.CostoAdq]
          .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",") + "\n";
      });
    } else if (kind === "onlyInIntranet") {
      csv = "ID,CodigoOriginal,Descripcion,Serial,Marca,Modelo,Ubicacion,Departamento,AsignadoA,FechaAdquisicion,CostoAdquisicion\n";
      data.onlyInIntranet.forEach((a: any) => {
        csv += [a.id, a.codigoOriginal, a.descripcion, a.serial, a.marca, a.modelo, a.ubicacion, a.departamento, a.asignadoA, a.fechaAdquisicion, a.costoAdquisicion]
          .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",") + "\n";
      });
    } else {
      csv = "SQL_OID,SQL_Serial,SQL_Descripcion,Intranet_ID,Intranet_Serial,Intranet_Descripcion\n";
      data.matched.forEach(m => {
        csv += [m.sql.OID, m.sql.Serial, m.sql.Descripcion, m.intranet.id, m.intranet.serial, m.intranet.descripcion]
          .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",") + "\n";
      });
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `activo-fijo-${kind}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Volver</Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={testConnection}>
            <Database className="h-4 w-4 mr-2" />Probar conexión SafeOne
          </Button>
          <Button onClick={runCompare} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Comparando..." : "Comparar con base SafeOne"}
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-4">
        <h2 className="text-xl font-bold mb-1">Comparador de Activo Fijo</h2>
        <p className="text-sm text-muted-foreground">
          Lee <code>[SafeOne].[dbo].[ActivoFijo]</code> (solo lectura) y lo cruza contra los activos cargados en la intranet.
          El emparejamiento usa <b>Serial</b> y <b>Código de Barra</b> normalizados. No se modifica ni la intranet ni la base GENERAL.
        </p>
        {conn && (
          <div className={`mt-3 flex items-center gap-2 text-sm ${conn.connected ? "text-emerald-600" : "text-destructive"}`}>
            {conn.connected ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{conn.host || "?"} / <b>{conn.database || "?"}</b> — {conn.message}</span>
          </div>
        )}
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="En SafeOne (SQL)" value={data.stats.sqlTotal} />
            <StatCard label="En Intranet" value={data.stats.intranetTotal} />
            <StatCard label="Coinciden" value={data.stats.matched} tone="ok" />
            <StatCard label="Solo en SQL" value={data.stats.onlyInSql} tone="warn" />
            <StatCard label="Solo en Intranet" value={data.stats.onlyInIntranet} tone="warn" />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por serial, descripción, código..." className="pl-9" />
          </div>

          <Tabs defaultValue="onlyInSql">
            <TabsList>
              <TabsTrigger value="onlyInSql">Faltan en Intranet ({data.stats.onlyInSql})</TabsTrigger>
              <TabsTrigger value="onlyInIntranet">Faltan en SafeOne ({data.stats.onlyInIntranet})</TabsTrigger>
              <TabsTrigger value="matched">Coincidencias ({data.stats.matched})</TabsTrigger>
            </TabsList>

            <TabsContent value="onlyInSql" className="space-y-2">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => exportCsv("onlyInSql")}>
                  <Download className="h-4 w-4 mr-2" />Exportar CSV
                </Button>
              </div>
              <div className="border rounded-lg overflow-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr><Th>OID</Th><Th>Descripción</Th><Th>Serial</Th><Th>Código</Th><Th>Modelo</Th><Th>Ubicación</Th><Th>Encargado</Th><Th>F. Adq.</Th><Th className="text-right">Costo</Th></tr>
                  </thead>
                  <tbody>
                    {filterSql(data.onlyInSql).map(r => (
                      <tr key={r.OID} className="border-t hover:bg-muted/50">
                        <Td>{r.OID}</Td><Td>{r.Descripcion}</Td><Td className="font-mono">{r.Serial}</Td>
                        <Td className="font-mono">{r.CodigoBarra}</Td><Td>{r.Modelo}</Td>
                        <Td>{r.Ubicacion}</Td><Td>{r.Encargado}</Td>
                        <Td>{fmtDate(r.FechaAdq)}</Td><Td className="text-right">{fmtMoney(r.CostoAdq as number)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="onlyInIntranet" className="space-y-2">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => exportCsv("onlyInIntranet")}>
                  <Download className="h-4 w-4 mr-2" />Exportar CSV
                </Button>
              </div>
              <div className="border rounded-lg overflow-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr><Th>ID</Th><Th>Cód. Original</Th><Th>Descripción</Th><Th>Serial</Th><Th>Marca / Modelo</Th><Th>Ubicación</Th><Th>Asignado a</Th><Th>Estado</Th><Th className="text-right">Costo</Th></tr>
                  </thead>
                  <tbody>
                    {filterIntranet(data.onlyInIntranet).map((a: FixedAsset) => (
                      <tr key={a.id} className="border-t hover:bg-muted/50">
                        <Td className="font-mono">{a.id}</Td><Td className="font-mono">{a.codigoOriginal}</Td>
                        <Td>{a.descripcion}</Td><Td className="font-mono">{a.serial}</Td>
                        <Td>{[a.marca, a.modelo].filter(Boolean).join(" / ")}</Td>
                        <Td>{a.ubicacion}</Td><Td>{a.asignadoA}</Td>
                        <Td><Badge variant="outline">{a.estado}</Badge></Td>
                        <Td className="text-right">{fmtMoney(a.costoAdquisicion)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="matched" className="space-y-2">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => exportCsv("matched")}>
                  <Download className="h-4 w-4 mr-2" />Exportar CSV
                </Button>
              </div>
              <div className="border rounded-lg overflow-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr><Th>SQL OID</Th><Th>Serial</Th><Th>SQL Descripción</Th><Th>Intranet ID</Th><Th>Intranet Descripción</Th></tr>
                  </thead>
                  <tbody>
                    {data.matched.filter(m =>
                      !search ||
                      [m.sql.Descripcion, m.sql.Serial, m.intranet.descripcion, m.intranet.id]
                        .some(v => String(v || "").toLowerCase().includes(search.toLowerCase()))
                    ).map(m => (
                      <tr key={m.sql.OID} className="border-t hover:bg-muted/50">
                        <Td>{m.sql.OID}</Td><Td className="font-mono">{m.sql.Serial}</Td>
                        <Td>{m.sql.Descripcion}</Td>
                        <Td className="font-mono">{m.intranet.id}</Td>
                        <Td>{m.intranet.descripcion}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

const Th = ({ children, className = "" }: any) => (
  <th className={`text-left px-3 py-2 font-semibold ${className}`}>{children}</th>
);
const Td = ({ children, className = "" }: any) => (
  <td className={`px-3 py-2 ${className}`}>{children ?? "—"}</td>
);

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
