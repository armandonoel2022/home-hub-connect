/**
 * Expediente de Asociado de Negocio — bloque editable dentro de la Vista 360°
 * del cliente (Servicio al Cliente / Registro Mercantil).
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PARTNER_FORMS, FORMS_CLIENTE, FORMS_INTERNOS, REQUIRED_DOCS, OFAC_URL, TIPOS_PROVEEDOR,
  calcularProgreso, dossierEstado, uidRef,
  type PartnerDossier, type PartnerForm,
} from "@/lib/businessPartnerForms";
import { DocUploadCell, useClientDocs } from "@/components/clients/ClientDocUploader";
import {
  Download, MapPin, ShieldAlert, ExternalLink, Plus, Trash2, FileCheck2, ClipboardList, Briefcase,
} from "lucide-react";

interface Props {
  dossier: PartnerDossier;
  canEdit: boolean;
  onChange: (next: PartnerDossier) => void;
  /** ID del cliente en gSafeOne — habilita la carga de evidencias en el servidor */
  clienteId?: string | number;
}

export default function BusinessPartnerDossier({ dossier, canEdit, onChange, clienteId }: Props) {
  const { docs, reload } = useClientDocs(clienteId);
  const progreso = calcularProgreso(dossier);
  const estado = dossierEstado(progreso);

  const setForm = (code: string, patch: Partial<PartnerDossier["formularios"][string]>) =>
    onChange({ ...dossier, formularios: { ...dossier.formularios, [code]: { ...dossier.formularios[code], ...patch } } });

  const setDoc = (key: string, patch: Partial<PartnerDossier["documentos"][string]>) =>
    onChange({ ...dossier, documentos: { ...dossier.documentos, [key]: { ...dossier.documentos[key], ...patch } } });

  const setGeo = (patch: Partial<PartnerDossier["georreferenciacion"]>) =>
    onChange({ ...dossier, georreferenciacion: { ...dossier.georreferenciacion, ...patch } });

  const setInfo = (patch: Partial<PartnerDossier["info"]>) =>
    onChange({ ...dossier, info: { ...dossier.info, ...patch } });

  const FormRow = ({ f }: { f: PartnerForm }) => {
    const st = dossier.formularios[f.code] || {};
    return (
      <div className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              <span className="text-primary">{f.code}</span> · {f.nombre}
            </p>
            <p className="text-[11px] text-muted-foreground">{f.formato}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={f.url} download={f.filename} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4 mr-1.5" /> Descargar
            </a>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {f.origen === "cliente" && (
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={!!st.enviado} disabled={!canEdit}
                onCheckedChange={(v) => setForm(f.code, { enviado: !!v })} />
              Enviado al cliente
            </label>
          )}
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={!!st.recibido} disabled={!canEdit}
              onCheckedChange={(v) => setForm(f.code, { recibido: !!v })} />
            {f.origen === "cliente" ? "Recibido" : "Completado"}
          </label>
          {f.origen === "cliente" && (
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={!!st.firmadoSellado} disabled={!canEdit}
                onCheckedChange={(v) => setForm(f.code, { firmadoSellado: !!v })} />
              Firmado y sellado
            </label>
          )}
          <Input type="date" className="h-8 w-[150px] text-xs" value={st.fecha || ""} disabled={!canEdit}
            onChange={(e) => setForm(f.code, { fecha: e.target.value })} />
          <Input className="h-8 flex-1 min-w-[140px] text-xs" placeholder="Nota" value={st.nota || ""} disabled={!canEdit}
            onChange={(e) => setForm(f.code, { nota: e.target.value })} />
          <DocUploadCell clienteId={clienteId} docKey={`form:${f.code}`} docNombre={`${f.code} · ${f.nombre}`}
            canEdit={canEdit} docs={docs} onChanged={reload} />
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-xl border border-border p-4 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" /> Expediente de Asociado de Negocio
        </h3>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${estado.className}`}>
          {estado.label} · {progreso.porcentaje}%
        </span>
      </div>

      {/* Progreso */}
      <div className="space-y-2">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progreso.porcentaje}%` }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {progreso.bloques.map((b) => (
            <div key={b.label} className="rounded-lg border border-border px-2 py-1.5">
              <p className="text-sm font-semibold">{b.completos}/{b.total}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{b.label}</p>
            </div>
          ))}
        </div>
        {progreso.faltantes.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Pendiente:</span> {progreso.faltantes.slice(0, 6).join(" · ")}
            {progreso.faltantes.length > 6 ? ` y ${progreso.faltantes.length - 6} más` : ""}
          </p>
        )}
      </div>

      {/* Formularios al cliente */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">
          Formularios a enviar al cliente (completados, firmados y sellados)
        </h4>
        {FORMS_CLIENTE.map((f) => <FormRow key={f.code} f={f} />)}
      </div>

      {/* Formularios internos */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Formularios de uso interno</h4>
        {FORMS_INTERNOS.map((f) => <FormRow key={f.code} f={f} />)}
      </div>

      {/* Documentación requerida */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
          <FileCheck2 className="h-3.5 w-3.5" /> Documentación requerida al asociado
        </h4>
        {REQUIRED_DOCS.map((doc) => {
          const st = dossier.documentos[doc.key] || {};
          return (
            <div key={doc.key} className="rounded-lg border border-border p-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm flex-1 min-w-[220px]">
                <Checkbox checked={!!st.recibido} disabled={!canEdit}
                  onCheckedChange={(v) => setDoc(doc.key, { recibido: !!v, noAplica: v ? false : st.noAplica })} />
                {doc.nombre}
              </label>
              {doc.opcional && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={!!st.noAplica} disabled={!canEdit}
                    onCheckedChange={(v) => setDoc(doc.key, { noAplica: !!v, recibido: v ? false : st.recibido })} />
                  No aplica
                </label>
              )}
              <Input type="date" className="h-8 w-[150px] text-xs" value={st.fecha || ""} disabled={!canEdit}
                onChange={(e) => setDoc(doc.key, { fecha: e.target.value })} />
              <Input className="h-8 w-[180px] text-xs" placeholder="Nota / referencia" value={st.nota || ""} disabled={!canEdit}
                onChange={(e) => setDoc(doc.key, { nota: e.target.value })} />
              <DocUploadCell clienteId={clienteId} docKey={doc.key} docNombre={doc.nombre}
                canEdit={canEdit} docs={docs} onChanged={reload} />
            </div>
          );
        })}
      </div>

      {/* Georreferenciación */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> Georreferenciación de la empresa
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Coordenadas (lat,lng)</Label>
            <Input value={dossier.georreferenciacion.coordenadas} disabled={!canEdit}
              placeholder="18.4861,-69.9312" onChange={(e) => setGeo({ coordenadas: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Enlace de Google Maps</Label>
            <Input value={dossier.georreferenciacion.mapsUrl} disabled={!canEdit}
              placeholder="https://maps.google.com/..." onChange={(e) => setGeo({ mapsUrl: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Verificado por</Label>
            <Input value={dossier.georreferenciacion.verificadoPor} disabled={!canEdit}
              onChange={(e) => setGeo({ verificadoPor: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Fecha de verificación</Label>
            <Input type="date" value={dossier.georreferenciacion.fecha} disabled={!canEdit}
              onChange={(e) => setGeo({ fecha: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Observaciones</Label>
            <Textarea rows={2} value={dossier.georreferenciacion.nota} disabled={!canEdit}
              onChange={(e) => setGeo({ nota: e.target.value })} />
          </div>
        </div>
        {(dossier.georreferenciacion.mapsUrl || dossier.georreferenciacion.coordenadas) && (
          <Button asChild variant="outline" size="sm">
            <a
              href={dossier.georreferenciacion.mapsUrl ||
                `https://www.google.com/maps?q=${encodeURIComponent(dossier.georreferenciacion.coordenadas)}`}
              target="_blank" rel="noopener noreferrer"
            >
              <MapPin className="h-4 w-4 mr-1.5" /> Ver ubicación
            </a>
          </Button>
        )}
      </div>

      {/* OFAC */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> Consulta lista de sanciones OFAC
          </h4>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={OFAC_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1.5" /> Abrir OFAC
              </a>
            </Button>
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={() => onChange({
                ...dossier,
                ofac: [...dossier.ofac, { id: uidRef("OFAC"), nombre: "", tipo: "Empresa", fecha: "", resultado: "Pendiente", nota: "" }],
              })}>
                <Plus className="h-4 w-4 mr-1.5" /> Agregar consulta
              </Button>
            )}
          </div>
        </div>
        {dossier.ofac.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin consultas registradas. Debe consultarse la empresa y sus representantes legales.</p>
        )}
        {dossier.ofac.map((o, idx) => (
          <div key={o.id} className="rounded-lg border border-border p-3 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
            <div className="sm:col-span-2">
              <Label className="text-xs">Nombre consultado</Label>
              <Input className="h-8" value={o.nombre} disabled={!canEdit} onChange={(e) => {
                const list = dossier.ofac.slice(); list[idx] = { ...o, nombre: e.target.value }; onChange({ ...dossier, ofac: list });
              }} />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={o.tipo} disabled={!canEdit} onValueChange={(v) => {
                const list = dossier.ofac.slice(); list[idx] = { ...o, tipo: v as any }; onChange({ ...dossier, ofac: list });
              }}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Empresa">Empresa</SelectItem>
                  <SelectItem value="Representante legal">Representante legal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" className="h-8" value={o.fecha} disabled={!canEdit} onChange={(e) => {
                const list = dossier.ofac.slice(); list[idx] = { ...o, fecha: e.target.value }; onChange({ ...dossier, ofac: list });
              }} />
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Resultado</Label>
                <Select value={o.resultado} disabled={!canEdit} onValueChange={(v) => {
                  const list = dossier.ofac.slice(); list[idx] = { ...o, resultado: v as any }; onChange({ ...dossier, ofac: list });
                }}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                    <SelectItem value="Sin coincidencias">Sin coincidencias</SelectItem>
                    <SelectItem value="Coincidencia">Coincidencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {canEdit && (
                <Button variant="ghost" size="sm" onClick={() => onChange({ ...dossier, ofac: dossier.ofac.filter((x) => x.id !== o.id) })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
            {o.resultado === "Coincidencia" && (
              <div className="sm:col-span-5">
                <Label className="text-xs text-destructive">Detalle de la coincidencia (requiere escalamiento)</Label>
                <Textarea rows={2} value={o.nota || ""} disabled={!canEdit} onChange={(e) => {
                  const list = dossier.ofac.slice(); list[idx] = { ...o, nota: e.target.value }; onChange({ ...dossier, ofac: list });
                }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Información requerida */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5" /> Información requerida
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Fecha de inicio de operaciones</Label>
            <Input type="date" value={dossier.info.inicioOperaciones} disabled={!canEdit}
              onChange={(e) => setInfo({ inicioOperaciones: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Actividad económica principal</Label>
            <Input value={dossier.info.actividadEconomica} disabled={!canEdit}
              onChange={(e) => setInfo({ actividadEconomica: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Cantidad de empleados</Label>
            <Input type="number" min={0} value={dossier.info.cantidadEmpleados} disabled={!canEdit}
              onChange={(e) => setInfo({ cantidadEmpleados: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Tipo de proveedor</Label>
            <Select value={dossier.info.tipoProveedor || undefined} disabled={!canEdit}
              onValueChange={(v) => setInfo({ tipoProveedor: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {TIPOS_PROVEEDOR.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Principales productos o servicios ofrecidos</Label>
            <Textarea rows={2} value={dossier.info.productosServicios} disabled={!canEdit}
              onChange={(e) => setInfo({ productosServicios: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Referencias comerciales */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Referencias comerciales (mínimo 2)
          </h4>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => onChange({
              ...dossier,
              referencias: [...dossier.referencias, { id: uidRef("REF"), empresa: "", contacto: "", telefono: "", email: "" }],
            })}>
              <Plus className="h-4 w-4 mr-1.5" /> Agregar referencia
            </Button>
          )}
        </div>
        {dossier.referencias.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin referencias registradas.</p>
        )}
        {dossier.referencias.map((r, idx) => {
          const upd = (patch: Partial<typeof r>) => {
            const list = dossier.referencias.slice(); list[idx] = { ...r, ...patch }; onChange({ ...dossier, referencias: list });
          };
          return (
            <div key={r.id} className="rounded-lg border border-border p-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
              <div>
                <Label className="text-xs">Empresa</Label>
                <Input className="h-8" value={r.empresa} disabled={!canEdit} onChange={(e) => upd({ empresa: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Contacto</Label>
                <Input className="h-8" value={r.contacto} disabled={!canEdit} onChange={(e) => upd({ contacto: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Teléfono</Label>
                <Input className="h-8" value={r.telefono} disabled={!canEdit} onChange={(e) => upd({ telefono: e.target.value })} />
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Email</Label>
                  <Input className="h-8" value={r.email} disabled={!canEdit} onChange={(e) => upd({ email: e.target.value })} />
                </div>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => onChange({ ...dossier, referencias: dossier.referencias.filter((x) => x.id !== r.id) })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <label className="sm:col-span-4 flex items-center gap-2 text-xs">
                <Checkbox checked={!!r.verificada} disabled={!canEdit} onCheckedChange={(v) => upd({ verificada: !!v })} />
                Referencia verificada
              </label>
            </div>
          );
        })}
      </div>

      {dossier.updatedAt && (
        <p className="text-[11px] text-muted-foreground">
          Expediente actualizado: {new Date(dossier.updatedAt).toLocaleString("es-DO")}
          {dossier.updatedBy ? ` · ${dossier.updatedBy}` : ""}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        {PARTNER_FORMS.length} formularios oficiales disponibles para descarga.
      </p>
    </section>
  );
}
