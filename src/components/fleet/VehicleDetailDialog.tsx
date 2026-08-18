import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import VehicleAvatar from "./VehicleAvatar";
import { DOCUMENT_FIELDS, daysUntil, documentFileName } from "@/lib/vehicleTypes";
import type { Vehiculo } from "@/lib/vehicleTypes";
import { Pencil, Clock } from "lucide-react";

interface Props {
  vehicle: Vehiculo | null;
  onOpenChange: (o: boolean) => void;
  onEdit: (v: Vehiculo) => void;
  canEdit: boolean;
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1.5 border-b border-border/60 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{value ?? "—"}</span>
  </div>
);

const VehicleDetailDialog = ({ vehicle, onOpenChange, onEdit, canEdit }: Props) => {
  const [preview, setPreview] = useState<{ src: string; label: string } | null>(null);
  if (!vehicle) return null;

  return (
    <Dialog open={!!vehicle} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <VehicleAvatar tipo={vehicle.tipo} photo={vehicle.documentos?.fotoVehiculo} size="lg" />
            <div>
              <p>{vehicle.marca} {vehicle.modelo}</p>
              <p className="text-sm font-normal text-muted-foreground">
                {vehicle.placa} · {vehicle.tipo} · {vehicle.anio}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{vehicle.estado}</Badge>
          {vehicle.numeroActivoFijo && <Badge variant="outline">Activo fijo: {vehicle.numeroActivoFijo}</Badge>}
          {canEdit && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => onEdit(vehicle)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
            </Button>
          )}
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 mt-4">
          <div>
            <Row label="VIN" value={vehicle.vin} />
            <Row label="Matrícula" value={vehicle.matricula} />
            <Row label="Color" value={vehicle.color} />
            <Row label="Combustible" value={vehicle.combustible} />
            <Row label="Kilometraje" value={`${(vehicle.kilometraje || 0).toLocaleString()} km`} />
            <Row label="Capacidad" value={vehicle.capacidad} />
          </div>
          <div>
            <Row
              label="Asignado a"
              value={vehicle.asignacion?.empleadoNombre || vehicle.asignacion?.departamento || "Disponible"}
            />
            <Row label="Fecha asignación" value={vehicle.asignacion?.fechaAsignacion} />
            <Row label="Fecha devolución" value={vehicle.asignacion?.fechaDevolucion} />
            <Row label="Seguro" value={vehicle.seguro?.compania} />
            <Row label="Póliza" value={vehicle.seguro?.poliza} />
            <Row label="Vigencia seguro" value={vehicle.seguro?.vigenciaHasta} />
            <Row label="Próximo mantenimiento" value={vehicle.proximoMantenimiento} />
          </div>
        </div>

        {vehicle.observaciones && (
          <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">{vehicle.observaciones}</p>
        )}

        <section className="mt-5">
          <h4 className="font-semibold text-sm mb-2">Documentos</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DOCUMENT_FIELDS.filter((d) => vehicle.documentos?.[d.key]).map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setPreview({ src: vehicle.documentos[d.key]!, label: d.label })}
                className="text-left border border-border rounded-lg p-2 hover:border-primary transition-colors"
              >
                <img src={vehicle.documentos[d.key]} alt={d.label} className="h-24 w-full object-cover rounded" />
                <p className="text-[11px] mt-1 truncate">{d.label}</p>
              </button>
            ))}
            {DOCUMENT_FIELDS.every((d) => !vehicle.documentos?.[d.key]) && (
              <p className="text-xs text-muted-foreground col-span-full">Sin documentos cargados.</p>
            )}
          </div>
        </section>


        <section className="mt-5">
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Historial de movimientos
          </h4>
          <ol className="space-y-2 border-l-2 border-border pl-4">
            {[...(vehicle.historial || [])].reverse().map((h) => (
              <li key={h.id} className="text-xs">
                <span className="font-medium">{new Date(h.fecha).toLocaleString("es-DO")}</span> — {h.descripcion}
                <span className="text-muted-foreground"> · {h.usuario}</span>
              </li>
            ))}
            {(vehicle.historial || []).length === 0 && (
              <li className="text-xs text-muted-foreground">Sin movimientos registrados.</li>
            )}
          </ol>
        </section>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleDetailDialog;
