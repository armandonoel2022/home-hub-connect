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
  Building2, Briefcase, Download,
} from "lucide-react";

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
          <div className="mb-6">
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
                      <TableHead>Departamento</TableHead>
                      <TableHead>Puesto</TableHead>
                      <TableHead>Nómina</TableHead>
                      <TableHead>Estatus</TableHead>
                      {canEdit && <TableHead className="w-20">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground py-8">
                          No se encontraron empleados
                        </TableCell>
                      </TableRow>
                    ) : filtered.map(emp => (
                      <TableRow key={emp.employeeCode}>
                        <TableCell className="font-mono text-xs">{emp.employeeCode}</TableCell>
                        <TableCell className="font-medium">{emp.fullName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{emp.department}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{emp.position}</TableCell>
                        <TableCell className="text-xs">{emp.payrollType}</TableCell>
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
                    ))}
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
              <Input type="date" value={formData.birthday || ""} onChange={e => setFormData({ ...formData, birthday: e.target.value })} />
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
    </AppLayout>
  );
};

export default EmployeeDirectory;
