import { useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ExportMenu from "@/components/ExportMenu";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin, inDeptAlias } from "@/lib/permissions";
import {
  loadCatalog, saveCatalog, stamp, nextCode, validateItem, formatPrice,
  PRICE_PENDING, STATUS_LABEL, CATEGORY_LABEL,
  type CatalogItem, type CatalogType, type CatalogStatus, type CatalogCategory,
} from "@/lib/serviceCatalog";
import {
  Home, Plus, Search, Package, Radio, ShieldCheck, Video, KeyRound, Sparkles, BellRing,
  UserRound, Pencil, Trash2, Power, Clock, Layers, Tag, CheckCircle2, AlertTriangle,
} from "lucide-react";

const CAT_ICON: Record<CatalogCategory, any> = {
  monitoreo: Radio, fisica: ShieldCheck, video: Video, acceso: KeyRound,
  especiales: Sparkles, alarmas: BellRing, personal: UserRound,
};

const statusClass: Record<CatalogStatus, string> = {
  activo: "bg-primary/15 text-primary border-primary/30",
  validacion: "bg-accent text-accent-foreground border-border",
  inactivo: "bg-muted text-muted-foreground border-border",
};

type Draft = Partial<CatalogItem> & { alcancesTxt?: string; funcTxt?: string; precioTxt?: string };

export default function ServiceCatalog() {
  const { user } = useAuth();
  const admin = isAdmin(user as any);
  const commercial = admin || inDeptAlias(user as any, "comercial");
  const userName = (user as any)?.name || (user as any)?.email || "Usuario";

  const [items, setItems] = useState<CatalogItem[]>(loadCatalog);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<"todos" | CatalogType>("todos");
  const [estado, setEstado] = useState<"todos" | CatalogStatus>("todos");
  const [precio, setPrecio] = useState<"todos" | "definido" | "pendiente">("todos");
  const [detail, setDetail] = useState<CatalogItem | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<CatalogItem | null>(null);
  const [reason, setReason] = useState("");

  const persist = (next: CatalogItem[]) => { setItems(next); saveCatalog(next); };
  const byId = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  const filtered = items.filter((i) =>
    (tipo === "todos" || i.tipo === tipo) &&
    (estado === "todos" || i.estado === estado) &&
    (precio === "todos" || (precio === "pendiente" ? i.precio == null : i.precio != null)) &&
    (!q || `${i.nombre} ${i.descripcion} ${i.codigo} ${i.alcances.join(" ")}`.toLowerCase().includes(q.toLowerCase())),
  );
  const paquetes = filtered.filter((i) => i.tipo === "paquete");
  const servicios = filtered.filter((i) => i.tipo === "servicio");
  const pending = items.filter((i) => i.precio == null).length;

  const openNew = (t: CatalogType) => setDraft({ tipo: t, categoria: t === "paquete" ? "alarmas" : "monitoreo", estado: "activo", serviciosIncluidos: [], alcancesTxt: "", funcTxt: "", precioTxt: "" });
  const openEdit = (i: CatalogItem) => { setDetail(null); setDraft({ ...i, alcancesTxt: i.alcances.join("\n"), funcTxt: i.funcionalidades.join("\n"), precioTxt: i.precio?.toString() ?? "" }); };

  const save = () => {
    if (!draft) return;
    const precioVal = draft.precioTxt?.trim() ? Number(draft.precioTxt) : null;
    const data: Partial<CatalogItem> = {
      ...draft,
      alcances: (draft.alcancesTxt || "").split("\n").map((s) => s.trim()).filter(Boolean),
      funcionalidades: (draft.funcTxt || "").split("\n").map((s) => s.trim()).filter(Boolean),
      precio: precioVal,
    };
    const err = validateItem(data);
    if (err) return toast({ title: "Revisa el formulario", description: err, variant: "destructive" });
    const { alcancesTxt, funcTxt, precioTxt, ...clean } = data as Draft;
    if (draft.id) {
      persist(items.map((i) => (i.id === draft.id ? { ...i, ...clean, modificado: stamp(userName) } as CatalogItem : i)));
      toast({ title: "Ítem actualizado" });
    } else {
      const it: CatalogItem = {
        cobertura: "", condiciones: "", serviciosIncluidos: [], ...(clean as any),
        id: `cat-${Date.now()}`, codigo: nextCode(items, draft.tipo!),
        creado: stamp(userName), modificado: stamp(userName),
      };
      persist([...items, it]);
      toast({ title: "Agregado al catálogo", description: it.nombre });
    }
    setDraft(null);
  };

  const toggle = (i: CatalogItem) => {
    persist(items.map((x) => x.id === i.id ? { ...x, estado: x.estado === "inactivo" ? "activo" : "inactivo", modificado: stamp(userName) } : x));
    setDetail(null);
  };

  const confirmDelete = () => {
    if (!toDelete || reason.trim().length < 5) return toast({ title: "Indica el motivo de la eliminación", variant: "destructive" });
    const log = JSON.parse(localStorage.getItem("safeone_service_catalog_deleted") || "[]");
    log.push({ item: toDelete, motivo: reason.trim(), ...stamp(userName) });
    localStorage.setItem("safeone_service_catalog_deleted", JSON.stringify(log));
    persist(items.filter((i) => i.id !== toDelete.id).map((i) => ({ ...i, serviciosIncluidos: i.serviciosIncluidos.filter((s) => s !== toDelete.id) })));
    setToDelete(null); setReason(""); setDetail(null);
    toast({ title: "Ítem eliminado", description: "Quedó registrado en auditoría." });
  };

  const exportData = items.map((i) => ({
    codigo: i.codigo, nombre: i.nombre, tipo: i.tipo === "paquete" ? "Paquete" : "Servicio unitario",
    estado: STATUS_LABEL[i.estado], cobertura: i.cobertura, precio: formatPrice(i.precio) ?? "Pendiente de definición",
    alcances: i.alcances.join(", "),
  }));

  const Card = ({ i }: { i: CatalogItem }) => {
    const Icon = CAT_ICON[i.categoria] || Tag;
    const pkg = i.tipo === "paquete";
    return (
      <button onClick={() => setDetail(i)}
        className={`group text-left relative overflow-hidden rounded-2xl border bg-card p-5 transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/50 ${i.estado === "inactivo" ? "opacity-60" : ""} ${pkg ? "md:col-span-2 lg:col-span-1" : ""}`}>
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 transition-transform group-hover:scale-150" />
        <div className="relative flex items-start justify-between gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${pkg ? "bg-foreground text-background" : "bg-primary/15 text-primary"}`}>
            <Icon className="h-6 w-6" />
          </div>
          <span className="font-mono text-[11px] tracking-widest text-muted-foreground">{i.codigo}</span>
        </div>
        <h3 className="relative mt-4 font-heading text-lg font-bold leading-tight">{i.nombre}</h3>
        <p className="relative mt-1 line-clamp-2 text-sm text-muted-foreground">{i.descripcion}</p>
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {(pkg ? i.serviciosIncluidos.map((id) => byId[id]?.nombre).filter(Boolean) : i.alcances).slice(0, 4).map((a) => (
            <span key={a} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{a}</span>
          ))}
        </div>
        <div className="relative mt-4 flex items-center justify-between border-t pt-3">
          <Badge variant="outline" className={statusClass[i.estado]}>{STATUS_LABEL[i.estado]}</Badge>
          {i.precio == null
            ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Precio pendiente</span>
            : <span className="font-heading font-bold text-primary">{formatPrice(i.precio)}</span>}
        </div>
      </button>
    );
  };

  return (
    <AppLayout>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6">
          <nav className="flex items-center gap-1 text-xs text-muted-foreground">
            <Home className="h-3 w-3" /> Inicio <span>/</span> Servicio al Cliente <span>/</span>
            <span className="font-medium text-foreground">Catálogo de Servicios</span>
          </nav>

          {/* Portada del catálogo */}
          <section className="relative overflow-hidden rounded-3xl bg-foreground p-8 text-background sm:p-10">
            <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border-[40px] border-primary/30" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">SafeOne · Centro de Monitoreo</p>
                <h1 className="mt-3 font-heading text-4xl font-black leading-none sm:text-5xl">Catálogo<br />de Servicios</h1>
                <p className="mt-4 max-w-xl text-sm opacity-75">Paquetes y servicios unitarios que ofrecemos a nuestros clientes. Consulta alcances, cobertura y condiciones antes de cotizar.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { n: items.filter((i) => i.tipo === "paquete").length, l: "Paquetes" },
                  { n: items.filter((i) => i.tipo === "servicio").length, l: "Servicios" },
                  { n: pending, l: "Precio pendiente" },
                ].map((k) => (
                  <div key={k.l} className="rounded-2xl border border-background/15 bg-background/5 px-4 py-3 text-center">
                    <div className="font-heading text-3xl font-black text-primary">{k.n}</div>
                    <div className="text-[11px] uppercase tracking-wider opacity-70">{k.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Barra de herramientas */}
          <div className="sticky top-0 z-10 -mx-2 flex flex-wrap items-center gap-2 rounded-2xl border bg-background/90 p-2 backdrop-blur">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar servicio, alcance o código…" className="border-0 pl-9 shadow-none focus-visible:ring-0" />
            </div>
            <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos los tipos</SelectItem><SelectItem value="paquete">Paquetes</SelectItem><SelectItem value="servicio">Servicios unitarios</SelectItem></SelectContent>
            </Select>
            <Select value={estado} onValueChange={(v: any) => setEstado(v)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos los estados</SelectItem>{(Object.keys(STATUS_LABEL) as CatalogStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={precio} onValueChange={(v: any) => setPrecio(v)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos los precios</SelectItem><SelectItem value="definido">Precio definido</SelectItem><SelectItem value="pendiente">Precio pendiente</SelectItem></SelectContent>
            </Select>
            <ExportMenu title="Catálogo de Servicios – Centro de Monitoreo" subtitle={`${items.length} ítems`} filename="catalogo-servicios"
              columns={[
                { header: "Código", key: "codigo" }, { header: "Nombre", key: "nombre", width: 30 }, { header: "Tipo", key: "tipo" },
                { header: "Estado", key: "estado" }, { header: "Cobertura", key: "cobertura" }, { header: "Precio", key: "precio" },
                { header: "Alcances", key: "alcances", width: 40 },
              ]} data={exportData} />
            {admin && (
              <>
                <Button variant="outline" size="sm" onClick={() => openNew("paquete")}><Layers className="mr-1.5 h-4 w-4" /> Nuevo paquete</Button>
                <Button size="sm" onClick={() => openNew("servicio")}><Plus className="mr-1.5 h-4 w-4" /> Agregar servicio</Button>
              </>
            )}
          </div>

          {paquetes.length > 0 && (
            <section className="space-y-4">
              <SectionTitle n="01" title="Paquetes" sub="Soluciones integrales que combinan varios servicios" />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{paquetes.map((i) => <Card key={i.id} i={i} />)}</div>
            </section>
          )}
          {servicios.length > 0 && (
            <section className="space-y-4">
              <SectionTitle n="02" title="Servicios unitarios" sub="Contratables por separado o como parte de un paquete" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{servicios.map((i) => <Card key={i.id} i={i} />)}</div>
            </section>
          )}
          {filtered.length === 0 && <p className="py-16 text-center text-muted-foreground">No hay ítems con esos filtros.</p>}
        </main>
      </div>

      {/* Ficha de detalle */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {detail && (() => {
            const Icon = CAT_ICON[detail.categoria] || Tag;
            return (
              <div className="space-y-6">
                <SheetHeader className="space-y-3 text-left">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Icon className="h-7 w-7" /></div>
                    <div>
                      <p className="font-mono text-xs tracking-widest text-muted-foreground">{detail.codigo} · {detail.tipo === "paquete" ? "PAQUETE" : "SERVICIO UNITARIO"}</p>
                      <SheetTitle className="font-heading text-2xl">{detail.nombre}</SheetTitle>
                    </div>
                  </div>
                  <SheetDescription>{detail.descripcion}</SheetDescription>
                  <div className="flex gap-2">
                    <Badge variant="outline" className={statusClass[detail.estado]}>{STATUS_LABEL[detail.estado]}</Badge>
                    <Badge variant="outline">{CATEGORY_LABEL[detail.categoria]}</Badge>
                  </div>
                </SheetHeader>

                {detail.nota && <div className="flex gap-2 rounded-xl border bg-accent p-3 text-sm text-accent-foreground"><AlertTriangle className="h-4 w-4 shrink-0" />{detail.nota}</div>}

                <div className="rounded-2xl bg-foreground p-5 text-background">
                  <p className="text-[11px] uppercase tracking-widest opacity-60">Precio</p>
                  <p className={`mt-1 font-heading ${detail.precio == null ? "text-sm" : "text-3xl font-black text-primary"}`}>{formatPrice(detail.precio) ?? PRICE_PENDING}</p>
                  {detail.condiciones && <p className="mt-2 text-xs opacity-75">{detail.condiciones}</p>}
                </div>

                {detail.tipo === "paquete" && detail.serviciosIncluidos.length > 0 && (
                  <Block title="Servicios incluidos">
                    <div className="space-y-2">{detail.serviciosIncluidos.map((id) => byId[id] && (
                      <button key={id} onClick={() => setDetail(byId[id])} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm hover:border-primary/50">
                        <Package className="h-4 w-4 text-primary" /> <span className="flex-1 font-medium">{byId[id].nombre}</span><span className="font-mono text-[11px] text-muted-foreground">{byId[id].codigo}</span>
                      </button>
                    ))}</div>
                  </Block>
                )}
                {detail.alcances.length > 0 && <Block title="Alcances"><List items={detail.alcances} /></Block>}
                {detail.funcionalidades.length > 0 && <Block title="Funcionalidades"><List items={detail.funcionalidades} /></Block>}
                {detail.cobertura && <Block title="Cobertura"><p className="text-sm">{detail.cobertura}</p></Block>}

                <div className="space-y-1 border-t pt-4 text-xs text-muted-foreground">
                  <p>Creado por {detail.creado.by} · {new Date(detail.creado.at).toLocaleString("es-DO")}</p>
                  <p>Última modificación: {detail.modificado.by} · {new Date(detail.modificado.at).toLocaleString("es-DO")}</p>
                </div>

                {commercial && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openEdit(detail)}><Pencil className="mr-1.5 h-4 w-4" /> {admin ? "Editar" : "Editar precio"}</Button>
                    {admin && <Button size="sm" variant="outline" onClick={() => toggle(detail)}><Power className="mr-1.5 h-4 w-4" /> {detail.estado === "inactivo" ? "Activar" : "Desactivar"}</Button>}
                    {admin && <Button size="sm" variant="outline" className="text-destructive" onClick={() => setToDelete(detail)}><Trash2 className="mr-1.5 h-4 w-4" /> Eliminar</Button>}
                  </div>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Alta / edición */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {draft && (
            <>
              <DialogHeader>
                <DialogTitle>{draft.id ? `Editar ${draft.nombre}` : draft.tipo === "paquete" ? "Nuevo paquete" : "Agregar servicio"}</DialogTitle>
                <DialogDescription>Los campos con * son obligatorios.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre *" className="sm:col-span-2"><Input disabled={!admin} value={draft.nombre || ""} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} placeholder="Ej. VideoPortero" /></Field>
                <Field label="Tipo *">
                  <Select disabled={!admin || !!draft.id} value={draft.tipo} onValueChange={(v: any) => setDraft({ ...draft, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="servicio">Servicio unitario</SelectItem><SelectItem value="paquete">Paquete</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Categoría">
                  <Select disabled={!admin} value={draft.categoria} onValueChange={(v: any) => setDraft({ ...draft, categoria: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(CATEGORY_LABEL) as CatalogCategory[]).map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Descripción *" className="sm:col-span-2"><Textarea disabled={!admin} rows={2} value={draft.descripcion || ""} onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })} /></Field>
                <Field label="Alcances (uno por línea)"><Textarea disabled={!admin} rows={3} value={draft.alcancesTxt} onChange={(e) => setDraft({ ...draft, alcancesTxt: e.target.value })} /></Field>
                <Field label="Funcionalidades (una por línea)"><Textarea disabled={!admin} rows={3} value={draft.funcTxt} onChange={(e) => setDraft({ ...draft, funcTxt: e.target.value })} /></Field>
                <Field label="Cobertura"><Input disabled={!admin} value={draft.cobertura || ""} onChange={(e) => setDraft({ ...draft, cobertura: e.target.value })} placeholder="24/7 · Nacional" /></Field>
                <Field label="Estado">
                  <Select disabled={!admin} value={draft.estado} onValueChange={(v: any) => setDraft({ ...draft, estado: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(STATUS_LABEL) as CatalogStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Precio (RD$) — vacío = pendiente"><Input type="number" min={0} disabled={!commercial} value={draft.precioTxt} onChange={(e) => setDraft({ ...draft, precioTxt: e.target.value })} placeholder="Pendiente de definición" /></Field>
                <Field label="Nota interna"><Input disabled={!admin} value={draft.nota || ""} onChange={(e) => setDraft({ ...draft, nota: e.target.value })} /></Field>
                <Field label="Condiciones comerciales" className="sm:col-span-2"><Textarea disabled={!commercial} rows={2} value={draft.condiciones || ""} onChange={(e) => setDraft({ ...draft, condiciones: e.target.value })} /></Field>
                {draft.tipo === "paquete" && (
                  <Field label="Servicios incluidos" className="sm:col-span-2">
                    <div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
                      {items.filter((i) => i.tipo === "servicio").map((s) => {
                        const on = draft.serviciosIncluidos?.includes(s.id);
                        return (
                          <label key={s.id} className="flex items-center gap-2 text-sm">
                            <Checkbox disabled={!admin} checked={on} onCheckedChange={() => setDraft({ ...draft, serviciosIncluidos: on ? draft.serviciosIncluidos!.filter((x) => x !== s.id) : [...(draft.serviciosIncluidos || []), s.id] })} />
                            {s.nombre}
                          </label>
                        );
                      })}
                    </div>
                  </Field>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
                <Button onClick={save}><CheckCircle2 className="mr-1.5 h-4 w-4" /> Guardar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Eliminación con justificación */}
      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar {toDelete?.nombre}</DialogTitle>
            <DialogDescription>Indica el motivo. Quedará registrado en la auditoría.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de la eliminación" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

const SectionTitle = ({ n, title, sub }: { n: string; title: string; sub: string }) => (
  <div className="flex items-end gap-4 border-b pb-3">
    <span className="font-heading text-4xl font-black text-primary/40">{n}</span>
    <div><h2 className="font-heading text-xl font-bold">{title}</h2><p className="text-sm text-muted-foreground">{sub}</p></div>
  </div>
);
const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>{children}</div>
);
const List = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5">{items.map((a) => <li key={a} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{a}</li>)}</ul>
);
const Field = ({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) => (
  <div className={`space-y-1.5 ${className || ""}`}><Label className="text-xs">{label}</Label>{children}</div>
);
