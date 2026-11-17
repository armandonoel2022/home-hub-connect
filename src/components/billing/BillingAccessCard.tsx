import { useEffect, useState } from "react";
import { Lock, Unlock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { billingAnalysisApi } from "@/lib/api";
import type { BillingAccess } from "@/lib/billingAnalysisTypes";

/** Solo el super administrador: abrir el análisis a todos o limitarlo a una lista de correos. */
export default function BillingAccessCard({ access, onChange }: { access: BillingAccess; onChange: (a: BillingAccess) => void }) {
  const [restringido, setRestringido] = useState(access.restringido);
  const [emails, setEmails] = useState(access.emails.join("\n"));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setRestringido(access.restringido); setEmails(access.emails.join("\n")); }, [access]);

  const save = async () => {
    setSaving(true);
    try {
      const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
      const next = await billingAnalysisApi.saveAccess({ restringido, emails: list });
      onChange(next);
      toast({ title: "Acceso actualizado", description: next.restringido ? `${next.emails.length} usuarios con acceso` : "Abierto a todos los usuarios" });
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {restringido ? <Lock className="h-4 w-4 text-primary" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
          <div>
            <p className="text-sm font-semibold">Quién puede ver este análisis</p>
            <p className="text-xs text-muted-foreground">{restringido ? "Solo los correos de la lista (y el super administrador)." : "Todos los usuarios de la intranet."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="billing-restrict" checked={restringido} onCheckedChange={setRestringido} />
          <Label htmlFor="billing-restrict" className="text-sm">Limitar acceso</Label>
        </div>
      </div>
      {restringido && (
        <Textarea className="mt-3 font-mono text-xs" rows={4} value={emails} onChange={(e) => setEmails(e.target.value)}
          placeholder={"sperez@safeone.com.do\ncfabian@safeone.com.do"} aria-label="Correos con acceso" />
      )}
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={save} disabled={saving}><Save className="mr-1.5 h-4 w-4" />Guardar acceso</Button>
      </div>
    </div>
  );
}
