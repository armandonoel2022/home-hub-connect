import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { DEPARTMENTS } from "@/lib/types";
import { folderAclApi, type FolderAcl } from "@/lib/api";
import { isSuperUser } from "@/lib/permissions";
import { Navigate } from "react-router-dom";
import { Shield, Save, Folder, Trash2, Eye, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { displayDept } from "@/lib/displayNames";

/**
 * Sólo el superusuario configura quién ve/edita las carpetas departamentales.
 * Si no hay ACL para un departamento, se conserva el comportamiento por defecto
 * (miembros del departamento + admins).
 */
const AdminFolderPermissions = () => {
  const { user, allUsers } = useAuth();
  const [acl, setAcl] = useState<FolderAcl>({});
  const [selected, setSelected] = useState<string>(DEPARTMENTS[0]);
  const [draft, setDraft] = useState<{ viewers: string[]; editors: string[] }>({ viewers: [], editors: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await folderAclApi.getAll();
        setAcl(data || {});
      } catch {
        toast({ title: "Error", description: "No se pudo cargar la ACL.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const entry = acl[selected];
    setDraft({ viewers: entry?.viewers || [], editors: entry?.editors || [] });
  }, [selected, acl]);

  if (!isSuperUser(user)) return <Navigate to="/" replace />;

  const toggle = (list: "viewers" | "editors", id: string) => {
    setDraft((d) => {
      const cur = d[list];
      return { ...d, [list]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  };

  const save = async () => {
    try {
      // Editors implican viewers
      const editorsSet = new Set(draft.editors);
      const viewers = Array.from(new Set([...draft.viewers, ...draft.editors]));
      await folderAclApi.setDepartment(selected, { viewers, editors: Array.from(editorsSet) });
      setAcl({ ...acl, [selected]: { viewers, editors: Array.from(editorsSet) } });
      toast({ title: "Permisos guardados", description: `Carpeta ${displayDept(selected)} actualizada.` });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar.", variant: "destructive" });
    }
  };

  const clear = async () => {
    if (!confirm("Restaurar comportamiento por defecto (miembros del departamento)?")) return;
    try {
      await folderAclApi.clearDepartment(selected);
      const next = { ...acl };
      delete next[selected];
      setAcl(next);
      toast({ title: "ACL eliminada", description: `${displayDept(selected)} vuelve al modo departamental.` });
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6 flex items-center gap-3">
            <Shield className="h-7 w-7 text-gold" />
            <div>
              <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                Permisos de <span className="gold-accent-text">Carpetas Departamentales</span>
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Configura quién puede ver o editar las carpetas del dashboard principal.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Lista de departamentos */}
          <div className="bg-card rounded-lg border border-border p-3 space-y-1">
            {DEPARTMENTS.map((d) => {
              const hasAcl = !!acl[d];
              const active = selected === d;
              return (
                <button
                  key={d}
                  onClick={() => setSelected(d)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                    active ? "bg-gold/15 text-card-foreground font-semibold" : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Folder className="h-4 w-4" /> {displayDept(d)}
                  </span>
                  {hasAcl && <span className="text-[10px] font-bold gold-accent-text">ACL</span>}
                </button>
              );
            })}
          </div>

          {/* Editor */}
          <div className="md:col-span-2 bg-card rounded-lg border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-card-foreground">
                {displayDept(selected)}
              </h2>
              <div className="flex gap-2">
                {acl[selected] && (
                  <button onClick={clear} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3 w-3" /> Quitar ACL
                  </button>
                )}
                <button onClick={save} className="btn-gold text-sm flex items-center gap-2">
                  <Save className="h-4 w-4" /> Guardar
                </button>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-3 py-2 font-heading">Usuario</th>
                      <th className="text-left px-3 py-2 font-heading">Depto.</th>
                      <th className="text-center px-3 py-2 font-heading"><Eye className="h-4 w-4 inline" /> Ver</th>
                      <th className="text-center px-3 py-2 font-heading"><Pencil className="h-4 w-4 inline" /> Editar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.filter((u) => u.employeeStatus !== "Inactivo").map((u) => (
                      <tr key={u.id} className="border-b border-border hover:bg-muted/30">
                        <td className="px-3 py-2 text-card-foreground">{u.fullName}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{displayDept(u.department)}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={draft.viewers.includes(u.id) || draft.editors.includes(u.id)}
                            onChange={() => toggle("viewers", u.id)}
                            disabled={draft.editors.includes(u.id)}
                            className="accent-gold w-4 h-4"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={draft.editors.includes(u.id)}
                            onChange={() => toggle("editors", u.id)}
                            className="accent-gold w-4 h-4"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground mt-3">
                  Si no hay usuarios marcados, la carpeta vuelve al modo por defecto (miembros del departamento + administradores).
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminFolderPermissions;
