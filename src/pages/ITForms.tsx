import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import ITFormHeader from "@/components/ITFormHeader";
import { useAuth } from "@/contexts/AuthContext";
import { itFormsApi, isApiConfigured } from "@/lib/api";
import { IT_FORMS, formatValue, type ITField, type ITFormDef } from "@/lib/itForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserPlus, UserMinus, KeyRound, MonitorCog, Send, Printer, ClipboardCheck } from "lucide-react";

const ICONS: Record<string, any> = { "F-IT-01": UserPlus, "F-IT-02": UserMinus, "F-IT-03": KeyRound, "F-IT-04": MonitorCog };
type Values = Record<string, string | string[]>;

function FieldInput({ f, value, onChange }: { f: ITField; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  const id = `f-${f.key}`;
  return (
    <div className={f.kind === "textarea" || f.kind === "checks" || f.kind === "radio" ? "sm:col-span-2" : ""}>
      <Label htmlFor={id}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
      {f.kind === "textarea" ? <Textarea id={id} value={(value as string) || ""} onChange={e => onChange(e.target.value)} maxLength={2000} />
        : f.kind === "radio" || f.kind === "checks" ? (
          <div className="flex flex-wrap gap-2 mt-1">
            {f.options!.map(o => {
              const sel = f.kind === "checks" ? ((value as string[]) || []).includes(o) : value === o;
              return <button type="button" key={o} onClick={() => {
                if (f.kind === "checks") { const arr = (value as string[]) || []; onChange(sel ? arr.filter(x => x !== o) : [...arr, o]); }
                else onChange(o);
              }} className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${sel ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:border-primary/50"}`}>{o}</button>;
            })}
          </div>
        ) : <Input id={id} type={f.kind === "date" ? "date" : f.kind === "email" ? "email" : "text"} placeholder={f.placeholder} value={(value as string) || ""} onChange={e => onChange(e.target.value)} maxLength={300} />}
    </div>
  );
}

const toFields = (defs: ITField[], v: Values) => defs.map(f => ({ label: f.label, value: formatValue(v[f.key]) }));

export default function ITForms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [active, setActive] = useState<ITFormDef | null>(null);
  const [values, setValues] = useState<Values>({});
  const [list, setList] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [tiFor, setTiFor] = useState<any | null>(null);
  const [tiValues, setTiValues] = useState<Values>({});
  const isIT = !!user?.isAdmin || /tecnolog/i.test(user?.department || "") || ["tecnologia@safeone.com.do", "anoel@safeone.com.do"].includes((user?.email || "").toLowerCase());

  const reload = () => { if (isApiConfigured()) itFormsApi.list().then(setList).catch(() => {}); };
  useEffect(reload, []);

  const open = (def: ITFormDef) => {
    const today = new Date().toISOString().slice(0, 10);
    setValues({ fecha: today, solNombre: user?.fullName || "", solDepto: user?.department || "", solEmail: user?.email || "", tecnico: def.codigo === "F-IT-04" ? user?.fullName || "" : "" });
    setActive(def);
  };

  const submit = async () => {
    if (!active) return;
    const missing = active.sections.flatMap(s => s.fields).filter(f => f.required && !formatValue(values[f.key]).trim());
    if (missing.length) { toast({ title: "Faltan campos obligatorios", description: missing.map(m => m.label).join(", "), variant: "destructive" }); return; }
    if (!isApiConfigured()) { toast({ title: "Servidor no disponible", description: "Este formulario se guarda en el servidor de la intranet.", variant: "destructive" }); return; }
    setSending(true);
    try {
      const r = await itFormsApi.create({
        codigo: active.codigo,
        resumen: [formatValue(values[active.resumenKey]), formatValue(values.apellidos)].filter(Boolean).join(" "),
        sections: active.sections.map(s => ({ title: s.title, fields: toFields(s.fields, values) })),
      });
      toast({ title: `Formulario ${r.id} registrado${r.ticketId ? ` · Ticket ${r.ticketId}` : ""}`, description: r._mail?.sent === false ? `Guardado, pero el correo no se envió: ${r._mail.reason}` : "Se envió a Tecnología desde ticketsit@safeone.com.do." });
      setActive(null); reload();
    } catch (e: any) { toast({ title: "No se pudo enviar", description: e?.message, variant: "destructive" }); }
    finally { setSending(false); }
  };

  const printDoc = async (id: string) => {
    try {
      const html = await itFormsApi.documentHtml(id);
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      const w = window.open(url, "_blank");
      if (w) w.addEventListener("load", () => w.print());
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) { toast({ title: "No se pudo abrir", description: e?.message, variant: "destructive" }); }
  };

  const saveTI = async () => {
    const def = IT_FORMS.find(d => d.codigo === tiFor?.codigo);
    if (!def) return;
    try {
      await itFormsApi.completeTI(tiFor.id, toFields(def.ti, tiValues));
      toast({ title: "Sección de TI completada", description: "Se notificó al solicitante y se actualizó el documento archivado." });
      setTiFor(null); reload();
    } catch (e: any) { toast({ title: "No se pudo guardar", description: e?.message, variant: "destructive" }); }
  };

  return (
    <AppLayout>
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => (active ? setActive(null) : navigate("/rrhh/formularios"))}><ArrowLeft className="h-4 w-4 mr-1" />Volver</Button>
          <div>
            <h1 className="text-2xl font-bold">Formularios de Tecnología</h1>
            <p className="text-sm text-muted-foreground">Alta, baja y cambios de usuarios · se envían a Tecnología y quedan archivados en el servidor.</p>
          </div>
        </div>

        {!active && isIT && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={async () => {
              try { const r = await itFormsApi.mailTest(); toast({ title: r.sent?.sent ? `Correo de prueba enviado a ${r.to}` : "El correo no se envió", description: r.sent?.sent ? "Revise su bandeja de entrada." : (r.sent?.reason || r.message), variant: r.sent?.sent ? undefined : "destructive" }); }
              catch (e: any) { toast({ title: "Fallo la prueba de correo", description: e?.message, variant: "destructive" }); }
            }}><Send className="h-4 w-4 mr-1" />Probar correo</Button>
          </div>
        )}
        {!active && (
          <div className="grid gap-4 sm:grid-cols-2">
            {IT_FORMS.filter(d => d.codigo !== "F-IT-04" || isIT).map(d => {
              const Icon = ICONS[d.codigo];
              return (
                <button key={d.codigo} onClick={() => open(d)} className="group flex items-start gap-4 p-5 rounded-xl border-2 border-border bg-card hover:border-primary transition-all text-left">
                  <div className="p-3 rounded-xl bg-primary/10"><Icon className="h-6 w-6 text-primary" /></div>
                  <div>
                    <div className="text-xs font-mono text-muted-foreground">{d.codigo}</div>
                    <div className="font-bold group-hover:text-primary">{d.titulo}</div>
                    <div className="text-sm text-muted-foreground">{d.descripcion}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {active && (
          <Card>
            <CardHeader><ITFormHeader codigo={active.codigo} /></CardHeader>
            <CardContent className="space-y-6">
              {active.sections.map(s => (
                <section key={s.title} className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-primary border-b border-border pb-1">{s.title}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {s.fields.map(f => <FieldInput key={f.key} f={f} value={values[f.key]} onChange={v => setValues(p => ({ ...p, [f.key]: v }))} />)}
                  </div>
                </section>
              ))}
              {active.codigo === "F-IT-04" && <p className="text-sm rounded-md border border-primary/40 bg-primary/5 p-3"><b>Nota:</b> Por ahora solo se incluyen los accesos a la red corporativa, VPN y programas que solo corren dentro de nuestro dominio safeone.local.</p>}
              <p className="text-xs text-muted-foreground">Al enviarlo se crea automáticamente un ticket en Tickets IT. La sección “Uso exclusivo de TI” la completa Tecnología después de recibir el formulario.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setActive(null)}>Cancelar</Button>
                <Button onClick={submit} disabled={sending}><Send className="h-4 w-4 mr-1" />{sending ? "Enviando…" : "Enviar a Tecnología"}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!active && (
          <Card>
            <CardHeader><CardTitle className="text-base">{isIT ? "Formularios recibidos" : "Mis formularios enviados"} ({list.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {!list.length && <p className="text-sm text-muted-foreground">Aún no hay formularios.</p>}
              {list.map(r => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border border-border rounded-lg p-3">
                  <div className="text-sm">
                    <div className="flex items-center gap-2"><span className="font-mono text-xs">{r.id}</span>{r.ticketId && <Badge variant="outline" className="font-mono">{r.ticketId}</Badge>}<Badge variant="outline">{r.codigo}</Badge><Badge variant={r.estado === "Completado por TI" ? "default" : "secondary"}>{r.estado}</Badge></div>
                    <div className="font-medium mt-1">{r.titulo}{r.resumen ? ` — ${r.resumen}` : ""}</div>
                    <div className="text-xs text-muted-foreground">{r.creadoPor} · {new Date(r.createdAt).toLocaleString("es-DO")}</div>
                  </div>
                  <div className="flex gap-2">
                    {isIT && !r.ti && <Button size="sm" onClick={() => { setTiFor(r); setTiValues({}); }}><ClipboardCheck className="h-4 w-4 mr-1" />Completar TI</Button>}
                    <Button size="sm" variant="outline" onClick={() => printDoc(r.id)}><Printer className="h-4 w-4 mr-1" />Imprimir</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {tiFor && (() => {
        const def = IT_FORMS.find(d => d.codigo === tiFor.codigo)!;
        return (
          <Dialog open onOpenChange={o => !o && setTiFor(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Uso exclusivo de TI · {tiFor.id}</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                {def.ti.map(f => <FieldInput key={f.key} f={f} value={tiValues[f.key]} onChange={v => setTiValues(p => ({ ...p, [f.key]: v }))} />)}
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setTiFor(null)}>Cancelar</Button><Button onClick={saveTI}>Guardar y notificar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </AppLayout>
  );
}
