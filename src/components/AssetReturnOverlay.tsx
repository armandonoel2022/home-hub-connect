/**
 * AssetReturnOverlay — Shown to employees who resign, listing
 * all company assets they must return. NOT shown for terminations.
 */
import { useState } from "react";
import { X, Package, Monitor, Smartphone, Car, Shield, AlertTriangle, Printer } from "lucide-react";
import type { AssignedAsset } from "@/lib/assetLinking";

interface AssetReturnOverlayProps {
  userName: string;
  assets: AssignedAsset[];
  onClose: () => void;
}

const typeIcons: Record<string, typeof Monitor> = {
  equipment: Monitor,
  phone: Smartphone,
  vehicle: Car,
  weapon: Shield,
};

const typeColors: Record<string, string> = {
  equipment: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  phone: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  vehicle: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  weapon: "bg-red-500/20 text-red-400 border-red-500/30",
};

const AssetReturnOverlay = ({ userName, assets, onClose }: AssetReturnOverlayProps) => {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden shadow-2xl border border-border animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-heading font-bold text-lg">
                Devolución de Activos de la Empresa
              </h2>
              <p className="text-white/80 text-sm">
                Elementos asignados que deben ser devueltos
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <p className="text-muted-foreground text-sm mb-4">
            Estimado/a <span className="font-semibold text-foreground">{userName}</span>, 
            a continuación se detallan los activos de la empresa que tiene asignados y que deben 
            ser devueltos al Departamento de Tecnología y Monitoreo:
          </p>

          <div className="space-y-3">
            {assets.map((asset) => {
              const Icon = typeIcons[asset.type] || Package;
              const colorClass = typeColors[asset.type] || "bg-muted text-muted-foreground";
              return (
                <div
                  key={asset.id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/30"
                >
                  <div className={`p-2 rounded-lg border ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {asset.typeLabel}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{asset.id}</span>
                    </div>
                    <p className="font-medium text-card-foreground text-sm mt-1">{asset.description}</p>
                    <p className="text-xs text-muted-foreground">{asset.details}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {assets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No se encontraron activos asignados a su nombre.</p>
            </div>
          )}

          <div className="mt-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <strong>Importante:</strong> Debe coordinar la entrega de estos elementos con el 
              Departamento de Tecnología antes de su último día laboral. Para cualquier consulta, 
              comuníquese a la extensión <strong>201</strong> o escriba a{" "}
              <strong>tecnologia@safeone.com.do</strong>.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="ack-assets"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="ack-assets" className="text-sm text-muted-foreground cursor-pointer">
              He leído y entiendo que debo devolver los elementos listados
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-muted-foreground" />
            <button
              onClick={() => window.print()}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Imprimir lista
            </button>
          </div>
          <button
            onClick={onClose}
            disabled={!acknowledged && assets.length > 0}
            className="px-6 py-2.5 rounded-lg text-sm font-medium bg-gold text-charcoal-dark hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetReturnOverlay;
