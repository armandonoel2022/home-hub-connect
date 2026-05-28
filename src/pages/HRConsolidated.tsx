import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAllHRRequests } from "@/lib/hrRequestService";
import { HR_FORM_LABELS, type HRRequest, type HRFormType } from "@/lib/hrRequestTypes";
import { employeesApi } from "@/lib/api";
import { Users, Search, Printer, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";

interface PersonRow {
  key: string;
  userId?: string;
  employeeCode?: string;
  fullName: string;
  department?: string;
  position?: string;
  totalRequests: number;
  byType: Record<HRFormType, number>;
  approved: number;
  rejected: number;
  pending: number;
}

const HRConsolidated = () => {
  const { user, activeUsers } = useAuth();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  useEffect(() => {
    employeesApi.getAll().then(setEmployees).catch(() => setEmployees([]));
    const h = () => setTick((t) => t + 1);
    window.addEventListener("safeone:hr-updated", h);
    return () => window.removeEventListener("safeone:hr-updated", h);
  }, []);

  const allRequests = useMemo(() => getAllHRRequests(), [tick]);

  const people: PersonRow[] = useMemo(() => {
    const map = new Map<string, PersonRow>();
    const ensure = (key: string, base: Partial<PersonRow>) => {
      if (!map.has(key)) {
        map.set(key, {
          key,
          totalRequests: 0,
          byType: { vacaciones: 0, "dias-libres": 0, comida: 0, ausencias: 0, permisos: 0, prestamos: 0 },
          approved: 0,
          rejected: 0,
          pending: 0,
          fullName: "",
          ...base,
        } as PersonRow);
      }
      return map.get(key)!;
    };

    activeUsers.forEach((u) => {
      ensure(`u:${u.id}`, {
        userId: u.id,
        fullName: u.fullName,
        department: u.department,
        position: u.position,
      });
    });
    (employees || []).filter((e) => e.status === "Activo").forEach((e) => {
      const matchUser = activeUsers.find((u) => u.fullName?.toLowerCase() === String(e.fullName || "").toLowerCase());
      if (matchUser) return; // ya está
      ensure(`e:${e.employeeCode}`, {
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        department: e.department,
        position: e.position,
      });
    });

    allRequests.forEach((r) => {
      // Encuentra row matching
      let row: PersonRow | undefined;
      if (r.requestedBy) {
        row = map.get(`u:${r.requestedBy}`);
      }
      if (!row) {
        const fn = (r.requestedByName || "").toLowerCase();
        for (const v of map.values()) {
          if (v.fullName.toLowerCase() === fn) { row = v; break; }
        }
      }
      if (!row) {
        row = ensure(`x:${r.requestedByName}`, { fullName: r.requestedByName, department: r.department });
      }
      row.totalRequests++;
      row.byType[r.formType] = (row.byType[r.formType] || 0) + 1;
      if (r.status === "Aprobada") row.approved++;
      else if (r.status === "Rechazada") row.rejected++;
      else row.pending++;
    });

    return [...map.values()].sort((a, b) => b.totalRequests - a.totalRequests || a.fullName.localeCompare(b.fullName));
  }, [activeUsers, employees, allRequests]);

  const filteredPeople = useMemo(() => {
    const q = search.toLowerCase();
    return people.filter((p) =>
      !q || `${p.fullName} ${p.department || ""} ${p.employeeCode || ""}`.toLowerCase().includes(q)
    );
  }, [people, search]);

  const selectedPerson = useMemo(() => people.find((p) => p.key === selected), [people, selected]);

  const personRequests = useMemo<HRRequest[]>(() => {
    if (!selectedPerson) return [];
    const list = allRequests.filter((r) => {
      if (selectedPerson.userId && r.requestedBy === selectedPerson.userId) return true;
      if (selectedPerson.fullName && (r.requestedByName || "").toLowerCase() === selectedPerson.fullName.toLowerCase()) return true;
      return false;
    });
    return list.filter((r) =>
      (!filterType || r.formType === filterType) &&
      (!filterYear || (r.requestedAt || "").startsWith(filterYear)) &&
      (!filterStatus || r.status === filterStatus)
    );
  }, [selectedPerson, allRequests, filterType, filterYear, filterStatus]);

  const exportExcel = () => {
    if (!selectedPerson) return;
    const rows = personRequests.map((r) => ({
      Folio: r.id,
      Tipo: HR_FORM_LABELS[r.formType],
      Estado: r.status,
      "Fecha solicitud": new Date(r.requestedAt).toLocaleString("es-DO"),
      Supervisor: r.supervisorName,
      "Aprobado Supervisor": r.supervisorApproval ? `${r.supervisorApproval.byName} (${new Date(r.supervisorApproval.at).toLocaleDateString("es-DO")})` : "—",
      "Aprobado RRHH": r.rrhhApproval ? `${r.rrhhApproval.byName} (${new Date(r.rrhhApproval.at).toLocaleDateString("es-DO")})` : "—",
      "Aprobado Gerencia": r.gerenciaApproval ? `${r.gerenciaApproval.byName} (${new Date(r.gerenciaApproval.at).toLocaleDateString("es-DO")})` : "—",
      Rechazo: r.rejectionReason || "",
      Detalle: Object.entries(r.formData).map(([k, v]) => `${k}: ${v}`).join(" | "),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Solicitudes");
    XLSX.writeFile(wb, `consolidado-rrhh-${selectedPerson.fullName.replace(/\s+/g, "_")}.xlsx`);
  };

  const printPerson = () => {
    window.print();
  };

  if (!user) return null;

  return (
    <AppLayout>
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6 print:p-0">
        <div className="print:hidden">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Consolidado RRHH por Empleado
          </h1>
          <p className="text-sm text-muted-foreground">
            Histórico unificado de solicitudes (vacaciones, comida, ausencias, permisos, préstamos, días libres) — usuarios de intranet + empleados activos.
          </p>
        </div>

        <div className="grid md:grid-cols-[320px,1fr] gap-4 print:block">
          {/* Lista de personas */}
          <Card className="p-3 print:hidden">
            <div className="relative mb-2">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar empleado…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-1">
              {filteredPeople.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setSelected(p.key)}
                  className={`w-full text-left p-2 rounded text-sm hover:bg-muted ${selected === p.key ? "bg-primary/10 border border-primary/30" : ""}`}
                >
                  <div className="font-medium">{p.fullName}</div>
                  <div className="text-xs text-muted-foreground">{p.department || "—"} · {p.totalRequests} solicitudes</div>
                </button>
              ))}
              {filteredPeople.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">Sin resultados</div>
              )}
            </div>
          </Card>

          {/* Detalle persona */}
          <div className="space-y-4">
            {!selectedPerson ? (
              <Card className="p-12 text-center text-sm text-muted-foreground">
                Selecciona un empleado para ver su histórico.
              </Card>
            ) : (
              <>
                <Card className="p-4">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-xl font-bold">{selectedPerson.fullName}</h2>
                      <p className="text-sm text-muted-foreground">{selectedPerson.department || "—"} · {selectedPerson.position || ""}</p>
                      {selectedPerson.employeeCode && <Badge variant="outline" className="mt-1 text-xs">{selectedPerson.employeeCode}</Badge>}
                    </div>
                    <div className="flex gap-2 print:hidden">
                      <Button size="sm" variant="outline" className="gap-2" onClick={exportExcel}>
                        <FileSpreadsheet className="h-3 w-3" /> Excel
                      </Button>
                      <Button size="sm" variant="outline" className="gap-2" onClick={printPerson}>
                        <Printer className="h-3 w-3" /> Imprimir
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    <Stat label="Total" value={selectedPerson.totalRequests} />
                    <Stat label="Aprobadas" value={selectedPerson.approved} color="text-emerald-600" />
                    <Stat label="Pendientes" value={selectedPerson.pending} color="text-amber-600" />
                    <Stat label="Rechazadas" value={selectedPerson.rejected} color="text-red-600" />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-3">
                    {(Object.keys(HR_FORM_LABELS) as HRFormType[]).map((t) => (
                      <div key={t} className="text-center p-2 rounded bg-muted/40">
                        <div className="text-[10px] uppercase text-muted-foreground">{HR_FORM_LABELS[t]}</div>
                        <div className="text-lg font-bold">{selectedPerson.byType[t] || 0}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-3 print:hidden flex flex-wrap gap-2 items-center">
                  <select className="border rounded px-2 py-1 text-sm bg-background" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                    <option value="">Todos los tipos</option>
                    {Object.entries(HR_FORM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select className="border rounded px-2 py-1 text-sm bg-background" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="">Todos los estados</option>
                    <option>Aprobada</option><option>Rechazada</option>
                    <option>Pendiente Supervisor</option><option>Pendiente RRHH</option>
                    <option>Pendiente Gerencia General</option><option>Pendiente Aplicación RRHH</option>
                  </select>
                  <Input className="max-w-[120px]" placeholder="Año (YYYY)" value={filterYear} onChange={(e) => setFilterYear(e.target.value)} />
                </Card>

                {personRequests.length === 0 ? (
                  <Card className="p-8 text-center text-sm text-muted-foreground">Sin solicitudes para los filtros aplicados.</Card>
                ) : (
                  <div className="space-y-2">
                    {personRequests.map((r) => (
                      <Card key={r.id} className="p-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="font-mono text-[10px]">{r.id}</Badge>
                              <span className="font-semibold text-sm">{HR_FORM_LABELS[r.formType]}</span>
                              <Badge variant="secondary" className="text-xs">{r.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Solicitada el {new Date(r.requestedAt).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}
                            </p>
                          </div>
                          {r.status === "Aprobada" && (
                            <Button size="sm" variant="outline" className="gap-2 print:hidden" onClick={() => navigate(`/rrhh/imprimir/${r.id}`)}>
                              <FileText className="h-3 w-3" /> Imprimir orden
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </AppLayout>
  );
};

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center p-2 border rounded">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color || ""}`}>{value}</div>
    </div>
  );
}

export default HRConsolidated;
