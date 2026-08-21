/**
 * Carga y lectura de evidencias digitales por cliente.
 * Los archivos se guardan en el servidor (backend/data/uploads/clientes/<clienteId>)
 * y se leen desde la misma intranet.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, Paperclip, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { clientDocumentsApi, getFileUrl, isApiConfigured, type ClientDocument } from "@/lib/api";

export const ACCEPTED_DOC_TYPES =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.odt,.ods,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tif,.tiff,.zip,.rar,.7z";

export function useClientDocs(clienteId?: string | number) {
  const [docs, setDocs] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!clienteId || !isApiConfigured()) return;
    setLoading(true);
    try {
      const list = await clientDocumentsApi.list(clienteId);
      setDocs((list || []).filter((d) => d.activo !== false));
    } catch {
      /* backend no disponible */
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => { reload(); }, [reload]);

  return { docs, loading, reload, setDocs };
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface CellProps {
  clienteId?: string | number;
  docKey: string;
  docNombre: string;
  canEdit: boolean;
  docs: ClientDocument[];
  onChanged: () => void;
}

export function DocUploadCell({ clienteId, docKey, docNombre, canEdit, docs, onChanged }: CellProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const mine = docs.filter((d) => d.docKey === docKey);

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !clienteId) return;
    if (!isApiConfigured()) {
      toast({ title: "Servidor no disponible", description: "Conéctese a la intranet para cargar evidencias.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 25 * 1024 * 1024) {
          toast({ title: "Archivo muy grande", description: `${file.name} supera los 25 MB.`, variant: "destructive" });
          continue;
        }
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(new Error("No se pudo leer el archivo"));
          r.readAsDataURL(file);
        });
        await clientDocumentsApi.upload(clienteId, {
          docKey, docNombre, fileName: file.name, dataUrl, mime: file.type,
        });
      }
      toast({ title: "Evidencia cargada", description: docNombre });
      onChanged();
    } catch (e: any) {
      toast({ title: "No se pudo cargar", description: e?.message || "Error", variant: "destructive" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(doc: ClientDocument) {
    const reason = window.prompt(`Justificación para eliminar "${doc.fileName}":`);
    if (!reason?.trim() || !clienteId) return;
    try {
      await clientDocumentsApi.remove(clienteId, doc.id, reason.trim());
      toast({ title: "Documento eliminado" });
      onChanged();
    } catch (e: any) {
      toast({ title: "No se pudo eliminar", description: e?.message || "Error", variant: "destructive" });
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_DOC_TYPES}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={!canEdit || busy || !clienteId}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
          Subir
        </Button>
        {mine.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Paperclip className="h-3 w-3" /> {mine.length}
          </span>
        )}
      </div>
      {mine.length > 0 && (
        <ul className="space-y-0.5">
          {mine.map((d) => (
            <li key={d.id} className="flex items-center gap-1.5 text-[11px]">
              <a
                href={getFileUrl(d.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline truncate max-w-[180px]"
                title={`${d.fileName} · ${fmtSize(d.size)}`}
              >
                {d.fileName}
              </a>
              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
              {canEdit && (
                <button type="button" onClick={() => handleDelete(d)} className="shrink-0" title="Eliminar">
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
