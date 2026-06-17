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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useArmedPersonnel } from "@/hooks/useApiHooks";
import {
  getPosts, getVaultMovements, saveVaultMovement, deleteVaultMovement,
  getWeaponLocations, getWeaponHistory, VAULT_LABEL, OPS_EVENT,
  type VaultMovement, type VaultMovementType,
} from "@/lib/opsExpediente";
import {
  Lock, ArrowLeft, ArrowRight, Plus, Trash2, History, Crosshair, Building2, RefreshCw, ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

const WeaponVault = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: personnel } = useArmedPersonnel();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const [openForm, setOpenForm] = useState(false);
  const [historySerial, setHistorySerial] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const h = () => refresh();
    window.addEventListener(OPS_EVENT, h);
    return () => window.removeEventListener(OPS_EVENT, h);
  }, []);

  const posts = useMemo(() => getPosts(), [tick]);
  const locations = useMemo(() => getWeaponLocations(), [tick]);
  const movements = useMemo(() => getVaultMovements(), [tick]);

  const filteredLocations = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return locations;
    return locations.filter((l) => `${l.armaSerial} ${l.armaTipo} ${l.ubicacion}`.toLowerCase().includes(q));
  }, [locations, search]);

  const enBoveda = locations.filter((l) => l.enBoveda).length;
  const enPuesto = locations.length - enBoveda;

  // Seriales conocidos desde personal para autocompletar
  const knownWeapons = useMemo(
    () => (personnel || [])
      .filter((p) => p.weaponSerial)
      .map((p) => ({ serial: p.weaponSerial as string, tipo: p.weaponType || "" })),
    [personnel],
  );

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
              <Lock className="h-6 w-6 text-primary" /> Bóveda de Armas
            </h1>
            <p className="text-sm text-muted-foreground">
              Registro de salida y entrada de armas del almacén: quién, cuándo, dónde y cuál (FROM → TO).
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4 mr-1" /> Recargar</Button>
            <Button size="sm" onClick={() => setOpenForm(true)}><Plus className="h-4 w-4 mr-1" /> Nuevo movimiento</Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4"><div className="text-2xl font-bold">{locations.length}</div><div className="text-xs text-muted-foreground uppercase">Armas registradas</div></Card>
          <Card className="p-4"><div className="text-2xl font-bold text-emerald-600">{enBoveda}</div><div className="text-xs text-muted-foreground uppercase">En bóveda</div></Card>
          <Card className="p-4"><div className="text-2xl font-bold text-amber-600">{enPuesto}</div><div className="text-xs text-muted-foreground uppercase">En puesto</div></Card>
        </div>

        <Tabs defaultValue="estado">
          <TabsList>
            <TabsTrigger value="estado">Estado actual</TabsTrigger>
            <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          </TabsList>

          <TabsContent value="estado" className="space-y-3">
            <Input placeholder="Buscar por serial, tipo o ubicación…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
            {filteredLocations.length === 0 && (
              <Card className="p-10 text-center text-sm text-muted-foreground">Aún no hay movimientos de armas registrados.</Card>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredLocations.map((l) => (
                <Card key={l.armaSerial} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm flex items-center gap-1"><Crosshair className="h-3.5 w-3.5" /> {l.armaTipo || "Arma"}</div>
                      <div className="text-xs text-muted-foreground">Serial: {l.armaSerial}</div>
                    </div>
                    <Badge className={l.enBoveda ? "bg-emerald-600" : "bg-amber-600"}>{l.enBoveda ? "En bóveda" : "En puesto"}</Badge>
                  </div>
                  <div className="text-xs flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-muted-foreground" /> {l.ubicacion}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Último: {l.lastMovement.fecha} · {l.lastMovement.personnel || "—"}
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setHistorySerial(l.armaSerial)}>
                    <History className="h-3.5 w-3.5 mr-1" /> Historial
                  </Button>
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
                  {m.tipo === "salida" ? "Salida" : "Entrada"}
                </Badge>
                <div className="text-sm font-medium flex items-center gap-1"><Crosshair className="h-3.5 w-3.5" /> {m.armaTipo || "Arma"} · {m.armaSerial}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  {m.from} <ArrowRight className="h-3 w-3" /> {m.to}
                </div>
                <div className="text-xs text-muted-foreground ml-auto flex items-center gap-2">
                  <span>{m.fecha}</span>
                  <span>· {m.personnel || "—"}</span>
                  {m.authorizedBy && <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> {m.authorizedBy}</span>}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm("¿Eliminar movimiento?")) { deleteVaultMovement(m.id); refresh(); } }}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                {m.notas && <div className="text-xs text-muted-foreground w-full">Notas: {m.notas}</div>}
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {openForm && (
        <MovementDialog
          posts={posts.map((p) => p.nombre)}
          knownWeapons={knownWeapons}
          personnel={(personnel || []).map((p) => p.name || p.employeeCode).filter(Boolean) as string[]}
          createdBy={user?.fullName || "Operaciones"}
          onClose={() => setOpenForm(false)}
          onSave={(d) => { saveVaultMovement(d); toast({ title: "Movimiento registrado" }); setOpenForm(false); refresh(); }}
        />
      )}

      {historySerial && (
        <Dialog open onOpenChange={(o) => !o && setHistorySerial(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Historial · {historySerial}</DialogTitle></DialogHeader>
            <div className="space-y-2">
              {getWeaponHistory(historySerial).map((m) => (
                <div key={m.id} className="border rounded p-2 text-sm flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={m.tipo === "salida" ? "text-amber-700" : "text-emerald-700"}>{m.tipo}</Badge>
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

function MovementDialog({ posts, knownWeapons, personnel, createdBy, onClose, onSave }: {
  posts: string[];
  knownWeapons: { serial: string; tipo: string }[];
  personnel: string[];
  createdBy: string;
  onClose: () => void;
  onSave: (d: Partial<VaultMovement>) => void;
}) {
  const [tipo, setTipo] = useState<VaultMovementType>("salida");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [armaSerial, setArmaSerial] = useState("");
  const [armaTipo, setArmaTipo] = useState("");
  const [destino, setDestino] = useState("");
  const [persona, setPersona] = useState("");
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [notas, setNotas] = useState("");

  const onSerial = (s: string) => {
    setArmaSerial(s);
    const m = knownWeapons.find((w) => w.serial === s);
    if (m && !armaTipo) setArmaTipo(m.tipo);
  };

  // salida: from = Bóveda, to = puesto destino. entrada: from = puesto, to = Bóveda.
  const from = tipo === "salida" ? VAULT_LABEL : destino;
  const to = tipo === "salida" ? destino : VAULT_LABEL;

  const save = () => {
    onSave({ tipo, fecha, armaSerial, armaTipo, from, to, personnel: persona, authorizedBy, notas, createdBy });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuevo movimiento de bóveda</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value as VaultMovementType)}>
                <option value="salida">Salida (sale de bóveda)</option>
                <option value="entrada">Entrada (regresa a bóveda)</option>
              </select>
            </div>
            <div><Label className="text-xs">Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Serial del arma</Label>
              <Input list="vault-serials" value={armaSerial} onChange={(e) => onSerial(e.target.value)} />
              <datalist id="vault-serials">{knownWeapons.map((w) => <option key={w.serial} value={w.serial} />)}</datalist>
            </div>
            <div><Label className="text-xs">Tipo de arma</Label><Input value={armaTipo} onChange={(e) => setArmaTipo(e.target.value)} /></div>
          </div>

          <div>
            <Label className="text-xs">{tipo === "salida" ? "Destino (puesto)" : "Origen (puesto)"}</Label>
            <Input list="vault-posts" value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Nombre del puesto" />
            <datalist id="vault-posts">{posts.map((p) => <option key={p} value={p} />)}</datalist>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1.5 flex items-center gap-1">
            {from} <ArrowRight className="h-3 w-3" /> {to || "—"}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Quién recibe / entrega</Label>
              <Input list="vault-personnel" value={persona} onChange={(e) => setPersona(e.target.value)} />
              <datalist id="vault-personnel">{personnel.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <div><Label className="text-xs">Autorizado por</Label><Input value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} /></div>
          </div>

          <div><Label className="text-xs">Notas</Label><Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!armaSerial.trim() || !destino.trim()} onClick={save}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WeaponVault;
