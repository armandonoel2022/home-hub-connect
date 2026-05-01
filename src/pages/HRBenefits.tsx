import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { benefitsApi } from "@/lib/api";
import {
  ArrowLeft, Download, Pencil, Plus, Trash2, Sparkles,
  UserPlus, Cake, Clock, HeartPulse, CalendarDays, Sun, Award,
  Gift, Heart, Star, Users, ShieldCheck, Briefcase, GraduationCap,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  UserPlus, Cake, Clock, HeartPulse, CalendarDays, Sun, Award, Sparkles,
  Gift, Heart, Star, Users, ShieldCheck, Briefcase, GraduationCap,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);

const COLOR_MAP: Record<string, { bg: string; ring: string; icon: string; chip: string }> = {
  amber:   { bg: "bg-amber-50",   ring: "ring-amber-200",   icon: "text-amber-600",   chip: "bg-amber-100 text-amber-800" },
  rose:    { bg: "bg-rose-50",    ring: "ring-rose-200",    icon: "text-rose-600",    chip: "bg-rose-100 text-rose-800" },
  sky:     { bg: "bg-sky-50",     ring: "ring-sky-200",     icon: "text-sky-600",     chip: "bg-sky-100 text-sky-800" },
  emerald: { bg: "bg-emerald-50", ring: "ring-emerald-200", icon: "text-emerald-600", chip: "bg-emerald-100 text-emerald-800" },
  violet:  { bg: "bg-violet-50",  ring: "ring-violet-200",  icon: "text-violet-600",  chip: "bg-violet-100 text-violet-800" },
  orange:  { bg: "bg-orange-50",  ring: "ring-orange-200",  icon: "text-orange-600",  chip: "bg-orange-100 text-orange-800" },
  yellow:  { bg: "bg-yellow-50",  ring: "ring-yellow-200",  icon: "text-yellow-700",  chip: "bg-yellow-100 text-yellow-800" },
  slate:   { bg: "bg-slate-50",   ring: "ring-slate-200",   icon: "text-slate-700",   chip: "bg-slate-100 text-slate-800" },
};
const COLOR_OPTIONS = Object.keys(COLOR_MAP);

interface Benefit {
  id: string;
  title: string;
  icon: string;
  color: string;
  appliesTo: string;
  summary: string;
  details: string[];
  order?: number;
}

const HR_EDITOR_EMAILS = new Set([
  "daguasvivas@safeone.com.do",
  "tecnologia@safeone.com.do",
  "anoel@safeone.com.do",
]);

const HRBenefits = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Benefit | null>(null);
  const [creating, setCreating] = useState(false);

  const canEdit = useMemo(() => {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (HR_EDITOR_EMAILS.has((user.email || "").toLowerCase())) return true;
    if (user.department === "Recursos Humanos" && (user as any).isDepartmentLeader) return true;
    return false;
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await benefitsApi.getAll();
      setBenefits(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (b: Benefit, isNew: boolean) => {
    try {
      if (isNew) await benefitsApi.create(b);
      else await benefitsApi.update(b.id, b);
      toast({ title: isNew ? "Beneficio creado" : "Beneficio actualizado" });
      setEditing(null);
      setCreating(false);
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este beneficio?")) return;
    try {
      await benefitsApi.delete(id);
      toast({ title: "Beneficio eliminado" });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <Navbar />
      <main className="flex-1 bg-background">
        {/* Hero Header */}
        <div className="relative overflow-hidden border-b" style={{
          background: "linear-gradient(135deg, hsl(220 50% 25%) 0%, hsl(220 60% 35%) 100%)",
        }}>
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />
          <div className="container mx-auto px-6 py-8 relative">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="text-white hover:bg-white/10 mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
            </Button>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-xl bg-white/15 backdrop-blur p-3">
                    <Gift className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-amber-200 text-sm font-medium tracking-wider uppercase">Recursos Humanos</p>
                    <h1 className="text-3xl md:text-4xl font-bold text-white">Beneficios SafeOne</h1>
                  </div>
                </div>
                <p className="text-white/80 max-w-2xl">
                  Conoce todos los beneficios que SafeOne ofrece a sus colaboradores como
                  parte de nuestra cultura de bienestar y reconocimiento.
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                  <a href="/files/Beneficios_SafeOne.pptx" download>
                    <Download className="mr-2 h-4 w-4" /> Descargar PPTX
                  </a>
                </Button>
                {canEdit && (
                  <Button
                    onClick={() => setCreating(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Nuevo beneficio
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="container mx-auto px-6 py-10">
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : benefits.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aún no hay beneficios publicados.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {benefits.map((b) => {
                const Icon = ICON_MAP[b.icon] || Sparkles;
                const colors = COLOR_MAP[b.color] || COLOR_MAP.amber;
                return (
                  <Card
                    key={b.id}
                    className={`relative overflow-hidden border-2 ${colors.ring} hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group`}
                  >
                    <div className={`absolute top-0 left-0 right-0 h-1.5 ${colors.icon.replace("text-", "bg-")}`} />
                    <CardHeader className={`${colors.bg} pb-4`}>
                      <div className="flex items-start justify-between">
                        <div className={`rounded-xl bg-white p-3 shadow-sm ring-1 ${colors.ring}`}>
                          <Icon className={`h-7 w-7 ${colors.icon}`} />
                        </div>
                        {canEdit && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(b)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(b.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <CardTitle className="text-xl font-bold mt-3 text-slate-800">{b.title}</CardTitle>
                      <Badge variant="secondary" className={`${colors.chip} border-0 w-fit text-xs`}>
                        {b.appliesTo}
                      </Badge>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      <p className="text-sm font-medium text-foreground leading-relaxed">{b.summary}</p>
                      {b.details && b.details.length > 0 && (
                        <ul className="space-y-2 pt-2 border-t">
                          {b.details.map((d, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex gap-2 leading-relaxed">
                              <span className={`${colors.icon} font-bold mt-0.5`}>•</span>
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {canEdit && (
            <div className="mt-8 p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
              <strong>Modo edición habilitado.</strong> Como líder de RRHH puedes crear, editar y
              eliminar beneficios. Los cambios son visibles para todo el personal de inmediato.
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Create / Edit Dialog */}
      <BenefitDialog
        open={creating || !!editing}
        benefit={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={handleSave}
      />
    </AppLayout>
  );
};

interface DialogProps {
  open: boolean;
  benefit: Benefit | null;
  onClose: () => void;
  onSave: (b: Benefit, isNew: boolean) => void;
}

const BenefitDialog = ({ open, benefit, onClose, onSave }: DialogProps) => {
  const isNew = !benefit;
  const [form, setForm] = useState<Benefit>({
    id: "", title: "", icon: "Sparkles", color: "amber",
    appliesTo: "Todos los colaboradores", summary: "", details: [],
  });
  const [detailsText, setDetailsText] = useState("");

  useEffect(() => {
    if (open) {
      if (benefit) {
        setForm(benefit);
        setDetailsText((benefit.details || []).join("\n"));
      } else {
        setForm({
          id: "", title: "", icon: "Sparkles", color: "amber",
          appliesTo: "Todos los colaboradores", summary: "", details: [],
        });
        setDetailsText("");
      }
    }
  }, [open, benefit]);

  const handleSubmit = () => {
    if (!form.title.trim() || !form.summary.trim()) return;
    const details = detailsText.split("\n").map(l => l.trim()).filter(Boolean);
    onSave({ ...form, details }, isNew);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuevo beneficio" : "Editar beneficio"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Ícono</Label>
              <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map(name => {
                    const I = ICON_MAP[name];
                    return (
                      <SelectItem key={name} value={name}>
                        <span className="flex items-center gap-2"><I className="h-4 w-4" /> {name}</span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Color</Label>
              <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map(c => (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${COLOR_MAP[c].icon.replace("text-","bg-")}`} />
                        {c}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Aplica para</Label>
            <Input value={form.appliesTo} onChange={(e) => setForm({ ...form, appliesTo: e.target.value })} />
          </div>
          <div>
            <Label>Resumen (1-2 líneas)</Label>
            <Textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </div>
          <div>
            <Label>Detalles (un punto por línea)</Label>
            <Textarea rows={6} value={detailsText} onChange={(e) => setDetailsText(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>{isNew ? "Crear" : "Guardar cambios"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HRBenefits;
