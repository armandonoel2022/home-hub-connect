import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useArmedPersonnel } from "@/hooks/useApiHooks";
import {
  getClients, getLocationsByClient, getPostsByLocation, getLiveSnapshot, getLatestReportDate,
  saveClient, deleteClient, saveLocation, deleteLocation, savePost, deletePost,
  replaceDailyReport, seedFromPersonnel, yesterdayISO,
  type OpsClient, type OpsLocation, type OpsPost, type OpsTurno, type DailyReport,
  OPS_EVENT,
} from "@/lib/opsExpediente";
import { generateExpedientePDF } from "@/lib/expedientePdf";
import {
  Building2, MapPin, Plus, Trash2, ArrowLeft, ChevronDown, ChevronRight, FileText,
  Crosshair, Users, Pencil, ClipboardList, ExternalLink, RefreshCw, FolderTree,
} from "lucide-react";
import { Link } from "react-router-dom";
import ExpedienteLive from "@/components/operations/ExpedienteLive";

function mapsHref(coord: string): string | null {
  if (!coord) return null;
  if (coord.startsWith("http")) return coord;
  return `https://www.google.com/maps?q=${encodeURIComponent(coord)}`;
}

const ClientExpediente = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: personnel } = useArmedPersonnel();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"vivo" | "manual">("vivo");

  // dialogs
  const [clientDialog, setClientDialog] = useState<Partial<OpsClient> | null>(null);
  const [locationDialog, setLocationDialog] = useState<{ clientId: string; data: Partial<OpsLocation> } | null>(null);
  const [postDialog, setPostDialog] = useState<{ locationId: string; data: Partial<OpsPost> } | null>(null);
  const [reportDialog, setReportDialog] = useState<OpsPost | null>(null);

  // Seed inicial desde Personal Armado
  useEffect(() => {
    if (personnel && personnel.length > 0) {
      const seeded = seedFromPersonnel(personnel);
      if (seeded) refresh();
    }
  }, [personnel]);

  useEffect(() => {
    const h = () => refresh();
    window.addEventListener(OPS_EVENT, h);
    return () => window.removeEventListener(OPS_EVENT, h);
  }, []);

  const clients = useMemo(() => {
    const all = getClients();
    const q = search.toLowerCase().trim();
    if (!q) return all;
    return all.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [tick, search]);

  return (
    <AppLayout>
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Link to="/operaciones" className="hover:text-primary inline-flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Operaciones
              </Link>
            </div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderTree className="h-6 w-6 text-primary" /> Expediente de Clientes
            </h1>
            <p className="text-sm text-muted-foreground">
              Cliente → Localidad → Puesto → Turno. El personal y arma de cada puesto provienen del último reporte diario digitado.
            </p>
          </div>
          <div className="flex gap-2">
            {mode === "manual" && (
              <>
                <Button variant="outline" size="sm" onClick={refresh}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Recargar
                </Button>
                <Button size="sm" onClick={() => setClientDialog({})}>
                  <Plus className="h-4 w-4 mr-1" /> Nuevo cliente
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Selector de fuente de datos */}
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
          <Button
            size="sm"
            variant={mode === "vivo" ? "default" : "ghost"}
            className="h-8"
            onClick={() => setMode("vivo")}
          >
            Vivo (GENERAL)
          </Button>
          <Button
            size="sm"
            variant={mode === "manual" ? "default" : "ghost"}
            className="h-8"
            onClick={() => setMode("manual")}
          >
            Manual
          </Button>
        </div>

        {mode === "vivo" ? (
          <ExpedienteLive onUnavailable={() => { /* el usuario puede cambiar a Manual */ }} />
        ) : (
          <>
            <Input
              placeholder="Buscar cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />

            <div className="space-y-4">
              {clients.length === 0 && (
                <Card className="p-10 text-center text-sm text-muted-foreground">
                  No hay clientes. Crea uno o recarga; se siembran automáticamente desde Personal Armado.
                </Card>
              )}
              {clients.map((client) => (
                <ClientBlock
                  key={client.id}
                  client={client}
                  onEditClient={() => setClientDialog(client)}
                  onDeleteClient={() => {
                    if (confirm(`¿Eliminar el cliente "${client.nombre}" y todas sus localidades/puestos?`)) {
                      deleteClient(client.id);
                      toast({ title: "Cliente eliminado" });
                      refresh();
                    }
                  }}
                  onAddLocation={() => setLocationDialog({ clientId: client.id, data: {} })}
                  onEditLocation={(l) => setLocationDialog({ clientId: client.id, data: l })}
                  onDeleteLocation={(l) => {
                    if (confirm(`¿Eliminar la localidad "${l.nombre}"?`)) { deleteLocation(l.id); refresh(); }
                  }}
                  onAddPost={(locId) => setPostDialog({ locationId: locId, data: {} })}
                  onEditPost={(p) => setPostDialog({ locationId: p.locationId, data: p })}
                  onDeletePost={(p) => {
                    if (confirm(`¿Eliminar el puesto "${p.nombre}"?`)) { deletePost(p.id); refresh(); }
                  }}
                  onReport={(p) => setReportDialog(p)}
                  onPrint={async () => {
                    try {
                      toast({ title: "Generando expediente…" });
                      await generateExpedientePDF(client, { open: true });
                    } catch (e) {
                      console.error("Error generando expediente PDF", e);
                      toast({ title: "No se pudo generar el expediente", description: String((e as Error)?.message || e), variant: "destructive" });
                    }
                  }}
                  tick={tick}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {clientDialog && (
        <ClientDialog
          data={clientDialog}
          onClose={() => setClientDialog(null)}
          onSave={(d) => { saveClient(d); toast({ title: "Cliente guardado" }); setClientDialog(null); refresh(); }}
        />
      )}
      {locationDialog && (
        <LocationDialog
          data={locationDialog.data}
          clientId={locationDialog.clientId}
          onClose={() => setLocationDialog(null)}
          onSave={(d) => { saveLocation(d); toast({ title: "Localidad guardada" }); setLocationDialog(null); refresh(); }}
        />
      )}
      {postDialog && (
        <PostDialog
          data={postDialog.data}
          locationId={postDialog.locationId}
          onClose={() => setPostDialog(null)}
          onSave={(d) => { savePost(d); toast({ title: "Puesto guardado" }); setPostDialog(null); refresh(); }}
        />
      )}
      {reportDialog && (
        <DailyReportDialog
          post={reportDialog}
          personnel={personnel || []}
          createdBy={user?.fullName || "Operaciones"}
          onClose={() => setReportDialog(null)}
          onSaved={() => { toast({ title: "Reporte diario guardado" }); setReportDialog(null); refresh(); }}
        />
      )}

      <Footer />
    </AppLayout>
  );
};

// ─── Client block ───
function ClientBlock({
  client, onEditClient, onDeleteClient, onAddLocation, onEditLocation, onDeleteLocation,
  onAddPost, onEditPost, onDeletePost, onReport, onPrint, tick,
}: {
  client: OpsClient;
  onEditClient: () => void;
  onDeleteClient: () => void;
  onAddLocation: () => void;
  onEditLocation: (l: OpsLocation) => void;
  onDeleteLocation: (l: OpsLocation) => void;
  onAddPost: (locId: string) => void;
  onEditPost: (p: OpsPost) => void;
  onDeletePost: (p: OpsPost) => void;
  onReport: (p: OpsPost) => void;
  onPrint: () => void;
  tick: number;
}) {
  const [open, setOpen] = useState(true);
  const locations = useMemo(() => getLocationsByClient(client.id), [client.id, tick]);
  const totalPosts = useMemo(
    () => locations.reduce((s, l) => s + getPostsByLocation(l.id).length, 0),
    [locations, tick],
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 p-4 bg-secondary text-secondary-foreground">
        <button onClick={() => setOpen((v) => !v)} className="shrink-0">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Building2 className="h-5 w-5 text-gold shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold text-sm truncate">{client.nombre}</p>
          <p className="text-xs opacity-80">
            {locations.length} localidad(es) · {totalPosts} puesto(s)
            {client.contrato?.numero ? ` · Contrato ${client.contrato.numero}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary-foreground hover:bg-white/10" onClick={onPrint} title="Imprimir expediente">
            <FileText className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary-foreground hover:bg-white/10" onClick={onEditClient} title="Editar cliente">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary-foreground hover:bg-white/10" onClick={onDeleteClient} title="Eliminar cliente">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            {client.coordinates ? (
              <a href={mapsHref(client.coordinates) || "#"} target="_blank" rel="noopener noreferrer"
                 className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Geolocalización del cliente <ExternalLink className="h-3 w-3" />
              </a>
            ) : <span />}
            <Button variant="outline" size="sm" onClick={onAddLocation}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Localidad
            </Button>
          </div>

          {locations.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Sin localidades. Agrega una.</p>
          )}
          {locations.map((loc) => (
            <LocationBlock
              key={loc.id}
              location={loc}
              onEdit={() => onEditLocation(loc)}
              onDelete={() => onDeleteLocation(loc)}
              onAddPost={() => onAddPost(loc.id)}
              onEditPost={onEditPost}
              onDeletePost={onDeletePost}
              onReport={onReport}
              tick={tick}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Location block ───
function LocationBlock({
  location, onEdit, onDelete, onAddPost, onEditPost, onDeletePost, onReport, tick,
}: {
  location: OpsLocation;
  onEdit: () => void;
  onDelete: () => void;
  onAddPost: () => void;
  onEditPost: (p: OpsPost) => void;
  onDeletePost: (p: OpsPost) => void;
  onReport: (p: OpsPost) => void;
  tick: number;
}) {
  const posts = useMemo(() => getPostsByLocation(location.id), [location.id, tick]);
  return (
    <div className="border-l-2 border-gold/40 pl-3 space-y-2">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-gold shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{location.nombre}</p>
          {location.direccion && <p className="text-xs text-muted-foreground truncate">{location.direccion}</p>}
        </div>
        {location.coordinates && (
          <a href={mapsHref(location.coordinates) || "#"} target="_blank" rel="noopener noreferrer"
             className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0">
            <ExternalLink className="h-3 w-3" /> Mapa
          </a>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        <Button variant="outline" size="sm" onClick={onAddPost}><Plus className="h-3.5 w-3.5 mr-1" /> Puesto</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {posts.map((post) => (
          <PostBlock key={post.id} post={post} onEdit={() => onEditPost(post)} onDelete={() => onDeletePost(post)} onReport={() => onReport(post)} tick={tick} />
        ))}
      </div>
    </div>
  );
}

// ─── Post block (con foto viva del reporte) ───
function PostBlock({ post, onEdit, onDelete, onReport, tick }: {
  post: OpsPost; onEdit: () => void; onDelete: () => void; onReport: () => void; tick: number;
}) {
  const snapshot = useMemo<DailyReport[]>(() => getLiveSnapshot(post.id), [post.id, tick]);
  const fecha = useMemo(() => getLatestReportDate(post.id), [post.id, tick]);
  const turnoName = (id: string) => post.turnos.find((t) => t.id === id)?.nombre || "—";

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{post.nombre}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {post.requiereArma ? (
              <Badge className="text-[10px] gap-1"><Crosshair className="h-3 w-3" /> Requiere arma</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Sin arma</Badge>
            )}
            <Badge variant="outline" className="text-[10px]">{post.turnos.length} turno(s)</Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReport} title="Reporte diario"><ClipboardList className="h-3.5 w-3.5 text-primary" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </div>

      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Users className="h-3 w-3" /> Reporte: {fecha || "sin reporte"} {fecha === yesterdayISO() ? "(ayer)" : ""}
      </div>

      {snapshot.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin personal reportado. Usa el botón de reporte diario.</p>
      ) : (
        <div className="space-y-1">
          {snapshot.map((s) => (
            <div key={s.id} className="text-xs flex items-center gap-2 border-b border-border/50 pb-1 last:border-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.presente ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className="font-medium truncate flex-1">{s.personnelName}</span>
              <span className="text-muted-foreground shrink-0">{turnoName(s.turnoId)}</span>
              {post.requiereArma && (
                <span className="text-muted-foreground shrink-0">{s.armaTipo || "—"}{s.armaSerial ? ` · ${s.armaSerial}` : ""}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dialogs ───
function ClientDialog({ data, onClose, onSave }: {
  data: Partial<OpsClient>; onClose: () => void; onSave: (d: Partial<OpsClient>) => void;
}) {
  const [nombre, setNombre] = useState(data.nombre || "");
  const [numero, setNumero] = useState(data.contrato?.numero || "");
  const [inicio, setInicio] = useState(data.contrato?.inicio || "");
  const [fin, setFin] = useState(data.contrato?.fin || "");
  const [coordinates, setCoordinates] = useState(data.coordinates || "");
  const [notas, setNotas] = useState(data.notas || "");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{data.id ? "Editar cliente" : "Nuevo cliente"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Nombre del cliente</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">No. contrato</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
            <div><Label className="text-xs">Inicio</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
            <div><Label className="text-xs">Fin</Label><Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Geolocalización (lat,lng o link Google Maps)</Label><Input value={coordinates} onChange={(e) => setCoordinates(e.target.value)} /></div>
          <div><Label className="text-xs">Notas</Label><Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nombre.trim()} onClick={() => onSave({ ...data, nombre, contrato: { numero, inicio, fin }, coordinates, notas })}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LocationDialog({ data, clientId, onClose, onSave }: {
  data: Partial<OpsLocation>; clientId: string; onClose: () => void; onSave: (d: Partial<OpsLocation>) => void;
}) {
  const [nombre, setNombre] = useState(data.nombre || "");
  const [direccion, setDireccion] = useState(data.direccion || "");
  const [coordinates, setCoordinates] = useState(data.coordinates || "");
  const [notas, setNotas] = useState(data.notas || "");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{data.id ? "Editar localidad" : "Nueva localidad"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Nombre de la localidad</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div><Label className="text-xs">Dirección</Label><Input value={direccion} onChange={(e) => setDireccion(e.target.value)} /></div>
          <div><Label className="text-xs">Geolocalización (lat,lng o link Google Maps)</Label><Input value={coordinates} onChange={(e) => setCoordinates(e.target.value)} /></div>
          <div><Label className="text-xs">Notas</Label><Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nombre.trim()} onClick={() => onSave({ ...data, clientId, nombre, direccion, coordinates, notas })}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostDialog({ data, locationId, onClose, onSave }: {
  data: Partial<OpsPost>; locationId: string; onClose: () => void; onSave: (d: Partial<OpsPost>) => void;
}) {
  const [nombre, setNombre] = useState(data.nombre || "");
  const [requiereArma, setRequiereArma] = useState(data.requiereArma ?? false);
  const [coordinates, setCoordinates] = useState(data.coordinates || "");
  const [notas, setNotas] = useState(data.notas || "");
  const [turnos, setTurnos] = useState<OpsTurno[]>(data.turnos || []);
  const [newTurno, setNewTurno] = useState({ nombre: "", horario: "" });

  const addTurno = () => {
    if (!newTurno.nombre.trim()) return;
    setTurnos([...turnos, { id: `TRN-${Date.now().toString(36)}`, nombre: newTurno.nombre, horario: newTurno.horario }]);
    setNewTurno({ nombre: "", horario: "" });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{data.id ? "Editar puesto" : "Nuevo puesto"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Nombre del puesto</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={requiereArma} onCheckedChange={(v) => setRequiereArma(!!v)} /> Este puesto requiere arma
          </label>
          <div><Label className="text-xs">Geolocalización (lat,lng o link Google Maps)</Label><Input value={coordinates} onChange={(e) => setCoordinates(e.target.value)} /></div>

          <div>
            <Label className="text-xs">Turnos</Label>
            <div className="space-y-1 mb-2">
              {turnos.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm border rounded px-2 py-1">
                  <span className="flex-1">{t.nombre}{t.horario ? ` · ${t.horario}` : ""}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTurnos(turnos.filter((x) => x.id !== t.id))}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              {turnos.length === 0 && <p className="text-xs text-muted-foreground italic">Sin turnos.</p>}
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input placeholder="Nombre (Diurno...)" value={newTurno.nombre} onChange={(e) => setNewTurno({ ...newTurno, nombre: e.target.value })} />
              <Input placeholder="Horario (06:00-18:00)" value={newTurno.horario} onChange={(e) => setNewTurno({ ...newTurno, horario: e.target.value })} />
              <Button variant="outline" size="sm" onClick={addTurno}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          <div><Label className="text-xs">Notas</Label><Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nombre.trim()} onClick={() => onSave({ ...data, locationId, nombre, requiereArma, coordinates, notas, turnos })}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Daily report dialog ───
interface ReportRow {
  turnoId: string;
  personnelName: string;
  personnelId: string;
  presente: boolean;
  armaTipo: string;
  armaSerial: string;
  novedades: string;
}

function DailyReportDialog({ post, personnel, createdBy, onClose, onSaved }: {
  post: OpsPost;
  personnel: { id: string; name?: string; employeeCode?: string; weaponType?: string; weaponSerial?: string }[];
  createdBy: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fecha, setFecha] = useState(yesterdayISO());
  const [rows, setRows] = useState<ReportRow[]>(() => {
    const existing = getLiveSnapshot(post.id);
    if (existing.length > 0) {
      return existing.map((s) => ({
        turnoId: s.turnoId, personnelName: s.personnelName, personnelId: s.personnelId,
        presente: s.presente, armaTipo: s.armaTipo, armaSerial: s.armaSerial, novedades: s.novedades,
      }));
    }
    return [{ turnoId: post.turnos[0]?.id || "", personnelName: "", personnelId: "", presente: true, armaTipo: "", armaSerial: "", novedades: "" }];
  });

  const setRow = (i: number, patch: Partial<ReportRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const onPickPerson = (i: number, name: string) => {
    const match = personnel.find((p) => (p.name || "") === name);
    setRow(i, {
      personnelName: name,
      personnelId: match?.id || "",
      armaTipo: post.requiereArma ? (match?.weaponType || "") : "",
      armaSerial: post.requiereArma ? (match?.weaponSerial || "") : "",
    });
  };

  const save = () => {
    const valid = rows.filter((r) => r.personnelName.trim());
    replaceDailyReport(post.id, fecha, valid, createdBy);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Reporte diario — {post.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs">Fecha del reporte</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-44" />
            </div>
            <p className="text-xs text-muted-foreground pb-2">El expediente muestra el reporte de ayer por defecto.</p>
          </div>

          <datalist id={`personnel-${post.id}`}>
            {personnel.map((p) => <option key={p.id} value={p.name || ""} />)}
          </datalist>

          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Personal</Label>
                    <Input list={`personnel-${post.id}`} value={r.personnelName} onChange={(e) => onPickPerson(i, e.target.value)} placeholder="Nombre del agente" />
                  </div>
                  <div>
                    <Label className="text-xs">Turno</Label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={r.turnoId} onChange={(e) => setRow(i, { turnoId: e.target.value })}>
                      <option value="">Seleccionar turno</option>
                      {post.turnos.map((t) => <option key={t.id} value={t.id}>{t.nombre}{t.horario ? ` (${t.horario})` : ""}</option>)}
                    </select>
                  </div>
                </div>
                {post.requiereArma && (
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Arma (tipo)</Label><Input value={r.armaTipo} onChange={(e) => setRow(i, { armaTipo: e.target.value })} /></div>
                    <div><Label className="text-xs">Serial</Label><Input value={r.armaSerial} onChange={(e) => setRow(i, { armaSerial: e.target.value })} /></div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={r.presente} onCheckedChange={(v) => setRow(i, { presente: !!v })} /> Presente</label>
                  <Input className="flex-1" placeholder="Novedades" value={r.novedades} onChange={(e) => setRow(i, { novedades: e.target.value })} />
                  <Button variant="ghost" size="icon" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={() => setRows([...rows, { turnoId: post.turnos[0]?.id || "", personnelName: "", personnelId: "", presente: true, armaTipo: "", armaSerial: "", novedades: "" }])}>
            <Plus className="h-4 w-4 mr-1" /> Agregar fila
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Guardar reporte</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClientExpediente;
