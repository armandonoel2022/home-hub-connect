import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Shirt, Flashlight, Plus, Trash2, Package, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  uniformItemsApi,
  uniformAssignmentsApi,
  flashlightsApi,
  employeesApi,
  isApiConfigured,
} from "@/lib/api";
import type {
  UniformItem,
  UniformAssignment,
  UniformType,
  UniformSize,
  FlashlightItem,
  FlashlightStatus,
} from "@/lib/types";

const UNIFORM_TYPES: UniformType[] = [
  "Camisa",
  "Pantalón",
  "Gorra",
  "Chaleco",
  "Bota",
  "Cinturón",
  "Otro",
];
const UNIFORM_SIZES: UniformSize[] = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const FLASH_STATUS: FlashlightStatus[] = [
  "Disponible",
  "Asignada",
  "En reparación",
  "Dada de baja",
];

type Tab = "stock" | "entregas" | "linternas";

interface Emp {
  employeeCode: string;
  fullName: string;
  department?: string;
  status?: string;
}

export default function OperationsInventory() {
  const { user } = useAuth();
  const { toast } = useToast();

  const canView =
    user?.isAdmin ||
    user?.department === "Operaciones" ||
    user?.department === "Gerencia General" ||
    user?.department === "Administración";

  const [tab, setTab] = useState<Tab>("stock");
  const [items, setItems] = useState<UniformItem[]>([]);
  const [assigns, setAssigns] = useState<UniformAssignment[]>([]);
  const [flashes, setFlashes] = useState<FlashlightItem[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);

  const reload = async () => {
    if (!isApiConfigured()) return;
    try {
      const [a, b, c, e] = await Promise.all([
        uniformItemsApi.getAll().catch(() => []),
        uniformAssignmentsApi.getAll().catch(() => []),
        flashlightsApi.getAll().catch(() => []),
        employeesApi.getAll({ status: "Activo" }).catch(() => []),
      ]);
      setItems(a);
      setAssigns(b);
      setFlashes(c);
      setEmployees(e as Emp[]);
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    reload();
  }, []);

  if (!canView) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-heading font-bold text-lg text-card-foreground">
              Acceso Restringido
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Solo Operaciones, Administración o Gerencia General
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold text-card-foreground flex items-center gap-2">
              <Package className="h-6 w-6 text-gold" />
              Inventario Operaciones — Uniformes y Linternas
            </h1>
            <p className="text-sm text-muted-foreground">
              Stock, entregas y asignación trazable por agente para auditoría
            </p>
          </div>
        </header>

        <div className="flex gap-2 border-b border-border">
          {[
            { id: "stock" as Tab, label: "Stock Uniformes", icon: Shirt },
            { id: "entregas" as Tab, label: "Entregas a Agentes", icon: Package },
            { id: "linternas" as Tab, label: "Linternas", icon: Flashlight },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 -mb-px border-b-2 text-sm font-medium flex items-center gap-2 transition ${
                tab === t.id
                  ? "border-gold text-gold"
                  : "border-transparent text-muted-foreground hover:text-card-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {!isApiConfigured() && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            API no configurada. Este módulo requiere el backend SafeOne corriendo
            en el servidor local (puerto 3000) para persistir cambios.
          </div>
        )}

        {tab === "stock" && (
          <StockTab items={items} reload={reload} user={user} toast={toast} />
        )}
        {tab === "entregas" && (
          <DeliveriesTab
            items={items}
            assigns={assigns}
            employees={employees}
            reload={reload}
            user={user}
            toast={toast}
          />
        )}
        {tab === "linternas" && (
          <FlashlightsTab
            flashes={flashes}
            employees={employees}
            reload={reload}
            user={user}
            toast={toast}
          />
        )}
      </div>
    </AppLayout>
  );
}

/* ─── Stock Tab ─── */
function StockTab({
  items,
  reload,
  user,
  toast,
}: {
  items: UniformItem[];
  reload: () => void;
  user: any;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [form, setForm] = useState<Partial<UniformItem>>({
    type: "Camisa",
    size: "M",
    quantityInStock: 0,
  });
  const [adding, setAdding] = useState(false);

  const add = async () => {
    if (!form.type || !form.size) return;
    setAdding(true);
    try {
      const now = new Date().toISOString();
      await uniformItemsApi.create({
        type: form.type as UniformType,
        size: form.size as UniformSize,
        quantityInStock: Number(form.quantityInStock) || 0,
        unitCost: form.unitCost ? Number(form.unitCost) : undefined,
        notes: form.notes || "",
        createdAt: now,
        updatedAt: now,
      });
      toast({ title: "Stock añadido" });
      setForm({ type: "Camisa", size: "M", quantityInStock: 0 });
      reload();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este registro de stock?")) return;
    await uniformItemsApi.delete(id);
    toast({ title: "Eliminado" });
    reload();
  };

  const updateQty = async (it: UniformItem, qty: number) => {
    await uniformItemsApi.update(it.id, {
      quantityInStock: qty,
      updatedAt: new Date().toISOString(),
    });
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-heading font-semibold text-sm text-card-foreground mb-3">
          Añadir stock
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <select
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as UniformType })}
          >
            {UNIFORM_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            value={form.size}
            onChange={(e) => setForm({ ...form, size: e.target.value as UniformSize })}
          >
            {UNIFORM_SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            placeholder="Cantidad"
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            value={form.quantityInStock || ""}
            onChange={(e) =>
              setForm({ ...form, quantityInStock: parseInt(e.target.value) || 0 })
            }
          />
          <input
            type="number"
            min={0}
            placeholder="Costo unit. (opc)"
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            value={form.unitCost || ""}
            onChange={(e) => setForm({ ...form, unitCost: parseFloat(e.target.value) || 0 })}
          />
          <button
            onClick={add}
            disabled={adding}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gold text-charcoal-dark font-semibold text-sm hover:bg-gold/90"
          >
            <Plus className="h-4 w-4" />
            Añadir
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Talla</th>
              <th className="text-right px-3 py-2">Stock</th>
              <th className="text-right px-3 py-2">Costo unit.</th>
              <th className="text-left px-3 py-2">Notas</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Sin registros
                </td>
              </tr>
            )}
            {items.map((it) => (
              <tr key={it.id} className="border-t border-border">
                <td className="px-3 py-2">{it.type}</td>
                <td className="px-3 py-2 font-mono">{it.size}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    defaultValue={it.quantityInStock}
                    className="w-20 px-2 py-1 rounded border border-border bg-background text-right"
                    onBlur={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v !== it.quantityInStock) updateQty(it, v);
                    }}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  {it.unitCost ? `RD$ ${it.unitCost.toLocaleString()}` : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{it.notes || "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => remove(it.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Deliveries Tab ─── */
function DeliveriesTab({
  items,
  assigns,
  employees,
  reload,
  user,
  toast,
}: {
  items: UniformItem[];
  assigns: UniformAssignment[];
  employees: Emp[];
  reload: () => void;
  user: any;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [form, setForm] = useState<{
    employeeCode: string;
    itemId: string;
    quantity: number;
    condition: UniformAssignment["condition"];
    notes: string;
  }>({
    employeeCode: "",
    itemId: "",
    quantity: 1,
    condition: "Nuevo",
    notes: "",
  });

  const submit = async () => {
    const emp = employees.find((e) => e.employeeCode === form.employeeCode);
    const item = items.find((i) => i.id === form.itemId);
    if (!emp || !item) {
      toast({ title: "Selecciona agente y uniforme", variant: "destructive" });
      return;
    }
    if (item.quantityInStock < form.quantity) {
      toast({
        title: "Stock insuficiente",
        description: `Disponible: ${item.quantityInStock}`,
        variant: "destructive",
      });
      return;
    }
    try {
      await uniformAssignmentsApi.create({
        uniformItemId: item.id,
        uniformType: item.type,
        uniformSize: item.size,
        employeeCode: emp.employeeCode,
        employeeName: emp.fullName,
        quantity: form.quantity,
        deliveredAt: new Date().toISOString(),
        deliveredBy: user?.fullName || "—",
        condition: form.condition,
        notes: form.notes,
        createdAt: new Date().toISOString(),
      });
      await uniformItemsApi.update(item.id, {
        quantityInStock: item.quantityInStock - form.quantity,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: "Entrega registrada" });
      setForm({ ...form, quantity: 1, notes: "" });
      reload();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const remove = async (a: UniformAssignment) => {
    if (!confirm("¿Anular esta entrega? El stock se restaurará.")) return;
    await uniformAssignmentsApi.delete(a.id);
    const it = items.find((i) => i.id === a.uniformItemId);
    if (it)
      await uniformItemsApi.update(it.id, {
        quantityInStock: it.quantityInStock + a.quantity,
        updatedAt: new Date().toISOString(),
      });
    toast({ title: "Entrega anulada" });
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-heading font-semibold text-sm text-card-foreground mb-3">
          Registrar entrega
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <select
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm md:col-span-2"
            value={form.employeeCode}
            onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
          >
            <option value="">— Agente —</option>
            {employees.map((e) => (
              <option key={e.employeeCode} value={e.employeeCode}>
                {e.employeeCode} · {e.fullName}
              </option>
            ))}
          </select>
          <select
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm md:col-span-2"
            value={form.itemId}
            onChange={(e) => setForm({ ...form, itemId: e.target.value })}
          >
            <option value="">— Uniforme (tipo/talla) —</option>
            {items.map((i) => (
              <option key={i.id} value={i.id} disabled={i.quantityInStock === 0}>
                {i.type} {i.size} · stock {i.quantityInStock}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            value={form.quantity}
            onChange={(e) =>
              setForm({ ...form, quantity: Math.max(1, parseInt(e.target.value) || 1) })
            }
          />
          <select
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            value={form.condition}
            onChange={(e) =>
              setForm({ ...form, condition: e.target.value as UniformAssignment["condition"] })
            }
          >
            <option>Nuevo</option>
            <option>Bueno</option>
            <option>Regular</option>
            <option>Reemplazar</option>
          </select>
          <input
            type="text"
            placeholder="Notas (opcional)"
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm md:col-span-5"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button
            onClick={submit}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gold text-charcoal-dark font-semibold text-sm hover:bg-gold/90"
          >
            <Plus className="h-4 w-4" /> Entregar
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Fecha</th>
              <th className="text-left px-3 py-2">Agente</th>
              <th className="text-left px-3 py-2">Uniforme</th>
              <th className="text-right px-3 py-2">Cant.</th>
              <th className="text-left px-3 py-2">Condición</th>
              <th className="text-left px-3 py-2">Entregado por</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {assigns.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Sin entregas registradas
                </td>
              </tr>
            )}
            {assigns
              .slice()
              .sort((a, b) => (b.deliveredAt || "").localeCompare(a.deliveredAt || ""))
              .map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {a.deliveredAt?.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{a.employeeName}</div>
                    <div className="text-xs text-muted-foreground">{a.employeeCode}</div>
                  </td>
                  <td className="px-3 py-2">
                    {a.uniformType} <span className="font-mono">{a.uniformSize}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{a.quantity}</td>
                  <td className="px-3 py-2">{a.condition}</td>
                  <td className="px-3 py-2 text-muted-foreground">{a.deliveredBy}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => remove(a)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Flashlights Tab ─── */
function FlashlightsTab({
  flashes,
  employees,
  reload,
  user,
  toast,
}: {
  flashes: FlashlightItem[];
  employees: Emp[];
  reload: () => void;
  user: any;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [form, setForm] = useState<Partial<FlashlightItem>>({
    code: "",
    brand: "",
    model: "",
    serial: "",
    status: "Disponible",
    condition: "Nueva",
  });

  const nextCode = useMemo(() => {
    const max = flashes
      .map((f) => parseInt(f.code.replace(/\D/g, "")) || 0)
      .reduce((a, b) => Math.max(a, b), 0);
    return `SSC-LIN-${String(max + 1).padStart(4, "0")}`;
  }, [flashes]);

  const add = async () => {
    if (!form.brand || !form.model) {
      toast({ title: "Marca y modelo requeridos", variant: "destructive" });
      return;
    }
    const now = new Date().toISOString();
    await flashlightsApi.create({
      code: form.code || nextCode,
      brand: form.brand!,
      model: form.model!,
      serial: form.serial || "",
      status: (form.status as FlashlightStatus) || "Disponible",
      condition: (form.condition as FlashlightItem["condition"]) || "Nueva",
      notes: form.notes || "",
      createdAt: now,
      updatedAt: now,
    });
    toast({ title: "Linterna registrada" });
    setForm({ code: "", brand: "", model: "", serial: "", status: "Disponible", condition: "Nueva" });
    reload();
  };

  const assign = async (f: FlashlightItem, employeeCode: string) => {
    const emp = employees.find((e) => e.employeeCode === employeeCode);
    await flashlightsApi.update(f.id, {
      assignedToCode: emp?.employeeCode || "",
      assignedToName: emp?.fullName || "",
      assignedAt: new Date().toISOString(),
      assignedBy: user?.fullName || "—",
      status: emp ? "Asignada" : "Disponible",
      updatedAt: new Date().toISOString(),
    });
    reload();
  };

  const setStatus = async (f: FlashlightItem, status: FlashlightStatus) => {
    await flashlightsApi.update(f.id, { status, updatedAt: new Date().toISOString() });
    reload();
  };

  const remove = async (f: FlashlightItem) => {
    if (!confirm("¿Dar de baja esta linterna?")) return;
    await flashlightsApi.delete(f.id);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-heading font-semibold text-sm text-card-foreground mb-3">
          Registrar linterna
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder={`Código (${nextCode})`}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
            value={form.code || ""}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <input
            type="text"
            placeholder="Marca"
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            value={form.brand || ""}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
          />
          <input
            type="text"
            placeholder="Modelo"
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            value={form.model || ""}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
          />
          <input
            type="text"
            placeholder="Serial (opc)"
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            value={form.serial || ""}
            onChange={(e) => setForm({ ...form, serial: e.target.value })}
          />
          <select
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            value={form.condition}
            onChange={(e) =>
              setForm({ ...form, condition: e.target.value as FlashlightItem["condition"] })
            }
          >
            <option>Nueva</option>
            <option>Buena</option>
            <option>Regular</option>
            <option>Reemplazar</option>
          </select>
          <button
            onClick={add}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gold text-charcoal-dark font-semibold text-sm hover:bg-gold/90"
          >
            <Plus className="h-4 w-4" /> Añadir
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Código</th>
              <th className="text-left px-3 py-2">Marca / Modelo</th>
              <th className="text-left px-3 py-2">Serial</th>
              <th className="text-left px-3 py-2">Condición</th>
              <th className="text-left px-3 py-2">Estado</th>
              <th className="text-left px-3 py-2">Asignada a</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {flashes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Sin linternas registradas
                </td>
              </tr>
            )}
            {flashes.map((f) => (
              <tr key={f.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono">{f.code}</td>
                <td className="px-3 py-2">
                  {f.brand} {f.model}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{f.serial || "—"}</td>
                <td className="px-3 py-2">{f.condition}</td>
                <td className="px-3 py-2">
                  <select
                    value={f.status}
                    onChange={(e) => setStatus(f, e.target.value as FlashlightStatus)}
                    className="px-2 py-1 rounded border border-border bg-background text-xs"
                  >
                    {FLASH_STATUS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={f.assignedToCode || ""}
                    onChange={(e) => assign(f, e.target.value)}
                    className="px-2 py-1 rounded border border-border bg-background text-xs max-w-[200px]"
                  >
                    <option value="">— Sin asignar —</option>
                    {employees.map((e) => (
                      <option key={e.employeeCode} value={e.employeeCode}>
                        {e.fullName}
                      </option>
                    ))}
                  </select>
                  {f.assignedAt && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {f.assignedAt.slice(0, 10)} · {f.assignedBy}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => remove(f)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
