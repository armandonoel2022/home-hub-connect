import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { employeesApi, isApiConfigured, type Employee } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft, Users, Search, Plus, Pencil, Trash2, Save, X,
  Building2, Briefcase, Download, Shield,
} from "lucide-react";
import { useArmedPersonnel } from "@/hooks/useApiHooks";
import type { ArmedPersonnel } from "@/lib/types";

const EmployeeDirectory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [payrollFilter, setPayrollFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee>>({});
  const [viewing, setViewing] = useState<Employee | null>(null);
  const { data: armedPersonnel } = useArmedPersonnel();

  const normalize = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const findArmedRecord = (emp: Employee): ArmedPersonnel | undefined => {
    if (!emp) return undefined;
    const byCode = armedPersonnel.find(a => a.employeeCode && emp.employeeCode && a.employeeCode === emp.employeeCode);
    if (byCode) return byCode;
    const target = normalize(emp.fullName);
    return armedPersonnel.find(a => normalize(a.name) === target);
  };

  const canEdit = !!user && (
    user.isAdmin ||
    user.department === "Recursos Humanos"
  );

  const loadFromSeedFallback = async () => {
    try {
      const res = await fetch("/data/employees_seed.json");
      if (!res.ok) throw new Error("Seed no disponible");
      const seed = await res.json();
      setEmployees(seed);
    } catch (e: any) {
      toast.error("No se pudo cargar el directorio: " + e.message);
    }
  };

  const loadEmployees = async () => {
    if (!isApiConfigured()) {
      await loadFromSeedFallback();
      setLoading(false);
      return;
    }
    try {
      const data = await employeesApi.getAll();
      if (!data || data.length === 0) {
        await loadFromSeedFallback();
      } else {
        setEmployees(data);
      }
    } catch (e: any) {
      // API caída → cargar seed estático
      await loadFromSeedFallback();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEmployees(); }, []);

  const departments = useMemo(() =>
    [...new Set(employees.map(e => e.department).filter(Boolean))].sort(),
    [employees]
  );

  const payrollTypes = useMemo(() =>
    [...new Set(employees.map(e => e.payrollType).filter(Boolean))].sort(),
    [employees]
  );

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (deptFilter !== "all" && e.department !== deptFilter) return false;
      if (payrollFilter !== "all" && e.payrollType !== payrollFilter) return false;
      if (categoryFilter !== "all" && (e.category || "") !== categoryFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return e.fullName.toLowerCase().includes(s) ||
          e.employeeCode.toLowerCase().includes(s) ||
          e.position.toLowerCase().includes(s);
      }
      return true;
    });
  }, [employees, search, deptFilter, payrollFilter, categoryFilter]);

  const stats = useMemo(() => {
    const active = employees.filter(e => e.status === "Activo").length;
    const depts = new Set(employees.map(e => e.department)).size;
    return { total: employees.length, active, depts };
  }, [employees]);

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setFormData({ ...emp });
  };

  const openCreate = () => {
    setCreating(true);
    setFormData({ status: "Activo", payrollType: "Operaciones", department: "", position: "", fullName: "", bank: "", salary: 0, hourlyRate: 0 });
  };

  const handleSave = async () => {
    try {
      if (creating) {
        await employeesApi.create(formData);
        toast.success("Empleado creado");
      } else if (editing) {
        await employeesApi.update(editing.employeeCode, formData);
        toast.success("Empleado actualizado");
      }
      setEditing(null);
      setCreating(false);
      loadEmployees();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm("¿Eliminar este empleado?")) return;
    try {
      await employeesApi.remove(code);
      toast.success("Empleado eliminado");
      loadEmployees();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const exportCSV = () => {
    const headers = ["Código", "Nombre", "Estatus", "Nómina", "Departamento", "Puesto", "Banco", "Salario"];
    const rows = filtered.map(e => [e.employeeCode, e.fullName, e.status, e.payrollType, e.department, e.position, e.bank, e.salary]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `empleados_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (!user) return null;

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full py-6 flex-1">
          <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2">
                <ArrowLeft className="h-4 w-4 mr-1" /> Volver
              </Button>
              <h1 className="font-heading text-3xl font-bold text-foreground flex items-center gap-3">
                <Users className="h-8 w-8 text-gold" />
                Directorio de Empleados
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {stats.total} empleados registrados · {stats.active} activos · {stats.depts} departamentos
              </p>
            </div>
            <Button onClick={() => navigate("/rrhh/nomina")} className="bg-gold text-black hover:bg-gold/90">
              <Briefcase className="h-4 w-4 mr-2" /> Nómina y Cumplimiento TSS
            </Button>
          </div>

          {/* Stats cards */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Empleados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Activos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.active}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Departamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gold">{stats.depts}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre, código o puesto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los departamentos</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={payrollFilter} onValueChange={setPayrollFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Nómina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las nóminas</SelectItem>
                {payrollTypes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                <SelectItem value="Administrativo">Administrativo</SelectItem>
                <SelectItem value="Supervisor">Supervisor</SelectItem>
                <SelectItem value="Operador">Operador</SelectItem>
                <SelectItem value="Vigilante">Vigilante</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Exportar
            </Button>
            {canEdit && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Nuevo
              </Button>
            )}
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">Cargando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Departamento / Área</TableHead>
                      <TableHead>Puesto</TableHead>
                      <TableHead>Nómina</TableHead>
                      <TableHead>TSS</TableHead>
                      <TableHead>Estatus</TableHead>
                      {canEdit && <TableHead className="w-20">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canEdit ? 9 : 8} className="text-center text-muted-foreground py-8">
                          No se encontraron empleados
                        </TableCell>
                      </TableRow>
                    ) : filtered.map(emp => {
                      const catColor =
                        emp.category === "Administrativo" ? "bg-gold/20 text-gold-foreground border-gold" :
                        emp.category === "Supervisor" ? "bg-blue-500/20 text-blue-700 border-blue-500" :
                        emp.category === "Operador" ? "bg-purple-500/20 text-purple-700 border-purple-500" :
                        "bg-slate-500/20 text-slate-700 border-slate-500";
                      return (
                      <TableRow key={emp.employeeCode}>
                        <TableCell className="font-mono text-xs">{emp.employeeCode}</TableCell>
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            onClick={() => setViewing(emp)}
                            className="text-left hover:text-gold hover:underline inline-flex items-center gap-1.5"
                          >
                            {emp.fullName}
                            {findArmedRecord(emp) && <Shield className="h-3.5 w-3.5 text-amber-600" aria-label="Personal armado" />}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${catColor}`}>{emp.category || "—"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{emp.department}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{emp.position}</TableCell>
                        <TableCell className="text-xs">{emp.payrollType}</TableCell>
                        <TableCell>
                          {(emp as any).tssRegistered ? (
                            <Badge className="bg-green-600 text-xs">✓ TSS</Badge>
                          ) : emp.status === "Activo" ? (
                            <Badge className="bg-red-600 text-xs">Sin TSS</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">—</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={emp.status === "Activo" ? "bg-green-600" : "bg-red-600"}>
                            {emp.status}
                          </Badge>
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(emp)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(emp.employeeCode)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {!loading && <p className="text-xs text-muted-foreground p-3 border-t">{filtered.length} de {employees.length} empleados</p>}
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editing || creating} onOpenChange={o => { if (!o) { setEditing(null); setCreating(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{creating ? "Nuevo Empleado" : "Editar Empleado"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 py-2">
            <div className="md:col-span-2">
              <Label>Nombre completo</Label>
              <Input value={formData.fullName || ""} onChange={e => setFormData({ ...formData, fullName: e.target.value })} />
            </div>
            {creating && (
              <div>
                <Label>Código</Label>
                <Input value={formData.employeeCode || ""} onChange={e => setFormData({ ...formData, employeeCode: e.target.value })} placeholder="Auto si vacío" />
              </div>
            )}
            <div>
              <Label>Departamento</Label>
              <Input value={formData.department || ""} onChange={e => setFormData({ ...formData, department: e.target.value })} />
            </div>
            <div>
              <Label>Puesto</Label>
              <Input value={formData.position || ""} onChange={e => setFormData({ ...formData, position: e.target.value })} />
            </div>
            <div>
              <Label>Tipo de nómina</Label>
              <Select value={formData.payrollType || ""} onValueChange={v => setFormData({ ...formData, payrollType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrativo">Administrativo</SelectItem>
                  <SelectItem value="Operaciones">Operaciones</SelectItem>
                  <SelectItem value="Vgilantes Horas">Vigilantes Horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estatus</Label>
              <Select value={formData.status || "Activo"} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Banco</Label>
              <Input value={formData.bank || ""} onChange={e => setFormData({ ...formData, bank: e.target.value })} />
            </div>
            <div>
              <Label>Salario</Label>
              <Input type="number" value={formData.salary || ""} onChange={e => setFormData({ ...formData, salary: +e.target.value })} />
            </div>
            <div>
              <Label>Tarifa/hora</Label>
              <Input type="number" value={formData.hourlyRate || ""} onChange={e => setFormData({ ...formData, hourlyRate: +e.target.value })} />
            </div>
            <div>
              <Label>Fecha contratación</Label>
              <Input type="date" value={formData.hireDate || ""} onChange={e => setFormData({ ...formData, hireDate: e.target.value })} />
            </div>
            <div>
              <Label>Fecha nacimiento</Label>
              <Input type="date" value={(formData as any).birthDate || ""} onChange={e => setFormData({ ...formData, birthDate: e.target.value } as any)} />
            </div>
            <div>
              <Label>Cédula</Label>
              <Input value={(formData as any).cedula || (formData as any).tss || ""} onChange={e => setFormData({ ...formData, cedula: e.target.value } as any)} />
            </div>
            <div>
              <Label>Email corporativo</Label>
              <Input type="email" value={(formData as any).email || ""} onChange={e => setFormData({ ...formData, email: e.target.value } as any)} />
            </div>

            {/* ─── TSS Compliance ─── */}
            <div className="md:col-span-2 mt-2 p-3 border rounded bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <Label className="font-semibold">Cumplimiento TSS</Label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!(formData as any).tssRegistered}
                    onChange={e => setFormData({ ...formData, tssRegistered: e.target.checked, tssRegisteredAt: e.target.checked && !(formData as any).tssRegisteredAt ? new Date().toISOString() : (formData as any).tssRegisteredAt } as any)} />
                  <span>Registrado en TSS con descuentos de ley</span>
                </label>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Salario reportado a TSS</Label>
                  <Input type="number" value={(formData as any).tssReportedSalary || ""}
                    onChange={e => setFormData({ ...formData, tssReportedSalary: +e.target.value } as any)} />
                </div>
                <div>
                  <Label className="text-xs">Notas TSS</Label>
                  <Input value={(formData as any).tssNotes || ""}
                    onChange={e => setFormData({ ...formData, tssNotes: e.target.value } as any)} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setCreating(false); }}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" /> {creating ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail / Audit Dialog */}
      <Dialog open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.fullName}</DialogTitle>
          </DialogHeader>
          {viewing && (() => {
            const armed = findArmedRecord(viewing);
            return (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted rounded-lg p-3"><span className="text-xs text-muted-foreground block">Código</span><span className="font-mono">{viewing.employeeCode}</span></div>
                  <div className="bg-muted rounded-lg p-3"><span className="text-xs text-muted-foreground block">Estatus</span>{viewing.status}</div>
                  <div className="bg-muted rounded-lg p-3"><span className="text-xs text-muted-foreground block">Departamento</span>{viewing.department || "—"}</div>
                  <div className="bg-muted rounded-lg p-3"><span className="text-xs text-muted-foreground block">Puesto</span>{viewing.position || "—"}</div>
                  <div className="bg-muted rounded-lg p-3"><span className="text-xs text-muted-foreground block">Categoría</span>{viewing.category || "—"}</div>
                  <div className="bg-muted rounded-lg p-3"><span className="text-xs text-muted-foreground block">Nómina</span>{viewing.payrollType || "—"}</div>
                </div>

                {armed ? (
                  <div className="border-2 border-amber-200 bg-amber-50 rounded-lg p-4">
                    <h3 className="font-semibold text-amber-900 flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4" /> Personal Armado · Auditoría
                    </h3>
                    <div className="flex gap-3 flex-wrap mb-3">
                      {armed.photo && (
                        <div className="text-center">
                          <img src={armed.photo} alt={armed.name} className="w-24 h-24 rounded-lg object-cover border-2 border-amber-300" />
                          <p className="text-[10px] text-amber-700 mt-1">Vigilante</p>
                        </div>
                      )}
                      {armed.weaponPhoto && (
                        <div className="text-center">
                          <img src={armed.weaponPhoto} alt="Arma" className="w-24 h-24 rounded-lg object-cover border-2 border-amber-300" />
                          <p className="text-[10px] text-amber-700 mt-1">Arma asignada</p>
                        </div>
                      )}
                      {!armed.photo && !armed.weaponPhoto && (
                        <p className="text-xs text-amber-700">Sin fotos cargadas. Súbelas desde Personal Armado.</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white/70 rounded p-2"><span className="text-amber-700 block">Cliente / Puesto</span>{armed.client} · {armed.location}</div>
                      <div className="bg-white/70 rounded p-2"><span className="text-amber-700 block">Provincia</span>{armed.province || "—"}</div>
                      <div className="bg-white/70 rounded p-2"><span className="text-amber-700 block">Tipo de Arma</span>{armed.weaponType || "—"} {armed.weaponBrand || ""}</div>
                      <div className="bg-white/70 rounded p-2"><span className="text-amber-700 block">Serial</span><span className="font-mono">{armed.weaponSerial || "—"}</span></div>
                      <div className="bg-white/70 rounded p-2"><span className="text-amber-700 block">Munición</span>{armed.weaponCaliber || "—"} ({armed.ammunitionCount} cápsulas)</div>
                      <div className="bg-white/70 rounded p-2"><span className="text-amber-700 block">Estado Arma</span>{armed.weaponCondition || "—"}</div>
                      <div className="bg-white/70 rounded p-2"><span className="text-amber-700 block">Supervisor</span>{armed.supervisor || "—"}</div>
                      <div className="bg-white/70 rounded p-2"><span className="text-amber-700 block">Licencia</span>{armed.licenseNumber || "—"} {armed.licenseExpiry ? `(vence ${armed.licenseExpiry})` : ""}</div>
                    </div>
                    {(user?.isAdmin || user?.department === "Operaciones") && (
                      <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate(`/operaciones`)}>
                        Ver en Personal Armado
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="border border-border bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
                    Este empleado no figura en Personal Armado.
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default EmployeeDirectory;
