// Bóveda de Armas — extensión del Expediente de Clientes filtrada solo a
// armamento. Muestra armas registradas, cantidad en bóveda y en puesto,
// registra movimientos (entrega/devolución) atados a empleados activos de
// gSafeOne y presenta una bóveda animada con racks por tipo de arma.

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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  generalSqlApi, expedienteOverlayApi,
  type GeneralActiveEmployee, type GeneralExpediente, type GeneralWeapon, type ExpedienteOverlayMap,
} from "@/lib/api";
import { buildArmaRows } from "@/components/operations/ArmasGlobalView";
import {
  buildVaultState, countsByKind, validateMovement, KIND_LABEL,
  type VaultWeaponState,
} from "@/lib/vaultWeapons";
import VaultRoom from "@/components/vault/VaultRoom";
import { WeaponGlyph } from "@/components/vault/WeaponSvgs";
import {
  getVaultMovements, saveVaultMovement, deleteVaultMovement, getWeaponHistory,
  VAULT_LABEL, OPS_EVENT, type VaultMovement,
} from "@/lib/opsExpediente";
import { exportToExcel } from "@/lib/exportUtils";
import {
  Lock, ArrowLeft, ArrowRight, Plus, Trash2, History, Crosshair, Building2, RefreshCw,
  ShieldCheck, Warehouse, Download, AlertTriangle, Search, User,
} from "lucide-react";
import { Link } from "react-router-dom";

const WeaponVault = () => {
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exp, setExp] = useState<GeneralExpediente | null>(null);
  const [sqlWeapons, setSqlWeapons] = useState<GeneralWeapon[]>([]);
  const [overlay, setOverlay] = useState<ExpedienteOverlayMap>({});
  const [employees, setEmployees] = useState<GeneralActiveEmployee[]>([]);
  const [movements, setMovements] = useState<VaultMovement[]>(() => getVaultMovements());
  const [openForm, setOpenForm] = useState(false);
  const [detail, setDetail] = useState<VaultWeaponState | null>(null);
  const [historySerial, setHistorySerial] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todas" | "boveda" | "puesto">("todas");

  const refreshMovements = () => setMovements(getVaultMovements());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, w, ov, emp] = await Promise.all([
        generalSqlApi.expediente(),
        generalSqlApi.weapons(),
        expedienteOverlayApi.list().catch(() => ({} as ExpedienteOverlayMap)),
        generalSqlApi.employeesActive().catch(() => ({ count: 0, items: [] as GeneralActiveEmployee[] })),
      ]);
      setExp(e);
      setSqlWeapons(w);
      setOverlay(ov || {});
      setEmployees(emp.items || []);
    } catch (err) {
      setError((err as Error)?.message || "No se pudo cargar el inventario de armas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    const h = () => refreshMovements();
    window.addEventListener(OPS_EVENT, h);
    return () => window.removeEventListener(OPS_EVENT, h);
  }, []);

  const weapons = useMemo(() => {
    if (!exp) return [] as VaultWeaponState[];
    const { asignadas, boveda } = buildArmaRows(exp.clientes, sqlWeapons, overlay);
    return buildVaultState([...asignadas, ...boveda], movements);
  }, [exp, sqlWeapons, overlay, movements]);

  const counts = useMemo(() => countsByKind(weapons), [weapons]);
  const enBoveda = weapons.filter((w) => w.enBoveda).length;
  const enPuesto = weapons.length - enBoveda;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return weapons.filter((w) => {
      if (filter === "boveda" && !w.enBoveda) return false;
      if (filter === "puesto" && w.enBoveda) return false;
      if (!q) return true;
      return `${w.serial} ${w.tipo} ${w.marca} ${w.calibre} ${w.ubicacion} ${w.asignadoA}`.toLowerCase().includes(q);
    });
  }, [weapons, search, filter]);

  const exportar = () => {
    exportToExcel({
      title: "Bóveda de armas — SafeOne",
      columns: [
        { header: "Serial", key: "serial", width: 20 },
        { header: "Clase", key: "clase", width: 14 },
        { header: "Tipo", key: "tipo", width: 18 },
        { header: "Marca", key: "marca", width: 18 },
        { header: "Calibre", key: "calibre", width: 14 },
        { header: "No. Licencia", key: "licencia", width: 18 },
        { header: "Estatus", key: "estatus", width: 20 },
        { header: "Ubicación", key: "ubicacion", width: 36 },
        { header: "Asignado a", key: "asignadoA", width: 30 },
      ],
      data: weapons.map((w) => ({ ...w, clase: KIND_LABEL[w.kind] })) as unknown as Record<string, unknown>[],
      filename: "boveda_armas",
    });
    toast({ title: "Bóveda exportada" });
  };

  const registrar = (d: Partial<VaultMovement>) => {
    saveVaultMovement(d);
    refreshMovements();
    setOpenForm(false);
    toast({ title: "Movimiento registrado", description: `${d.armaSerial} · ${d.tipo === "salida" ? "Entrega" : "Devolución"}` });
  };

  return (
    <AppLayout>
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Link to="/" className="hover:text-primary inline-flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Operaciones
              </Link>
            </div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Lock className="h-6 w-6 text-primary" /> Bóveda de Armas
            </h1>
            <p className="text-sm text-muted-foreground">
              Inventario tomado del Expediente de Clientes (solo armamento): entregas y devoluciones atadas a empleados activos.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Recargar</Button>
            <Button variant="outline" size="sm" onClick={exportar}><Download className="h-4 w-4 mr-1" /> Exportar</Button>
            <Button size="sm" onClick={() => setOpenForm(true)} disabled={!weapons.length}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo movimiento
            </Button>
          </div>
        </div>

        {error && (
          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" /> Bóveda no disponible
            </div>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Reintentar</Button>
          </Card>
        )}

        {loading ? (
          <Card className="p-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" /> Cargando inventario de armas…
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button type="button" onClick={() => setFilter("todas")} className="text-left">
                <Card className={`p-4 transition ${filter === "todas" ? "ring-2 ring-primary" : "hover:bg-muted/40"}`}>
                  <div className="text-2xl font-bold flex items-center gap-2"><Crosshair className="h-5 w-5 text-primary" />{weapons.length}</div>
                  <div className="text-xs text-muted-foreground uppercase">Armas registradas</div>
                </Card>
              </button>
              <button type="button" onClick={() => setFilter("boveda")} className="text-left">
                <Card className={`p-4 transition ${filter === "boveda" ? "ring-2 ring-primary" : "hover:bg-muted/40"}`}>
                  <div className="text-2xl font-bold text-emerald-600 flex items-center gap-2"><Warehouse className="h-5 w-5" />{enBoveda}</div>
                  <div className="text-xs text-muted-foreground uppercase">En bóveda</div>
                </Card>
              </button>
              <button type="button" onClick={() => setFilter("puesto")} className="text-left">
                <Card className={`p-4 transition ${filter === "puesto" ? "ring-2 ring-primary" : "hover:bg-muted/40"}`}>
                  <div className="text-2xl font-bold text-amber-600 flex items-center gap-2"><ShieldCheck className="h-5 w-5" />{enPuesto}</div>
                  <div className="text-xs text-muted-foreground uppercase">En puesto</div>
                </Card>
              </button>
            </div>

            <Tabs defaultValue="boveda">
              <TabsList>
                <TabsTrigger value="boveda">Bóveda</TabsTrigger>
                <TabsTrigger value="inventario">Inventario</TabsTrigger>
                <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
              </TabsList>

              <TabsContent value="boveda" className="space-y-3">
                <VaultRoom weapons={filtered} counts={counts} onSelect={(w) => setDetail(w)} />
              </TabsContent>

              <TabsContent value="inventario" className="space-y-3">
                <div className="relative max-w-md">
                  <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Buscar por serial, tipo, marca o ubicación…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {filtered.length === 0 && (
                  <Card className="p-10 text-center text-sm text-muted-foreground">Sin armas para el filtro seleccionado.</Card>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filtered.map((w) => (
                    <Card key={w.serial} className="p-4 space-y-2 cursor-pointer hover:shadow-md transition" onClick={() => setDetail(w)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm flex items-center gap-1"><Crosshair className="h-3.5 w-3.5" /> {w.tipo}</div>
                          <div className="text-xs text-muted-foreground">Serial: {w.serial}</div>
                        </div>
                        <Badge className={w.enBoveda ? "bg-emerald-600" : "bg-amber-600"}>{w.enBoveda ? "En bóveda" : "En puesto"}</Badge>
                      </div>
                      <WeaponGlyph kind={w.kind} className="h-10 w-full" dim={!w.enBoveda} />
                      <div className="text-xs flex items-center gap-1"><Building2 className="h-3 w-3 text-muted-foreground" /> {w.ubicacion}</div>
                      {w.asignadoA && <div className="text-[11px] text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> {w.asignadoA}</div>}
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="movimientos" className="space-y-2">
                {movements.length === 0 && (
                  <Card className="p-10 text-center text-sm text-muted-foreground">Sin movimientos registrados.</Card>
                )}
                {movements.map((m) => (
                  <Card key={m.id} className="p-3 flex items-center gap-3 flex-wrap">
                    <Badge variant="outline" className={m.tipo === "salida" ? "text-amber-700 border-amber-300" : "text-emerald-700 border-emerald-300"}>
                      {m.tipo === "salida" ? "Entrega" : "Devolución"}
                    </Badge>
                    <div className="text-sm font-medium flex items-center gap-1"><Crosshair className="h-3.5 w-3.5" /> {m.armaTipo || "Arma"} · {m.armaSerial}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">{m.from} <ArrowRight className="h-3 w-3" /> {m.to}</div>
                    <div className="text-xs text-muted-foreground ml-auto flex items-center gap-2">
                      <span>{m.fecha}{m.hora ? ` ${m.hora}` : ""}</span>
                      <span>· {m.personnel || "—"}{m.empleadoCodigo ? ` (${m.empleadoCodigo})` : ""}</span>
                      {m.authorizedBy && <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> {m.authorizedBy}</span>}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm("¿Eliminar movimiento?")) { deleteVaultMovement(m.id); refreshMovements(); } }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                    {m.notas && <div className="text-xs text-muted-foreground w-full">Notas: {m.notas}</div>}
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {openForm && (
        <MovementDialog
          weapons={weapons}
          employees={employees}
          preselect={detail?.serial}
          createdBy={user?.fullName || "Operaciones"}
          onClose={() => setOpenForm(false)}
          onSave={registrar}
        />
      )}

      {detail && (
        <Dialog open onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Crosshair className="h-5 w-5" /> Arma {detail.serial}</DialogTitle></DialogHeader>
            <WeaponGlyph kind={detail.kind} className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Field label="Clase" value={KIND_LABEL[detail.kind]} />
              <Field label="Tipo" value={detail.tipo} />
              <Field label="Marca" value={detail.marca} />
              <Field label="Calibre" value={detail.calibre} />
              <Field label="No. Licencia" value={detail.licencia || "—"} />
              <Field label="Estatus" value={detail.estatus || "—"} />
              <Field label="Ubicación" value={detail.ubicacion} />
              <Field label="Asignado a" value={detail.asignadoA || "—"} />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setHistorySerial(detail.serial)}><History className="h-4 w-4 mr-1" /> Historial</Button>
              <Button onClick={() => setOpenForm(true)}><Plus className="h-4 w-4 mr-1" /> Registrar movimiento</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {historySerial && (
        <Dialog open onOpenChange={(o) => !o && setHistorySerial(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Historial · {historySerial}</DialogTitle></DialogHeader>
            <div className="space-y-2">
              {getWeaponHistory(historySerial).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin movimientos para esta arma.</p>
              )}
              {getWeaponHistory(historySerial).map((m) => (
                <div key={m.id} className="border rounded p-2 text-sm flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={m.tipo === "salida" ? "text-amber-700" : "text-emerald-700"}>
                    {m.tipo === "salida" ? "Entrega" : "Devolución"}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">{m.from} <ArrowRight className="h-3 w-3" /> {m.to}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{m.fecha} · {m.personnel || "—"}</span>
                  {m.authorizedBy && <span className="text-xs text-muted-foreground w-full">Autorizó: {m.authorizedBy}</span>}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Footer />
    </AppLayout>
  );
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}

function MovementDialog({ weapons, employees, preselect, createdBy, onClose, onSave }: {
  weapons: VaultWeaponState[];
  employees: GeneralActiveEmployee[];
  preselect?: string;
  createdBy: string;
  onClose: () => void;
  onSave: (d: Partial<VaultMovement>) => void;
}) {
  const [tipo, setTipo] = useState<"entrega" | "devolucion">("entrega");
  const [serial, setSerial] = useState(preselect || "");
  const [empleadoOid, setEmpleadoOid] = useState<string>("");
  const [destino, setDestino] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [notas, setNotas] = useState("");

  const arma = weapons.find((w) => w.serial === serial);
  const empleado = employees.find((e) => String(e.oid) === empleadoOid);
  const disponibles = weapons.filter((w) => (tipo === "entrega" ? w.enBoveda : !w.enBoveda));
  const err = validateMovement(arma, tipo, empleado?.nombreCompleto || "");

  const guardar = () => {
    if (err || !arma || !empleado) return;
    const to = tipo === "entrega" ? (destino || `Puesto · ${empleado.nombreCompleto}`) : VAULT_LABEL;
    const from = tipo === "entrega" ? VAULT_LABEL : (arma.ubicacion || "Puesto");
    onSave({
      tipo: tipo === "entrega" ? "salida" : "entrada",
      fecha,
      armaSerial: arma.serial,
      armaTipo: arma.tipo,
      from, to,
      personnel: empleado.nombreCompleto,
      empleadoCodigo: empleado.codigo || "",
      empleadoOid: empleado.oid,
      authorizedBy,
      notas,
      createdBy,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nuevo movimiento de bóveda</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tipo de movimiento</Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v as "entrega" | "devolucion"); setSerial(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrega">Entrega (sale de bóveda)</SelectItem>
                  <SelectItem value="devolucion">Devolución (regresa a bóveda)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          </div>

          <div>
            <Label className="text-xs">Arma ({disponibles.length} disponibles)</Label>
            <Select value={serial} onValueChange={setSerial}>
              <SelectTrigger><SelectValue placeholder="Selecciona un arma" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {disponibles.map((w) => (
                  <SelectItem key={w.serial} value={w.serial}>
                    {w.serial} · {KIND_LABEL[w.kind]} · {w.marca}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Empleado activo</Label>
            <Select value={empleadoOid} onValueChange={setEmpleadoOid}>
              <SelectTrigger><SelectValue placeholder={employees.length ? "Selecciona el empleado" : "Sin empleados activos disponibles"} /></SelectTrigger>
              <SelectContent className="max-h-64">
                {employees.map((e) => (
                  <SelectItem key={e.oid} value={String(e.oid)}>
                    {e.nombreCompleto}{e.codigo ? ` · ${e.codigo}` : ""}{e.puesto ? ` · ${e.puesto}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipo === "entrega" && (
            <div><Label className="text-xs">Destino / puesto</Label><Input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Cliente · puesto de servicio" /></div>
          )}

          <div><Label className="text-xs">Autorizado por</Label><Input value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} /></div>
          <div><Label className="text-xs">Observaciones</Label><Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} /></div>

          {err && serial && (
            <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {err}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={!!err}>Guardar movimiento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WeaponVault;
