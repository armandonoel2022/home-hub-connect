import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { employeesApi, photoSyncApi, type Employee } from "@/lib/api";
import type { IntranetUser } from "@/lib/types";
import {
  normalizeText,
  nameSignature,
  isLikelySamePerson,
  mapHrDepartment,
} from "@/lib/deptMembers";
import { toast } from "@/hooks/use-toast";
import { Link2, RefreshCw, Check, User } from "lucide-react";

interface Proposal {
  user: IntranetUser;
  employee: Employee;
  /** Cambios propuestos sobre el usuario (solo campos que difieren) */
  changes: Partial<IntranetUser>;
  photoUrl?: string;
  selected: boolean;
}

/** Divide un nombre completo en hasta 2 nombres y 2 apellidos (heurística RD). */
function splitName(full: string): Pick<IntranetUser, "firstName1" | "firstName2" | "lastName1" | "lastName2"> {
  const t = full.trim().split(/\s+/).filter(Boolean);
  if (t.length >= 4) return { firstName1: t[0], firstName2: t[1], lastName1: t[2], lastName2: t.slice(3).join(" ") };
  if (t.length === 3) return { firstName1: t[0], firstName2: "", lastName1: t[1], lastName2: t[2] };
  if (t.length === 2) return { firstName1: t[0], firstName2: "", lastName1: t[1], lastName2: "" };
  return { firstName1: t[0] || "", firstName2: "", lastName1: "", lastName2: "" };
}

/** Encuentra el empleado de RRHH que mejor coincide con un usuario de intranet. */
function findEmployeeForUser(
  user: IntranetUser,
  employees: Employee[],
  byCode: Map<string, Employee>,
  byName: Map<string, Employee>,
  bySig: Map<string, Employee>,
): Employee | undefined {
  if (user.employeeCode && byCode.get(String(user.employeeCode))) return byCode.get(String(user.employeeCode));
  const exact = byName.get(normalizeText(user.fullName));
  if (exact) return exact;
  const sig = bySig.get(nameSignature(user.fullName));
  if (sig) return sig;
  const aliases = employees.filter((e) => isLikelySamePerson(user.fullName, e.fullName, user.department, e.department));
  return aliases.length === 1 ? aliases[0] : undefined;
}

const UserHrReconcile = () => {
  const { allUsers, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [unmatched, setUnmatched] = useState<IntranetUser[]>([]);

  const analyze = async () => {
    setLoading(true);
    try {
      const [employees, scan] = await Promise.all([
        employeesApi.getAll(),
        photoSyncApi.scan().catch(() => null),
      ]);
      const photoByCode = new Map<string, string>();
      scan?.employees.forEach((e) => {
        if (e.match?.url) photoByCode.set(String(e.employeeCode), e.match.url);
        else if (e.currentPhoto) photoByCode.set(String(e.employeeCode), e.currentPhoto);
      });

      const byCode = new Map<string, Employee>();
      const byName = new Map<string, Employee>();
      const bySig = new Map<string, Employee>();
      employees.forEach((e) => {
        if (e.employeeCode) byCode.set(String(e.employeeCode), e);
        byName.set(normalizeText(e.fullName), e);
        const sig = nameSignature(e.fullName);
        if (sig && !bySig.has(sig)) bySig.set(sig, e);
      });

      const props: Proposal[] = [];
      const noMatch: IntranetUser[] = [];

      allUsers.forEach((u) => {
        const emp = findEmployeeForUser(u, employees, byCode, byName, bySig);
        if (!emp) {
          noMatch.push(u);
          return;
        }
        const photoUrl = photoByCode.get(String(emp.employeeCode));
        const changes: Partial<IntranetUser> = {};
        if (emp.employeeCode && u.employeeCode !== emp.employeeCode) changes.employeeCode = emp.employeeCode;
        if (emp.fullName && normalizeText(u.fullName) !== normalizeText(emp.fullName)) {
          changes.fullName = emp.fullName;
          Object.assign(changes, splitName(emp.fullName));
        }
        const ced = emp.cedula || emp.tss;
        if (ced && u.cedula !== ced) changes.cedula = ced;
        const dept = mapHrDepartment(emp.department);
        if (dept && u.department !== dept) changes.department = dept;
        if (emp.position && u.position !== emp.position) changes.position = emp.position;
        if (emp.hireDate && u.hireDate !== emp.hireDate) changes.hireDate = emp.hireDate;
        const bday = emp.birthdayMMDD || emp.birthday;
        if (bday && u.birthday !== bday) changes.birthday = bday;
        if (photoUrl && u.photoUrl !== photoUrl) changes.photoUrl = photoUrl;

        if (Object.keys(changes).length === 0) return; // ya está sincronizado
        props.push({ user: u, employee: emp, changes, photoUrl, selected: true });
      });

      setProposals(props);
      setUnmatched(noMatch);
      setAnalyzed(true);
      toast({
        title: "Análisis completado",
        description: `${props.length} usuario(s) con coincidencia en RRHH, ${noMatch.length} sin coincidencia.`,
      });
    } catch (e: any) {
      toast({ title: "Error al analizar", description: e?.message || "No se pudo leer RRHH", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) =>
    setProposals((prev) => prev.map((p) => (p.user.id === id ? { ...p, selected: !p.selected } : p)));

  const apply = async () => {
    const selected = proposals.filter((p) => p.selected);
    if (selected.length === 0) return;
    setApplying(true);
    let ok = 0;
    for (const p of selected) {
      try {
        await updateUser(p.user.id, p.changes);
        ok++;
      } catch {
        /* continuar con los demás */
      }
    }
    setApplying(false);
    setProposals((prev) => prev.filter((p) => !p.selected));
    toast({
      title: "Reconciliación aplicada",
      description: `${ok} usuario(s) actualizados con los datos de RRHH.`,
    });
  };

  const selectedCount = proposals.filter((p) => p.selected).length;

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-gold" />
          <div>
            <h3 className="font-heading font-bold text-sm text-card-foreground">Reconciliar usuarios con Recursos Humanos</h3>
            <p className="text-xs text-muted-foreground">
              Empareja los usuarios actuales con su empleado de RRHH para traer código, nombre legal, cédula y foto. No crea usuarios nuevos.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={analyze} disabled={loading} className="btn-gold text-sm flex items-center gap-2 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Analizando..." : "Analizar coincidencias"}
          </button>
          {selectedCount > 0 && (
            <button onClick={apply} disabled={applying} className="text-sm flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-medium hover:opacity-90 disabled:opacity-50">
              <Check className="h-4 w-4" />
              {applying ? "Aplicando..." : `Aplicar ${selectedCount}`}
            </button>
          )}
        </div>
      </div>

      {analyzed && proposals.length === 0 && (
        <p className="text-sm text-muted-foreground">Todos los usuarios ya están sincronizados con RRHH. ✅</p>
      )}

      {proposals.length > 0 && (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 w-10"></th>
                <th className="text-left px-3 py-2 font-heading font-semibold text-card-foreground">Usuario actual</th>
                <th className="text-left px-3 py-2 font-heading font-semibold text-card-foreground">Datos de RRHH a aplicar</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.user.id} className="border-b border-border align-top">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={p.selected} onChange={() => toggle(p.user.id)} className="accent-[hsl(var(--gold))]" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {p.user.photoUrl ? <img src={p.user.photoUrl} alt="" className="w-full h-full object-cover" /> : <User className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div>
                        <p className="font-medium text-card-foreground">{p.user.fullName}</p>
                        <p className="text-xs text-muted-foreground">{p.user.department}{p.user.employeeCode ? ` · #${p.user.employeeCode}` : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-2">
                      {p.photoUrl && (
                        <img src={p.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {p.changes.fullName && <Chip label="Nombre" value={p.changes.fullName} />}
                        {p.changes.employeeCode && <Chip label="Código" value={p.changes.employeeCode} />}
                        {p.changes.cedula && <Chip label="Cédula" value={p.changes.cedula} />}
                        {p.changes.department && <Chip label="Depto" value={p.changes.department} />}
                        {p.changes.position && <Chip label="Cargo" value={p.changes.position} />}
                        {p.changes.hireDate && <Chip label="Ingreso" value={p.changes.hireDate} />}
                        {p.changes.birthday && <Chip label="Cumple" value={p.changes.birthday} />}
                        {p.changes.photoUrl && <Chip label="Foto" value="actualizar" />}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {analyzed && unmatched.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          Sin coincidencia en RRHH ({unmatched.length}): {unmatched.map((u) => u.fullName).join(", ")}
        </p>
      )}
    </div>
  );
};

const Chip = ({ label, value }: { label: string; value: string }) => (
  <span className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded">
    <span className="text-muted-foreground">{label}:</span>
    <span className="font-medium text-card-foreground">{value}</span>
  </span>
);

export default UserHrReconcile;
