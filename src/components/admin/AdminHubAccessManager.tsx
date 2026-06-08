import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Search, Save } from "lucide-react";
import { displayDept } from "@/lib/displayNames";
import {
  ADMIN_HUB_MODULES, getAdminHubAcl, setUserModules,
  hasFullAdminHubAccess, type AdminModuleKey,
} from "@/lib/adminHubAccess";

/**
 * Panel para que Chrisnel (o un admin) otorgue acceso granular a los módulos
 * del Hub de Administración a cualquier usuario de la intranet.
 */
const AdminHubAccessManager = () => {
  const { allUsers } = useAuth();
  const { toast } = useToast();
  const [acl, setAcl] = useState(getAdminHubAcl);
  const [search, setSearch] = useState("");

  const users = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allUsers
      .filter((u) => u.employeeStatus !== "Inactivo")
      .filter((u) => !q || `${u.fullName} ${u.email} ${u.department}`.toLowerCase().includes(q))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [allUsers, search]);

  const toggle = (userId: string, key: AdminModuleKey) => {
    setAcl((prev) => {
      const cur = prev[userId] || [];
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      const saved = setUserModules(userId, next);
      return { ...saved };
    });
    toast({ title: "Acceso actualizado", description: "Los permisos del Hub se guardaron." });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Permisos del Hub de Administración</h1>
          <p className="text-sm text-muted-foreground">
            Otorga acceso individual a cada módulo. La persona solo verá lo que actives.
          </p>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar usuario…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="overflow-x-auto border rounded-xl bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/50">Usuario</th>
              {ADMIN_HUB_MODULES.map((m) => (
                <th key={m.key} className="px-2 py-2 font-semibold text-center text-xs whitespace-nowrap">{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const full = hasFullAdminHubAccess(u);
              const granted = acl[u.id] || [];
              return (
                <tr key={u.id} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2 sticky left-0 bg-card">
                    <div className="font-medium text-foreground">{u.fullName}</div>
                    <div className="text-xs text-muted-foreground">{displayDept(u.department)}</div>
                  </td>
                  {ADMIN_HUB_MODULES.map((m) => (
                    <td key={m.key} className="px-2 py-2 text-center">
                      {full ? (
                        <Badge variant="secondary" className="text-[9px]">Total</Badge>
                      ) : (
                        <Checkbox
                          checked={granted.includes(m.key)}
                          onCheckedChange={() => toggle(u.id, m.key)}
                          className="mx-auto"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
        <Save className="h-3 w-3" /> Los cambios se guardan automáticamente al marcar cada casilla.
        Administradores y superusuarios tienen acceso total.
      </p>
    </div>
  );
};

export default AdminHubAccessManager;
