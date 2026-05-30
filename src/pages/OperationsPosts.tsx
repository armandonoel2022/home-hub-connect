import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  loadPosts, createPost, updatePost, deletePost,
  addGuard, removeGuard, addWeapon, removeWeapon, recordHandover,
  addWeaponPhoto, removeWeaponPhoto, setWeaponGuards,
  type WorkPost, type Shift, type PostWeaponAssignment, type PostGuardAssignment,
} from "@/lib/postsData";
import {
  MapPin, Shield, Users, Plus, Trash2, ArrowLeft, RefreshCw, ExternalLink,
  Building2, UserCheck, Crosshair, History, Image as ImageIcon, X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { employeesApi, isApiConfigured, type Employee } from "@/lib/api";

const SHIFTS: Shift[] = ["Diurno", "Nocturno", "24h", "Rotativo"];

type Person = { id: string; fullName: string; position?: string };

const OperationsPosts = () => {
  const { toast } = useToast();
  const [posts, setPosts] = useState<WorkPost[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = () => setPosts(loadPosts());
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    // Carga el directorio de RR.HH. con respaldo al seed público si la API no responde.
    const loadFromSeed = async () => {
      try {
        const res = await fetch("/data/employees_seed.json");
        if (res.ok) setEmployees(await res.json());
      } catch { /* noop */ }
    };
    (async () => {
      if (!isApiConfigured()) { await loadFromSeed(); return; }
      try {
        const data = await employeesApi.getAll({ status: "Activo" });
        if (data && data.length > 0) setEmployees(data);
        else await loadFromSeed();
      } catch {
        await loadFromSeed();
      }
    })();
  }, []);

  // Supervisores reales = empleados activos con categoría/puesto de Supervisor (19 en RR.HH.)
  const supervisores = useMemo<Person[]>(
    () => employees
      .filter((e) => /supervisor/i.test(e.category || "") || /supervisor/i.test(e.position || ""))
      .map((e) => ({ id: e.employeeCode, fullName: e.fullName, position: e.position }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [employees]
  );

  // Gerentes de Operaciones (ej. Remit Lopez) → cabecera de la jerarquía
  const gerentes = useMemo<Person[]>(
    () => employees
      .filter((e) => /gerente de operaciones/i.test(e.position || ""))
      .map((e) => ({ id: e.employeeCode, fullName: e.fullName, position: e.position })),
    [employees]
  );

  // Vigilantes / oficiales de seguridad para asignar a los puestos
  const vigilantes = useMemo<Person[]>(
    () => employees
      .filter((e) => /vigilante|oficial|operador/i.test(e.category || "") || /vigilante|oficial/i.test(e.position || ""))
      .map((e) => ({ id: e.employeeCode, fullName: e.fullName, position: e.position }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [employees]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return posts;
    return posts.filter((p) =>
      `${p.cliente} ${p.nombre} ${p.provincia} ${p.supervisorName || ""}`.toLowerCase().includes(q)
    );
  }, [posts, search]);

  const selected = posts.find((p) => p.id === selectedId) || null;

  // ── jerarquía Gerencia → Supervisor → Puestos
  const grouped = useMemo(() => {
    const map = new Map<string, { gerente: string; supervisores: Map<string, WorkPost[]> }>();
    filtered.forEach((p) => {
      const ger = p.gerenteOperaciones || "Gerencia de Operaciones";
      if (!map.has(ger)) map.set(ger, { gerente: ger, supervisores: new Map() });
      const sup = p.supervisorName || "Sin supervisor asignado";
      const sm = map.get(ger)!.supervisores;
      if (!sm.has(sup)) sm.set(sup, []);
      sm.get(sup)!.push(p);
    });
    return map;
  }, [filtered]);

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
              <Building2 className="h-6 w-6 text-primary" /> Puestos de Trabajo
            </h1>
            <p className="text-sm text-muted-foreground">
              Vigilantes, supervisores y armas asociados a cada puesto operativo.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-1" /> Recargar
            </Button>
            <Button size="sm" onClick={() => setOpenCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo puesto
            </Button>
          </div>
        </div>

        <Tabs defaultValue="lista" className="w-full">
          <TabsList>
            <TabsTrigger value="lista">Lista de puestos</TabsTrigger>
            <TabsTrigger value="jerarquia">Jerarquía Operaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4">
            <Input
              placeholder="Buscar por cliente, puesto, provincia, supervisor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((p) => (
                <Card
                  key={p.id}
                  className="p-4 cursor-pointer hover:border-primary transition"
                  onClick={() => setSelectedId(p.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">{p.nombre}</div>
                      <div className="text-xs text-muted-foreground">{p.cliente}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{p.provincia || "—"}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold">{p.guards.length}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Vigilantes</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{p.weapons.length}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Armas</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{p.handovers.length}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Entregas</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> Supervisor: {p.supervisorName || "—"}
                  </div>
                </Card>
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-12 col-span-full">
                  No hay puestos. Crea uno o recarga desde la matriz de levantamiento.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="jerarquia" className="space-y-4">
            {[...grouped.values()].map((g) => (
              <Card key={g.gerente} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{g.gerente}</span>
                </div>
                <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                  {[...g.supervisores.entries()].map(([sup, ps]) => (
                    <div key={sup}>
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="h-4 w-4 text-emerald-600" />
                        <span className="font-medium text-sm">{sup}</span>
                        <Badge variant="outline" className="text-[10px]">{ps.length} puesto(s)</Badge>
                      </div>
                      <div className="pl-6 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {ps.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedId(p.id)}
                            className="text-left p-2 rounded border hover:border-primary transition"
                          >
                            <div className="text-sm font-medium">{p.nombre}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.cliente} · {p.guards.length} vig. · {p.weapons.length} arma(s)
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {selected && (
        <PostDetailDialog
          post={selected}
          supervisores={supervisores}
          gerentes={gerentes}
          vigilantes={vigilantes}
          onClose={() => { setSelectedId(null); refresh(); }}
          onChanged={refresh}
        />
      )}

      {openCreate && (
        <CreatePostDialog
          onClose={() => setOpenCreate(false)}
          onCreate={(input) => {
            createPost(input);
            toast({ title: "Puesto creado" });
            setOpenCreate(false);
            refresh();
          }}
        />
      )}

      <Footer />
    </AppLayout>
  );
};

// ─── Detail Dialog ───

function PostDetailDialog({
  post, supervisores, gerentes, vigilantes, onClose, onChanged,
}: {
  post: WorkPost;
  supervisores: Person[];
  gerentes: Person[];
  vigilantes: Person[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const uploaderName = user?.fullName || "Operaciones";
  const [supervisorId, setSupervisorId] = useState(post.supervisorId || "");
  // Gerente de Operaciones por defecto = el vigente en RR.HH. (ej. Remit Andrés López, 3895)
  const defaultGerente = gerentes[0]?.fullName || "";
  const [gerente, setGerente] = useState(post.gerenteOperaciones || defaultGerente);
  // Si no había gerente guardado y RR.HH. ya cargó, adopta el gerente vigente
  useEffect(() => {
    if (!post.gerenteOperaciones && defaultGerente && !gerente) setGerente(defaultGerente);
  }, [defaultGerente]); // eslint-disable-line react-hooks/exhaustive-deps
  const [newGuard, setNewGuard] = useState({ guardName: "", shift: "Diurno" as Shift, isLead: false });
  const [newWeapon, setNewWeapon] = useState({ arma: "Escopeta", marca: "", serial: "", capsulas: 0, estatus: "En buenas condiciones" });
  const [handover, setHandover] = useState({ weaponId: "", fromGuard: "", toGuard: "", shift: "Diurno" as Shift, notes: "" });

  const saveHeader = () => {
    const sup = supervisores.find((s) => s.id === supervisorId);
    updatePost(post.id, {
      supervisorId,
      supervisorName: sup?.fullName,
      gerenteOperaciones: gerente,
    });
    toast({ title: "Puesto actualizado" });
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> {post.nombre}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{post.cliente} · {post.provincia}</p>
        </DialogHeader>

        <div className="space-y-5">
          {/* Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 border rounded-lg bg-muted/30">
            <div>
              <Label className="text-xs">Supervisor responsable</Label>
              <Select value={supervisorId} onValueChange={setSupervisorId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar supervisor" /></SelectTrigger>
                <SelectContent>
                  {supervisores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.fullName}{s.position ? ` — ${s.position}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Gerente de Operaciones</Label>
              {gerentes.length > 0 ? (
                <Select value={gerente} onValueChange={setGerente}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar gerente" /></SelectTrigger>
                  <SelectContent>
                    {gerentes.map((g) => (
                      <SelectItem key={g.id} value={g.fullName}>{g.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={gerente} onChange={(e) => setGerente(e.target.value)} placeholder="Nombre del gerente" />
              )}
            </div>
            <div className="flex items-end">
              <Button size="sm" className="w-full" onClick={saveHeader}>Guardar cabecera</Button>
            </div>
            {post.coordenada && (
              <div className="md:col-span-3">
                <a
                  href={post.coordenada}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  <MapPin className="h-3 w-3" /> Abrir en Google Maps <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          {/* Guards */}
          <section>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" /> Vigilantes asignados ({post.guards.length})
            </h3>
            <div className="space-y-2">
              {post.guards.map((g) => (
                <div key={g.id} className="flex items-center gap-2 p-2 border rounded">
                  <span className="flex-1 text-sm">{g.guardName}</span>
                  <Badge variant="outline" className="text-[10px]">{g.shift}</Badge>
                  {g.isLead && <Badge className="text-[10px]">Jefe</Badge>}
                  <Button variant="ghost" size="icon" onClick={() => { removeGuard(post.id, g.id); onChanged(); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input
                list={`vigilantes-${post.id}`}
                placeholder="Vigilante / oficial (buscar)"
                value={newGuard.guardName}
                onChange={(e) => setNewGuard({ ...newGuard, guardName: e.target.value })}
              />
              <datalist id={`vigilantes-${post.id}`}>
                {vigilantes.map((v) => (
                  <option key={v.id} value={v.fullName} />
                ))}
              </datalist>
              <Select value={newGuard.shift} onValueChange={(v) => setNewGuard({ ...newGuard, shift: v as Shift })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={newGuard.isLead} onChange={(e) => setNewGuard({ ...newGuard, isLead: e.target.checked })} />
                Jefe de puesto
              </label>
              <Button
                size="sm"
                disabled={!newGuard.guardName.trim()}
                onClick={() => {
                  addGuard(post.id, newGuard);
                  setNewGuard({ guardName: "", shift: "Diurno", isLead: false });
                  onChanged();
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Asignar
              </Button>
            </div>
          </section>

          {/* Weapons */}
          <section>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Crosshair className="h-4 w-4" /> Armas en custodia del puesto ({post.weapons.length})
            </h3>
            <div className="space-y-2">
              {post.weapons.map((w) => (
                <WeaponCard
                  key={w.id}
                  postId={post.id}
                  weapon={w}
                  guards={post.guards}
                  uploadedBy={uploaderName}
                  onChanged={onChanged}
                />
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-6 gap-2">
              <Select value={newWeapon.arma} onValueChange={(v) => setNewWeapon({ ...newWeapon, arma: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Escopeta", "Pistola", "Revolver", "Otra"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Marca" value={newWeapon.marca} onChange={(e) => setNewWeapon({ ...newWeapon, marca: e.target.value })} />
              <Input placeholder="Serial" value={newWeapon.serial} onChange={(e) => setNewWeapon({ ...newWeapon, serial: e.target.value })} />
              <Input type="number" placeholder="Cápsulas" value={newWeapon.capsulas}
                onChange={(e) => setNewWeapon({ ...newWeapon, capsulas: Number(e.target.value) })} />
              <Input placeholder="Estatus" value={newWeapon.estatus} onChange={(e) => setNewWeapon({ ...newWeapon, estatus: e.target.value })} />
              <Button
                size="sm"
                disabled={!newWeapon.serial.trim()}
                onClick={() => {
                  addWeapon(post.id, newWeapon);
                  setNewWeapon({ arma: "Escopeta", marca: "", serial: "", capsulas: 0, estatus: "En buenas condiciones" });
                  onChanged();
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Agregar
              </Button>
            </div>
          </section>

          {/* Handovers */}
          <section>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <History className="h-4 w-4" /> Entrega de arma entre turnos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3">
              <Select value={handover.weaponId} onValueChange={(v) => setHandover({ ...handover, weaponId: v })}>
                <SelectTrigger><SelectValue placeholder="Arma" /></SelectTrigger>
                <SelectContent>
                  {post.weapons.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.arma} · {w.serial}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Entrega" value={handover.fromGuard} onChange={(e) => setHandover({ ...handover, fromGuard: e.target.value })} />
              <Input placeholder="Recibe" value={handover.toGuard} onChange={(e) => setHandover({ ...handover, toGuard: e.target.value })} />
              <Select value={handover.shift} onValueChange={(v) => setHandover({ ...handover, shift: v as Shift })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Notas" value={handover.notes} onChange={(e) => setHandover({ ...handover, notes: e.target.value })} />
              <Button
                size="sm"
                disabled={!handover.weaponId || !handover.fromGuard || !handover.toGuard}
                onClick={() => {
                  recordHandover(post.id, handover);
                  setHandover({ weaponId: "", fromGuard: "", toGuard: "", shift: "Diurno", notes: "" });
                  onChanged();
                  toast({ title: "Entrega registrada" });
                }}
              >
                Registrar
              </Button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {post.handovers.map((h) => {
                const w = post.weapons.find((x) => x.id === h.weaponId);
                return (
                  <div key={h.id} className="text-xs p-2 border rounded">
                    <span className="font-mono">{w?.serial || h.weaponId}</span>{" — "}
                    <strong>{h.fromGuard}</strong> → <strong>{h.toGuard}</strong>{" "}
                    <Badge variant="outline" className="text-[10px]">{h.shift}</Badge>{" "}
                    <span className="text-muted-foreground">
                      {new Date(h.at).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    {h.notes && <div className="text-muted-foreground mt-0.5">{h.notes}</div>}
                  </div>
                );
              })}
              {post.handovers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">Sin entregas registradas.</p>
              )}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(`¿Eliminar el puesto "${post.nombre}"?`)) {
                deletePost(post.id);
                onClose();
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Eliminar puesto
          </Button>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tarjeta de arma: fotos múltiples + agentes asignados ───
function WeaponCard({
  postId, weapon, guards, uploadedBy, onChanged,
}: {
  postId: string;
  weapon: PostWeaponAssignment;
  guards: PostGuardAssignment[];
  uploadedBy: string;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const photos = weapon.photos || [];
  const assigned = weapon.assignedGuardIds || [];

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        if (url) {
          addWeaponPhoto(postId, weapon.id, url, uploadedBy);
          onChanged();
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const toggleGuard = (guardId: string) => {
    const next = assigned.includes(guardId)
      ? assigned.filter((id) => id !== guardId)
      : [...assigned, guardId];
    setWeaponGuards(postId, weapon.id, next);
    onChanged();
  };

  return (
    <div className="p-3 border rounded space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex-1">
          {weapon.arma} · {weapon.marca} · <span className="font-mono">{weapon.serial}</span>
        </span>
        <Badge variant="outline" className="text-[10px]">{weapon.capsulas ?? "?"} cáps.</Badge>
        <Badge variant="outline" className="text-[10px]">{weapon.estatus || "—"}</Badge>
        <Button variant="ghost" size="icon" onClick={() => { removeWeapon(postId, weapon.id); onChanged(); }}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Agentes que custodian el arma */}
      <div>
        <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
          <UserCheck className="h-3 w-3" /> Agentes asignados a esta arma
        </Label>
        {guards.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Agrega vigilantes al puesto para asignarlos.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {guards.map((g) => {
              const active = assigned.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGuard(g.id)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                    active ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 hover:bg-muted"
                  }`}
                >
                  {g.guardName}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Galería de fotos del arma */}
      <div>
        <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
          <ImageIcon className="h-3 w-3" /> Fotos del arma ({photos.length})
        </Label>
        <div className="flex flex-wrap gap-2">
          {photos.map((ph) => (
            <div key={ph.id} className="relative group">
              <a href={ph.url} target="_blank" rel="noopener noreferrer">
                <img src={ph.url} alt="Arma" className="w-16 h-16 object-cover rounded border" />
              </a>
              <button
                type="button"
                onClick={() => { removeWeaponPhoto(postId, weapon.id, ph.id); onChanged(); }}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <label className="w-16 h-16 flex items-center justify-center rounded border border-dashed cursor-pointer hover:bg-muted/50">
            <Plus className="h-5 w-5 text-muted-foreground" />
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); toast({ title: "Foto(s) agregada(s)" }); e.target.value = ""; }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}



function CreatePostDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (i: Partial<WorkPost>) => void }) {
  const [form, setForm] = useState({ cliente: "", nombre: "", provincia: "", coordenada: "" });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo puesto</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Cliente</Label><Input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></div>
          <div><Label>Nombre del puesto</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
          <div><Label>Provincia</Label><Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} /></div>
          <div><Label>Link Google Maps</Label><Input value={form.coordenada} onChange={(e) => setForm({ ...form, coordenada: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!form.cliente.trim() || !form.nombre.trim()} onClick={() => onCreate(form)}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OperationsPosts;
