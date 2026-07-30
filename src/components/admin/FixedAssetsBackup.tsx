import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, HardDriveDownload, RefreshCw, Trash2, ShieldCheck, FileSpreadsheet } from "lucide-react";
import { fixedAssetsSqlApi, isApiConfigured, type FixedAssetsBackupMeta } from "@/lib/api";
import type { FixedAsset } from "@/lib/fixedAssetsData";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onBack: () => void;
  assets: FixedAsset[];
}

const fmtMoney = (n: number) =>
  (n || 0).toLocaleString("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 2 });

const download = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

const toCsv = (rows: FixedAsset[]) => {
  const cols = [
    "id", "codigoOriginal", "tipo", "descripcion", "marca", "modelo", "serial",
    "fechaAdquisicion", "costoAdquisicion", "categoria", "ubicacion", "departamento",
    "depreciacion", "estado", "condicion", "asignadoA", "vidaUtilAnios", "notas",
  ] as const;
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map(r => cols.map(c => esc((r as any)[c])).join(","))].join("\n");
};

export default function FixedAssetsBackup({ onBack, assets }: Props) {
  const { toast } = useToast();
  const [backups, setBackups] = useState<FixedAssetsBackupMeta[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!isApiConfigured()) return;
    try { setBackups(await fixedAssetsSqlApi.listBackups()); } catch { /* backend opcional */ }
  };

  useEffect(() => { refresh(); }, []);

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  const saveServer = async () => {
    if (!isApiConfigured()) {
      toast({ title: "API no configurada", description: "Descarga el respaldo local mientras tanto.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await fixedAssetsSqlApi.createBackup(assets, note);
      setNote("");
      await refresh();
      toast({ title: "✅ Respaldo guardado en el servidor", description: `${assets.length} activos` });
    } catch (e: any) {
      toast({ title: "Error al respaldar", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const restoreDownload = async (id: string) => {
    try {
      const b = await fixedAssetsSqlApi.getBackup(id);
      download(`activos-fijos-${id}.json`, JSON.stringify(b.assets, null, 2), "application/json");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const removeBackup = async (id: string) => {
    try { await fixedAssetsSqlApi.deleteBackup(id); await refresh(); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const totalCosto = assets.reduce((s, a) => s + (a.costoAdquisicion || 0), 0);

  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="mb-4 gap-2">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Button>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Respaldo de Activos Fijos (Intranet)
        </h2>
        <p className="text-sm text-muted-foreground">
          Extrae y preserva todo lo registrado en la intranet antes de leer directamente desde la base de datos SafeOne.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="border rounded-xl p-4 bg-card">
          <p className="text-xs text-muted-foreground">Activos en intranet</p>
          <p className="text-2xl font-bold">{assets.length}</p>
        </div>
        <div className="border rounded-xl p-4 bg-card">
          <p className="text-xs text-muted-foreground">Valor registrado</p>
          <p className="text-2xl font-bold">{fmtMoney(totalCosto)}</p>
        </div>
        <div className="border rounded-xl p-4 bg-card">
          <p className="text-xs text-muted-foreground">Respaldos en servidor</p>
          <p className="text-2xl font-bold">{backups.length}</p>
        </div>
      </div>

      <div className="border rounded-xl p-4 bg-card mb-6 space-y-3">
        <h3 className="font-semibold text-sm">Generar respaldo</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => download(`activos-fijos-intranet-${stamp}.json`, JSON.stringify(assets, null, 2), "application/json")}
          >
            <Download className="h-4 w-4" /> Descargar JSON
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => download(`activos-fijos-intranet-${stamp}.csv`, "\uFEFF" + toCsv(assets), "text/csv;charset=utf-8")}
          >
            <FileSpreadsheet className="h-4 w-4" /> Descargar CSV (Excel)
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 items-center pt-2 border-t">
          <Input
            className="max-w-sm"
            placeholder="Nota del respaldo (ej: antes de migrar a SafeOne)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button onClick={saveServer} disabled={busy || !assets.length} className="gap-2">
            <HardDriveDownload className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} /> Guardar en servidor
          </Button>
          <Button variant="ghost" size="icon" onClick={refresh} title="Actualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Historial de respaldos</h3>
        </div>
        {backups.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Aún no hay respaldos guardados en el servidor.</p>
        ) : (
          <div className="divide-y">
            {backups.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Badge variant="outline">{b.id}</Badge>
                <span className="text-sm">{new Date(b.createdAt).toLocaleString("es-DO")}</span>
                <span className="text-sm text-muted-foreground">{b.count} activos · {fmtMoney(b.totalCosto)}</span>
                {b.note && <span className="text-xs italic text-muted-foreground">“{b.note}”</span>}
                <span className="text-xs text-muted-foreground ml-auto">{b.createdBy}</span>
                <Button variant="ghost" size="icon" onClick={() => restoreDownload(b.id)} title="Descargar">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => removeBackup(b.id)} title="Eliminar">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
