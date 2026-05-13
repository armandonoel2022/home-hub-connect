import { useState, useRef, useEffect, useMemo, lazy, Suspense } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useArmedPersonnel } from "@/hooks/useApiHooks";
import type { ArmedPersonnel, PersonnelTransfer, ShiftType } from "@/lib/types";
import { Search, Plus, User, MapPin, X, Phone, Upload, Image, Lock, Trash2, Pencil, Map, List, AlertTriangle, BarChart3, ArrowRightLeft, History, Shield, ChevronDown, ChevronRight, Clock, Package, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { parseArmedPersonnelXlsx, type ImportRow } from "@/lib/armedPersonnelXlsxImport";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { loadFixedAssets, type FixedAsset } from "@/lib/fixedAssetsData";
import { buildWeaponAssetMap, getLinkingStats, type LinkedWeaponAsset } from "@/lib/weaponAssetLinking";


const statusColors: Record<string, string> = {
  Activo: "bg-emerald-50 text-emerald-700",
  Licencia: "bg-amber-50 text-amber-700",
  Inactivo: "bg-gray-100 text-gray-500",
};

const conditionColors: Record<string, string> = {
  "En buenas condiciones": "bg-emerald-50 text-emerald-700",
  "En condiciones": "bg-emerald-50 text-emerald-700",
  "Falta de mantenimiento": "bg-amber-50 text-amber-700",
  "Arma inoperativa": "bg-red-50 text-red-700",
  "El seguro no sirve": "bg-red-50 text-red-700",
  "No esta en condiciones": "bg-red-50 text-red-700",
  "Arma en fiscalia": "bg-purple-50 text-purple-700",
  "Arma no estaba disponible": "bg-gray-100 text-gray-500",
};

const CHART_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6", "#ec4899", "#6366f1", "#14b8a6"];

const PROVINCES = [
  "Santiago", "Santo Domingo Oeste", "Santo Domingo Este",
  "Distrito Nacional Este", "Distrito Nacional Oeste", "Distrito Nacional Norte",
  "San Pedro de Macoris Este", "Este",
];

const WEAPON_CONDITIONS = [
  "En buenas condiciones", "En condiciones", "Falta de mantenimiento",
  "Arma inoperativa", "El seguro no sirve", "No esta en condiciones",
  "Arma en fiscalia", "Arma no estaba disponible",
];

function parseCoords(coords: string): [number, number] | null {
  if (!coords || !coords.includes(",")) return null;
  const parts = coords.split(",").map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return [parts[0], parts[1]];
  return null;
}

// ─── Map Component ───
const LazyMap = lazy(() => import("../components/PersonnelMapView"));

function PersonnelMap({ personnel, onTransfer }: { personnel: ArmedPersonnel[]; onTransfer?: (p: ArmedPersonnel) => void }) {
  const withCoords = personnel.filter(p => parseCoords(p.coordinates));

  if (withCoords.length === 0) return (
    <div className="h-[500px] flex items-center justify-center bg-muted rounded-xl">
      <div className="text-center">
        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">No hay personal con coordenadas registradas</p>
      </div>
    </div>
  );

  return (
    <Suspense fallback={<div className="h-[500px] flex items-center justify-center bg-muted rounded-xl"><p className="text-muted-foreground">Cargando mapa...</p></div>}>
      <LazyMap personnel={withCoords} onTransfer={onTransfer} />
    </Suspense>
  );
}

// ─── Dashboard Component ───
function PersonnelDashboard({ personnel, onFilter, onAssign }: { personnel: ArmedPersonnel[]; onFilter?: (filters: { province?: string; condition?: string; search?: string }) => void; onAssign?: (p: ArmedPersonnel) => void }) {
  const byProvince = useMemo(() => {
    const map: Record<string, number> = {};
    personnel.forEach(p => { map[p.province || "Sin provincia"] = (map[p.province || "Sin provincia"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [personnel]);

  const byClient = useMemo(() => {
    const map: Record<string, number> = {};
    personnel.forEach(p => { map[p.client || "Sin cliente"] = (map[p.client || "Sin cliente"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [personnel]);

  const byCondition = useMemo(() => {
    const map: Record<string, number> = {};
    personnel.forEach(p => { map[p.weaponCondition || "Sin estado"] = (map[p.weaponCondition || "Sin estado"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [personnel]);

  const byWeaponType = useMemo(() => {
    const map: Record<string, number> = {};
    personnel.forEach(p => { if (p.weaponType) map[p.weaponType] = (map[p.weaponType] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [personnel]);

  const byLethal = useMemo(() => {
    let letal = 0, noLetal = 0, sinArma = 0;
    personnel.forEach(p => {
      if (p.weaponCaliber === "Letal") letal++;
      else if (p.weaponCaliber === "No letal") noLetal++;
      else sinArma++;
    });
    return [
      { name: "Letal", value: letal },
      { name: "No letal", value: noLetal },
      ...(sinArma > 0 ? [{ name: "Sin arma", value: sinArma }] : []),
    ];
  }, [personnel]);

  // Locations with no assigned personnel (posts without a name)
  const unfilledPosts = useMemo(() => {
    return personnel.filter(p => !p.name || p.name.trim() === "");
  }, [personnel]);

  const totalAmmo = personnel.reduce((s, p) => s + (p.ammunitionCount || 0), 0);
  const withCoords = personnel.filter(p => parseCoords(p.coordinates)).length;
  const needsMaint = personnel.filter(p => p.weaponCondition === "Falta de mantenimiento").length;
  const goodCond = personnel.filter(p => p.weaponCondition?.includes("buenas") || p.weaponCondition === "En condiciones").length;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Personal", value: personnel.length, color: "bg-card border-border", onClick: () => onFilter?.({}) },
          { label: "Buen Estado", value: goodCond, color: "bg-emerald-50 border-emerald-200 text-emerald-700", onClick: () => onFilter?.({ condition: "En buenas condiciones" }) },
          { label: "Mantenimiento", value: needsMaint, color: "bg-amber-50 border-amber-200 text-amber-700", onClick: () => onFilter?.({ condition: "Falta de mantenimiento" }) },
          { label: "Con Ubicación", value: withCoords, color: "bg-blue-50 border-blue-200 text-blue-700", onClick: () => onFilter?.({}) },
          { label: "Cápsulas Total", value: totalAmmo, color: "bg-purple-50 border-purple-200 text-purple-700", onClick: () => onFilter?.({}) },
          { label: "Puestos Vacíos", value: unfilledPosts.length, color: unfilledPosts.length > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-card border-border", onClick: () => onFilter?.({}) },
        ].map(kpi => (
          <button key={kpi.label} onClick={kpi.onClick} className={`border rounded-xl p-3 text-center cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all ${kpi.color}`}>
            <p className="text-2xl font-bold">{kpi.value}</p>
            <p className="text-xs">{kpi.label}</p>
          </button>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Condition Pie */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-heading font-semibold text-sm text-card-foreground mb-3">Estado de Armas</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={byCondition} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label labelLine={false} fontSize={10} className="cursor-pointer" onClick={(entry: any) => onFilter?.({ condition: entry.name })}>
                {byCondition.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} className="cursor-pointer" />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Lethal Pie */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-heading font-semibold text-sm text-card-foreground mb-3">Tipo de Munición</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={byLethal} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                <Cell fill="#ef4444" />
                <Cell fill="#3b82f6" />
                {byLethal.length > 2 && <Cell fill="#9ca3af" />}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Province Bar */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-heading font-semibold text-sm text-card-foreground mb-3">Personal por Provincia</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byProvince} layout="vertical">
              <XAxis type="number" fontSize={10} />
              <YAxis type="category" dataKey="name" width={140} fontSize={10} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} className="cursor-pointer" onClick={(entry: any) => onFilter?.({ province: entry.name })} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Client Bar */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-heading font-semibold text-sm text-card-foreground mb-3">Personal por Cliente (Top 10)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byClient.slice(0, 10)} layout="vertical">
              <XAxis type="number" fontSize={10} />
              <YAxis type="category" dataKey="name" width={160} fontSize={10} />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} className="cursor-pointer" onClick={(entry: any) => onFilter?.({ search: entry.name })} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weapon Types */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-heading font-semibold text-sm text-card-foreground mb-3">Tipos de Arma</h3>
        <div className="flex flex-wrap gap-3">
          {byWeaponType.map((wt, i) => (
            <button key={wt.name} onClick={() => onFilter?.({ search: wt.name })} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 hover:bg-muted/80 hover:shadow-sm transition-all cursor-pointer">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="text-sm font-medium text-card-foreground">{wt.name}</span>
              <span className="text-sm font-bold text-foreground">{wt.value}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Unfilled Posts */}
      {unfilledPosts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-heading font-semibold text-sm text-red-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Puestos sin Vigilante Asignado ({unfilledPosts.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unfilledPosts.map((p) => (
              <div key={p.id} className="bg-white rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-red-800">{p.client}</span>
                  <span className="text-red-600"> — {p.location}</span>
                  <span className="text-red-400 text-xs block">{p.province}</span>
                </div>
                {onAssign && (
                  <button onClick={() => onAssign(p)} title="Asignar vigilante a este puesto"
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors">
                    <Shield className="h-3 w-3" /> Asignar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Transfer Modal ───
function TransferModal({ person, allPersonnel, onClose, onTransfer }: {
  person: ArmedPersonnel;
  allPersonnel: ArmedPersonnel[];
  onClose: () => void;
  onTransfer: (transfer: PersonnelTransfer, replacementId?: string) => void;
}) {
  const [toClient, setToClient] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [reason, setReason] = useState("");
  const [replacementId, setReplacementId] = useState("");
  const [shiftType, setShiftType] = useState<ShiftType>(person.shiftType || "12h");
  const [shiftHours, setShiftHours] = useState<number>(person.shiftHours || 12);
  const [shiftNotes, setShiftNotes] = useState(person.shiftNotes || "");

  const availableReplacements = allPersonnel.filter(p =>
    p.id !== person.id && p.status === "Activo" && !(p.client === person.client && p.location === person.location)
  );

  const handleSubmit = () => {
    if (!toClient || !toLocation) return;
    const transfer: PersonnelTransfer = {
      id: `TR-${Date.now()}`,
      date: new Date().toISOString(),
      fromClient: person.client,
      fromLocation: person.location,
      toClient,
      toLocation,
      reason: `${reason}${shiftType ? ` | Turno: ${shiftType} (${shiftHours}h)` : ""}${shiftNotes ? ` | Nota turno: ${shiftNotes}` : ""}`,
      replacedBy: replacementId ? allPersonnel.find(p => p.id === replacementId)?.name : undefined,
      authorizedBy: "Admin",
    };
    onTransfer(transfer, replacementId || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-heading font-bold text-lg text-card-foreground flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" /> Transferir Personal
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Mover a {person.name || person.employeeCode} de su puesto actual</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current assignment */}
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Puesto Actual</p>
            <p className="font-medium text-card-foreground">{person.client} — {person.location}</p>
            <p className="text-xs text-muted-foreground">{person.province}</p>
            {person.shiftType && <p className="text-xs text-muted-foreground mt-1">Turno actual: {person.shiftType} ({person.shiftHours || 12}h)</p>}
          </div>

          {/* New assignment */}
          <div>
            <label className="text-sm font-medium text-card-foreground block mb-1.5">Nuevo Cliente *</label>
            <input type="text" value={toClient} onChange={e => setToClient(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="Nombre del cliente" />
          </div>
          <div>
            <label className="text-sm font-medium text-card-foreground block mb-1.5">Nueva Ubicación / Puesto *</label>
            <input type="text" value={toLocation} onChange={e => setToLocation(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="Nombre del puesto" />
          </div>

          {/* Shift configuration */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
            <label className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Configuración de Turno
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-blue-700 block mb-1">Tipo de Turno</label>
                <select value={shiftType} onChange={e => {
                  const val = e.target.value as ShiftType;
                  setShiftType(val);
                  if (val === "12h") setShiftHours(12);
                  else if (val === "24h") setShiftHours(24);
                  else if (val === "24h+") setShiftHours(36);
                }} className="w-full px-2 py-2 rounded-lg bg-white border border-blue-300 text-foreground text-sm outline-none">
                  <option value="12h">12 horas</option>
                  <option value="24h">24 horas</option>
                  <option value="24h+">24+ horas (extendido)</option>
                  <option value="Personalizado">Personalizado</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-blue-700 block mb-1">Horas del turno</label>
                <input type="number" min={1} max={72} value={shiftHours} onChange={e => setShiftHours(Number(e.target.value))}
                  className="w-full px-2 py-2 rounded-lg bg-white border border-blue-300 text-foreground text-sm outline-none" />
              </div>
            </div>
            {shiftType === "24h+" && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">⚠️ Turnos de 24+ horas requieren consentimiento documentado del vigilante</p>
            )}
            <div>
              <label className="text-xs text-blue-700 block mb-1">Notas del turno</label>
              <input type="text" value={shiftNotes} onChange={e => setShiftNotes(e.target.value)}
                className="w-full px-2 py-2 rounded-lg bg-white border border-blue-300 text-foreground text-sm outline-none"
                placeholder="Ej: Vigilante aceptó turno extendido, rotación semanal..." />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-card-foreground block mb-1.5">Razón del Traslado</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" placeholder="Motivo del movimiento..." />
          </div>

          {/* Replacement */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <label className="text-sm font-medium text-amber-800 block mb-1.5 flex items-center gap-1.5">
              <Shield className="h-4 w-4" /> ¿Quién cubrirá el puesto de {person.location}?
            </label>
            <select value={replacementId} onChange={e => setReplacementId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-white border border-amber-300 text-foreground text-sm outline-none">
              <option value="">Sin reemplazo (puesto quedará vacante)</option>
              {availableReplacements.map(r => (
                <option key={r.id} value={r.id}>{r.name || r.employeeCode} — {r.client} / {r.location}{r.shiftType ? ` (${r.shiftType})` : ""}</option>
              ))}
            </select>
            {!replacementId && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> El puesto quedará sin cobertura
              </p>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-border flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={!toClient || !toLocation} className="btn-gold text-sm disabled:opacity-50 disabled:cursor-not-allowed">Confirmar Traslado</button>
        </div>
      </div>
    </div>
  );
}

// ─── Assign-To-Vacant-Post Modal ───
function AssignVigilanteModal({ vacantPost, allPersonnel, onClose, onAssign }: {
  vacantPost: ArmedPersonnel;
  allPersonnel: ArmedPersonnel[];
  onClose: () => void;
  onAssign: (vigilanteId: string, mode: "move" | "new", reason: string, shiftType: ShiftType, shiftHours: number, shiftNotes: string, newPersonData?: Partial<ArmedPersonnel>) => void;
}) {
  const [mode, setMode] = useState<"move" | "new">("move");
  const [vigilanteId, setVigilanteId] = useState("");
  const [reason, setReason] = useState("");
  const [shiftType, setShiftType] = useState<ShiftType>("12h");
  const [shiftHours, setShiftHours] = useState<number>(12);
  const [shiftNotes, setShiftNotes] = useState("");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");

  const availableVigilantes = allPersonnel.filter(p =>
    p.id !== vacantPost.id && p.status === "Activo" && p.name && p.name.trim() !== ""
  );

  const canSubmit = mode === "move" ? !!vigilanteId : (!!newName.trim() && !!newCode.trim());

  const handleSubmit = () => {
    if (!canSubmit) return;
    onAssign(
      vigilanteId,
      mode,
      reason,
      shiftType,
      shiftHours,
      shiftNotes,
      mode === "new" ? { name: newName.trim(), employeeCode: newCode.trim() } : undefined
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-heading font-bold text-lg text-card-foreground flex items-center gap-2">
              <Shield className="h-5 w-5" /> Asignar Vigilante
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Cubrir puesto vacante</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-600">Puesto Vacante</p>
            <p className="font-medium text-red-800">{vacantPost.client} — {vacantPost.location}</p>
            <p className="text-xs text-red-600">{vacantPost.province}</p>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setMode("move")}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "move" ? "bg-primary text-primary-foreground" : "bg-muted text-card-foreground hover:bg-border"}`}>
              Mover existente
            </button>
            <button onClick={() => setMode("new")}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "new" ? "bg-primary text-primary-foreground" : "bg-muted text-card-foreground hover:bg-border"}`}>
              Vigilante nuevo
            </button>
          </div>

          {mode === "move" ? (
            <div>
              <label className="text-sm font-medium text-card-foreground block mb-1.5">Vigilante a asignar *</label>
              <select value={vigilanteId} onChange={e => setVigilanteId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm outline-none">
                <option value="">Seleccionar vigilante...</option>
                {availableVigilantes.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.employeeCode}) — {v.client}/{v.location}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Su puesto actual quedará vacante.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-card-foreground block mb-1.5">Código de Empleado *</label>
                <input type="text" value={newCode} onChange={e => setNewCode(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm outline-none"
                  placeholder="EMP-XXX" />
              </div>
              <div>
                <label className="text-sm font-medium text-card-foreground block mb-1.5">Nombre del vigilante *</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm outline-none"
                  placeholder="Nombre completo" />
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
            <label className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Configuración de Turno
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-blue-700 block mb-1">Tipo de Turno</label>
                <select value={shiftType} onChange={e => {
                  const val = e.target.value as ShiftType;
                  setShiftType(val);
                  if (val === "12h") setShiftHours(12);
                  else if (val === "24h") setShiftHours(24);
                  else if (val === "24h+") setShiftHours(36);
                }} className="w-full px-2 py-2 rounded-lg bg-white border border-blue-300 text-foreground text-sm outline-none">
                  <option value="12h">12 horas</option>
                  <option value="24h">24 horas</option>
                  <option value="24h+">24+ horas (extendido)</option>
                  <option value="Personalizado">Personalizado</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-blue-700 block mb-1">Horas del turno</label>
                <input type="number" min={1} max={72} value={shiftHours} onChange={e => setShiftHours(Number(e.target.value))}
                  className="w-full px-2 py-2 rounded-lg bg-white border border-blue-300 text-foreground text-sm outline-none" />
              </div>
            </div>
            <div>
              <label className="text-xs text-blue-700 block mb-1">Notas del turno</label>
              <input type="text" value={shiftNotes} onChange={e => setShiftNotes(e.target.value)}
                className="w-full px-2 py-2 rounded-lg bg-white border border-blue-300 text-foreground text-sm outline-none"
                placeholder="Observaciones..." />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-card-foreground block mb-1.5">Razón / Observaciones</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm outline-none resize-none"
              placeholder="Motivo de asignación..." />
          </div>
        </div>

        <div className="p-5 border-t border-border flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={!canSubmit} className="btn-gold text-sm disabled:opacity-50 disabled:cursor-not-allowed">Confirmar Asignación</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
const OperationsPage = () => {
  const { user } = useAuth();
  const { data: personnel, setData: setPersonnel, create: createPersonnel, update: updatePersonnel, remove: removePersonnel } = useArmedPersonnel();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ArmedPersonnel | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<ArmedPersonnel>>({ status: "Activo" });
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [viewMode, setViewMode] = useState<"dashboard" | "list" | "map">("dashboard");
  const [filterProvince, setFilterProvince] = useState("");
  const [filterCondition, setFilterCondition] = useState("");
  const [transferTarget, setTransferTarget] = useState<ArmedPersonnel | null>(null);
  const [assignTarget, setAssignTarget] = useState<ArmedPersonnel | null>(null);
  const [filterLinking, setFilterLinking] = useState<"" | "linked" | "unlinked" | "withWeapon">("");
  const [showDeletedLog, setShowDeletedLog] = useState(false);
  const [showTransferLog, setShowTransferLog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportRow[] | null>(null);
  const [importError, setImportError] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, phase: "" as "delete" | "create" | "" });

  // Deleted log from localStorage
  const [deletedLog, setDeletedLog] = useState<ArmedPersonnel[]>(() => {
    try {
      const stored = localStorage.getItem("safeone_personnel_deleted");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Fixed assets linking
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  useEffect(() => {
    loadFixedAssets().then(setFixedAssets);
  }, []);

  const weaponAssetMap = useMemo(
    () => buildWeaponAssetMap(personnel, fixedAssets),
    [personnel, fixedAssets]
  );

  const linkStats = useMemo(
    () => getLinkingStats(personnel, weaponAssetMap),
    [personnel, weaponAssetMap]
  );

  const saveDeletedLog = (log: ArmedPersonnel[]) => {
    setDeletedLog(log);
    localStorage.setItem("safeone_personnel_deleted", JSON.stringify(log));
  };

  const canView = user?.isAdmin || user?.department === "Operaciones";

  if (!canView) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-heading font-bold text-lg text-card-foreground">Acceso Restringido</h2>
            <p className="text-sm text-muted-foreground mt-1">Este módulo es exclusivo del departamento de Operaciones</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const filtered = personnel.filter((p) => {
    const matchSearch =
      (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.client || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.location || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.weaponSerial || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.employeeCode || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.province || "").toLowerCase().includes(search.toLowerCase());
    const matchProvince = !filterProvince || p.province === filterProvince;
    const matchCondition = !filterCondition || p.weaponCondition === filterCondition;
    const hasWeapon = !!(p.weaponSerial && p.weaponSerial !== "No visible" && p.weaponSerial !== "Borrosos");
    const isLinked = weaponAssetMap.has(p.id);
    let matchLinking = true;
    if (filterLinking === "linked") matchLinking = isLinked;
    else if (filterLinking === "unlinked") matchLinking = hasWeapon && !isLinked;
    else if (filterLinking === "withWeapon") matchLinking = hasWeapon;
    return matchSearch && matchProvince && matchCondition && matchLinking;
  });

  const totalCount = personnel.length;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) { alert("Solo se permiten archivos JPG o PNG"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { const url = ev.target?.result as string; setPhotoPreview(url); setForm({ ...form, photo: url }); };
    reader.readAsDataURL(file);
  };

  const handleAdd = async () => {
    if (!form.name && !form.client) return;
    const newP: Omit<ArmedPersonnel, "id"> & { id?: string } = {
      id: `AP-${String(personnel.length + 1).padStart(3, "0")}`,
      employeeCode: form.employeeCode || "",
      name: form.name || "",
      photo: form.photo || "",
      client: form.client || "",
      location: form.location || "",
      province: form.province || "",
      position: form.position || "Oficial de Seguridad",
      supervisor: form.supervisor || "",
      fleetPhone: form.fleetPhone || "",
      personalPhone: form.personalPhone || "",
      address: form.address || "",
      weaponType: form.weaponType || "",
      weaponSerial: form.weaponSerial || "",
      weaponBrand: form.weaponBrand || "",
      weaponCaliber: form.weaponCaliber || "",
      ammunitionCount: Number(form.ammunitionCount) || 0,
      coordinates: form.coordinates || "",
      weaponCondition: form.weaponCondition || "",
      licenseNumber: form.licenseNumber || "",
      licenseExpiry: form.licenseExpiry || "",
      assignedDate: form.assignedDate || new Date().toISOString().split("T")[0],
      status: (form.status as ArmedPersonnel["status"]) || "Activo",
      transferHistory: [],
    };
    try { await createPersonnel(newP as any); }
    catch { setPersonnel((prev) => [{ ...newP, id: newP.id || `AP-${Date.now()}` } as ArmedPersonnel, ...prev]); }
    setShowAdd(false); setEditingId(null); setForm({ status: "Activo" }); setPhotoPreview("");
  };

  const handleStartEdit = (p: ArmedPersonnel) => {
    setForm({ ...p }); setPhotoPreview(p.photo || ""); setEditingId(p.id); setShowAdd(true); setSelected(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const updateData: Partial<ArmedPersonnel> = {
      employeeCode: form.employeeCode || "", name: form.name || "", photo: form.photo || "",
      client: form.client || "", location: form.location || "", province: form.province || "",
      position: form.position || "", supervisor: form.supervisor || "",
      fleetPhone: form.fleetPhone || "", personalPhone: form.personalPhone || "",
      address: form.address || "", weaponType: form.weaponType || "",
      weaponSerial: form.weaponSerial || "", weaponBrand: form.weaponBrand || "",
      weaponCaliber: form.weaponCaliber || "", ammunitionCount: Number(form.ammunitionCount) || 0,
      coordinates: form.coordinates || "", weaponCondition: form.weaponCondition || "",
      licenseNumber: form.licenseNumber || "", licenseExpiry: form.licenseExpiry || "",
      status: (form.status as ArmedPersonnel["status"]) || "Activo",
      shiftType: form.shiftType as ShiftType || undefined,
      shiftHours: Number(form.shiftHours) || undefined,
      shiftNotes: form.shiftNotes || undefined,
    };
    try { await updatePersonnel(editingId, updateData); }
    catch { setPersonnel((prev) => prev.map(p => p.id === editingId ? { ...p, ...updateData } : p)); }
    setShowAdd(false); setEditingId(null); setForm({ status: "Activo" }); setPhotoPreview("");
  };

  const handleDelete = async (p: ArmedPersonnel) => {
    const reason = window.prompt(`¿Razón para eliminar a ${p.name || p.employeeCode}?`);
    if (reason === null) return;
    // Log deletion
    const deletedEntry = { ...p, deletedAt: new Date().toISOString(), deletedBy: user?.fullName || "Admin", deletedReason: reason };
    saveDeletedLog([deletedEntry, ...deletedLog]);
    try { await removePersonnel(p.id); }
    catch { setPersonnel((prev) => prev.filter(per => per.id !== p.id)); }
  };

  const handleTransfer = async (transfer: PersonnelTransfer, replacementId?: string) => {
    if (!transferTarget) return;
    const history = [...(transferTarget.transferHistory || []), transfer];
    // Update the transferred person
    try {
      await updatePersonnel(transferTarget.id, {
        client: transfer.toClient,
        location: transfer.toLocation,
        transferHistory: history,
      });
    } catch {
      setPersonnel(prev => prev.map(p => p.id === transferTarget.id
        ? { ...p, client: transfer.toClient, location: transfer.toLocation, transferHistory: history }
        : p
      ));
    }
    // If replacement selected, move them to the vacated post
    if (replacementId) {
      const replacement = personnel.find(p => p.id === replacementId);
      if (replacement) {
        const replHistory: PersonnelTransfer = {
          id: `TR-${Date.now()}-R`,
          date: new Date().toISOString(),
          fromClient: replacement.client,
          fromLocation: replacement.location,
          toClient: transfer.fromClient,
          toLocation: transfer.fromLocation,
          reason: `Reemplazo de ${transferTarget.name || transferTarget.employeeCode}`,
          authorizedBy: "Admin",
        };
        try {
          await updatePersonnel(replacementId, {
            client: transfer.fromClient,
            location: transfer.fromLocation,
            transferHistory: [...(replacement.transferHistory || []), replHistory],
          });
        } catch {
          setPersonnel(prev => prev.map(p => p.id === replacementId
            ? { ...p, client: transfer.fromClient, location: transfer.fromLocation, transferHistory: [...(p.transferHistory || []), replHistory] }
            : p
          ));
        }
      }
    }
    setTransferTarget(null);
  };

  const handleAssignToVacant = async (
    vigilanteId: string,
    mode: "move" | "new",
    reason: string,
    shiftType: ShiftType,
    shiftHours: number,
    shiftNotes: string,
    newPersonData?: Partial<ArmedPersonnel>
  ) => {
    if (!assignTarget) return;
    const transfer: PersonnelTransfer = {
      id: `TR-${Date.now()}`,
      date: new Date().toISOString(),
      fromClient: "",
      fromLocation: "",
      toClient: assignTarget.client,
      toLocation: assignTarget.location,
      reason: `Asignación a puesto vacante${reason ? ` — ${reason}` : ""} | Turno: ${shiftType} (${shiftHours}h)${shiftNotes ? ` | ${shiftNotes}` : ""}`,
      authorizedBy: user?.fullName || "Admin",
    };

    if (mode === "move" && vigilanteId) {
      const vig = personnel.find(p => p.id === vigilanteId);
      if (!vig) return;
      const movedData: Partial<ArmedPersonnel> = {
        client: assignTarget.client,
        location: assignTarget.location,
        province: assignTarget.province,
        shiftType,
        shiftHours,
        shiftNotes,
        transferHistory: [...(vig.transferHistory || []), { ...transfer, fromClient: vig.client, fromLocation: vig.location }],
      };
      try { await updatePersonnel(vigilanteId, movedData); }
      catch { setPersonnel(prev => prev.map(p => p.id === vigilanteId ? { ...p, ...movedData } : p)); }

      const newVacantData: Partial<ArmedPersonnel> = {
        name: "", employeeCode: "", photo: "",
        weaponType: "", weaponBrand: "", weaponSerial: "", weaponCaliber: "",
        ammunitionCount: 0, weaponCondition: "", licenseNumber: "", licenseExpiry: "",
        shiftType: undefined, shiftHours: undefined, shiftNotes: undefined,
        client: vig.client,
        location: vig.location,
        province: vig.province,
      };
      try { await updatePersonnel(assignTarget.id, newVacantData); }
      catch { setPersonnel(prev => prev.map(p => p.id === assignTarget.id ? { ...p, ...newVacantData } : p)); }
    } else if (mode === "new" && newPersonData) {
      const filled: Partial<ArmedPersonnel> = {
        name: newPersonData.name,
        employeeCode: newPersonData.employeeCode,
        shiftType, shiftHours, shiftNotes,
        assignedDate: new Date().toISOString().split("T")[0],
        transferHistory: [...(assignTarget.transferHistory || []), transfer],
      };
      try { await updatePersonnel(assignTarget.id, filled); }
      catch { setPersonnel(prev => prev.map(p => p.id === assignTarget.id ? { ...p, ...filled } : p)); }
    }
    setAssignTarget(null);
  };

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError("");
    try {
      const rows = await parseArmedPersonnelXlsx(file);
      if (rows.length === 0) throw new Error("No se detectaron filas válidas en el archivo.");
      setImportPreview(rows);
    } catch (err: any) {
      setImportError(err?.message || "No se pudo leer el archivo.");
      setImportPreview([]);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    setImporting(true);
    try {
      // Phase 1: delete all existing
      const existing = [...personnel];
      setImportProgress({ done: 0, total: existing.length, phase: "delete" });
      for (let i = 0; i < existing.length; i++) {
        try { await removePersonnel(existing[i].id); }
        catch { setPersonnel(prev => prev.filter(p => p.id !== existing[i].id)); }
        setImportProgress({ done: i + 1, total: existing.length, phase: "delete" });
      }

      // Phase 2: create new ones
      setImportProgress({ done: 0, total: importPreview.length, phase: "create" });
      for (let i = 0; i < importPreview.length; i++) {
        const { _rowIndex, ...row } = importPreview[i];
        const newP = {
          ...row,
          id: `AP-${String(i + 1).padStart(3, "0")}`,
          employeeCode: row.employeeCode || `EMP-${String(i + 1).padStart(3, "0")}`,
        };
        try { await createPersonnel(newP as any); }
        catch { setPersonnel(prev => [newP as ArmedPersonnel, ...prev]); }
        setImportProgress({ done: i + 1, total: importPreview.length, phase: "create" });
      }
      setImportPreview(null);
      setImportProgress({ done: 0, total: 0, phase: "" });
      alert(`Importación completa: ${importPreview.length} registros cargados.`);
    } catch (err: any) {
      alert("Error durante la importación: " + (err?.message || "desconocido"));
    } finally {
      setImporting(false);
    }
  };

  const formFields = [
    { key: "employeeCode", label: "Código de Empleado *" },
    { key: "name", label: "Nombre del Vigilante" },
    { key: "client", label: "Cliente *" },
    { key: "location", label: "Puesto / Ubicación *" },
    { key: "supervisor", label: "Supervisor" },
    { key: "fleetPhone", label: "Celular de Empresa (Flota)" },
    { key: "personalPhone", label: "Celular Personal" },
    { key: "address", label: "Dirección" },
    { key: "weaponType", label: "Tipo de Arma" },
    { key: "weaponBrand", label: "Marca del Arma" },
    { key: "weaponSerial", label: "Serial del Arma" },
    { key: "ammunitionCount", label: "Cantidad de Cápsulas" },
    { key: "coordinates", label: "Coordenadas (lat, lng)" },
    { key: "licenseNumber", label: "Nro. de Licencia" },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                  Personal <span className="gold-accent-text">Armado</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Control operativo — {totalCount} registros</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* View mode tabs */}
                {(["dashboard", "list", "map"] as const).map(mode => (
                  <button key={mode} onClick={() => setViewMode(mode)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === mode ? "bg-primary text-primary-foreground" : "bg-muted text-card-foreground hover:bg-border"}`}>
                    {mode === "dashboard" && <BarChart3 className="h-4 w-4" />}
                    {mode === "list" && <List className="h-4 w-4" />}
                    {mode === "map" && <Map className="h-4 w-4" />}
                    {mode === "dashboard" ? "Dashboard" : mode === "list" ? "Lista" : "Mapa"}
                  </button>
                ))}
                <button onClick={() => setShowTransferLog(!showTransferLog)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-muted text-card-foreground hover:bg-border transition-colors">
                  <ArrowRightLeft className="h-4 w-4" /> Traslados
                </button>
                <button onClick={() => setShowDeletedLog(!showDeletedLog)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-muted text-card-foreground hover:bg-border transition-colors">
                  <History className="h-4 w-4" /> Eliminados ({deletedLog.length})
                </button>
                {user?.isAdmin && (
                  <>
                    <input ref={importFileRef} type="file" accept=".xlsx,.xls" onChange={handleImportFileSelected} className="hidden" />
                    <button onClick={() => importFileRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                      <FileSpreadsheet className="h-4 w-4" /> Importar Matriz
                    </button>
                  </>
                )}
                <button onClick={() => { setForm({ status: "Activo" }); setEditingId(null); setPhotoPreview(""); setShowAdd(true); }} className="btn-gold flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Registrar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* DASHBOARD VIEW */}
        {viewMode === "dashboard" && (
          <div className="px-6 py-4">
            {/* Linking Stats Banner */}
            <div className="mb-4 bg-card rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" /> Vinculación Armas — Activo Fijo
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button onClick={() => { setFilterLinking("withWeapon"); setFilterProvince(""); setFilterCondition(""); setSearch(""); setViewMode("list"); }}
                  className="bg-muted rounded-lg p-3 text-center hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer">
                  <p className="text-2xl font-bold text-card-foreground">{linkStats.withWeapon}</p>
                  <p className="text-xs text-muted-foreground">Con arma asignada</p>
                </button>
                <button onClick={() => { setFilterLinking("linked"); setFilterProvince(""); setFilterCondition(""); setSearch(""); setViewMode("list"); }}
                  className="bg-emerald-50 rounded-lg p-3 text-center hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer">
                  <p className="text-2xl font-bold text-emerald-700">{linkStats.linked}</p>
                  <p className="text-xs text-emerald-600">Vinculadas a Activo Fijo</p>
                </button>
                <button onClick={() => { setFilterLinking("unlinked"); setFilterProvince(""); setFilterCondition(""); setSearch(""); setViewMode("list"); }}
                  className="bg-amber-50 rounded-lg p-3 text-center hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer">
                  <p className="text-2xl font-bold text-amber-700">{linkStats.unlinked}</p>
                  <p className="text-xs text-amber-600">Sin vincular</p>
                </button>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-card-foreground">{linkStats.linkPercentage}%</p>
                  <p className="text-xs text-muted-foreground">Cobertura</p>
                </div>
              </div>
            </div>
            <PersonnelDashboard personnel={personnel} onFilter={(filters) => {
              if (filters.province) setFilterProvince(filters.province);
              else setFilterProvince("");
              if (filters.condition) setFilterCondition(filters.condition);
              else setFilterCondition("");
              if (filters.search) setSearch(filters.search);
              else setSearch("");
              setFilterLinking("");
              setViewMode("list");
            }} onAssign={(p) => setAssignTarget(p)} />
          </div>
        )}

        {/* Filters for list/map */}
        {(viewMode === "list" || viewMode === "map") && (
          <div className="px-6 py-2 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Buscar por nombre, cliente, puesto, código, serial..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
            </div>
            <select value={filterProvince} onChange={e => setFilterProvince(e.target.value)} className="px-3 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm">
              <option value="">Todas las Provincias</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterCondition} onChange={e => setFilterCondition(e.target.value)} className="px-3 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm">
              <option value="">Todas las Condiciones</option>
              {WEAPON_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterLinking} onChange={e => setFilterLinking(e.target.value as any)} className="px-3 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm">
              <option value="">Todas (vinculación)</option>
              <option value="withWeapon">Con arma asignada</option>
              <option value="linked">Vinculadas a Activo Fijo</option>
              <option value="unlinked">Sin vincular</option>
            </select>
            {(filterProvince || filterCondition || filterLinking || search) && (
              <button onClick={() => { setFilterProvince(""); setFilterCondition(""); setFilterLinking(""); setSearch(""); }}
                className="px-3 py-2.5 rounded-lg bg-muted text-card-foreground text-sm hover:bg-border">Limpiar filtros</button>
            )}
          </div>
        )}

        {/* MAP VIEW */}
        {viewMode === "map" && (
          <div className="px-6 py-4">
            <PersonnelMap personnel={filtered} onTransfer={(p) => setTransferTarget(p)} />
          </div>
        )}

        {/* LIST VIEW */}
        {viewMode === "list" && (
          <div className="px-6 pb-8 pt-2">
            <div className="overflow-x-auto bg-card rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-left">
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Código</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Vigilante</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Cliente</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Puesto</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Provincia</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Arma</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Serial</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Tipo</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Cáps.</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Estado Arma</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Activo Fijo</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs">Ubic.</th>
                    <th className="px-3 py-2.5 font-semibold text-card-foreground text-xs"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => {
                    const hasCoords = !!parseCoords(p.coordinates);
                    const linkedAsset = weaponAssetMap.get(p.id);
                    return (
                      <tr key={p.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelected(p)}>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.employeeCode || "—"}</td>
                        <td className="px-3 py-2 font-medium text-card-foreground">{p.name || <span className="text-muted-foreground italic">Sin nombre</span>}</td>
                        <td className="px-3 py-2 text-card-foreground">{p.client}</td>
                        <td className="px-3 py-2 text-card-foreground">{p.location}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{p.province}</td>
                        <td className="px-3 py-2 text-card-foreground">{p.weaponType} {p.weaponBrand && p.weaponBrand !== "No visible" ? p.weaponBrand : ""}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.weaponSerial || "—"}</td>
                        <td className="px-3 py-2">
                          {p.weaponCaliber && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${p.weaponCaliber === "Letal" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                              {p.weaponCaliber}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">{p.ammunitionCount || "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${conditionColors[p.weaponCondition] || "bg-gray-100 text-gray-500"}`}>
                            {p.weaponCondition || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {linkedAsset ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 font-mono" title={linkedAsset.descripcion}>
                              {linkedAsset.assetId}
                            </span>
                          ) : p.weaponSerial && p.weaponSerial !== "No visible" && p.weaponSerial !== "Borrosos" ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-600" title="Sin vincular en Activo Fijo">
                              No vinculado
                            </span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {hasCoords ? (
                            <a href={`https://www.openstreetmap.org/?mlat=${p.coordinates.split(',')[0].trim()}&mlon=${p.coordinates.split(',')[1].trim()}#map=17/${p.coordinates.split(',')[0].trim()}/${p.coordinates.split(',')[1].trim()}`} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="text-blue-600 hover:text-blue-800" title="Ver en OpenStreetMap">
                              <MapPin className="h-4 w-4" />
                            </a>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); setTransferTarget(p); }} className="p-1 rounded hover:bg-amber-50 text-muted-foreground hover:text-amber-600" title="Transferir">
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </button>
                            {user?.isAdmin && (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); handleStartEdit(p); }} className="p-1 rounded hover:bg-blue-50 text-muted-foreground hover:text-blue-600" title="Editar">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(p); }} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600" title="Eliminar">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No se encontraron registros</div>
              )}
            </div>
          </div>
        )}

        {/* Deleted Log Panel */}
        {showDeletedLog && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground flex items-center gap-2">
                  <History className="h-5 w-5" /> Registros Eliminados
                </h2>
                <button onClick={() => setShowDeletedLog(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5">
                {deletedLog.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No hay registros eliminados</p>
                ) : (
                  <div className="space-y-3">
                    {deletedLog.map((d, i) => (
                      <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-red-800">{d.name || d.employeeCode}</p>
                            <p className="text-xs text-red-600">{d.client} — {d.location} ({d.province})</p>
                            <p className="text-xs text-red-500 mt-1">Arma: {d.weaponType} {d.weaponBrand} Serial: {d.weaponSerial}</p>
                          </div>
                          <div className="text-right text-xs text-red-500">
                            <p>{d.deletedAt ? new Date(d.deletedAt).toLocaleDateString("es-DO") : "—"}</p>
                            <p>por {d.deletedBy || "—"}</p>
                          </div>
                        </div>
                        {d.deletedReason && <p className="text-xs text-red-700 mt-2 bg-red-100 rounded px-2 py-1">Razón: {d.deletedReason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {selected && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="font-heading font-bold text-lg text-card-foreground">{selected.name || "Sin nombre"}</h2>
                  <p className="text-xs text-muted-foreground font-mono">{selected.employeeCode}</p>
                </div>
                <button onClick={() => setSelected(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              {selected.photo && (
                <div className="px-5 pt-5 flex justify-center">
                  <img src={selected.photo} alt={selected.name} className="w-28 h-28 rounded-xl object-cover border-2 border-border" />
                </div>
              )}
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Código Empleado", selected.employeeCode || "—"],
                    ["Cliente", selected.client || "—"],
                    ["Puesto", selected.location],
                    ["Provincia", selected.province || "—"],
                    ["Cargo", selected.position],
                    ["Supervisor", selected.supervisor || "—"],
                    ["Estado", selected.status],
                    ["Cel. Empresa", selected.fleetPhone || "—"],
                    ["Cel. Personal", selected.personalPhone || "—"],
                    ["Tipo de Arma", selected.weaponType || "—"],
                    ["Marca", selected.weaponBrand || "—"],
                    ["Tipo Munición", selected.weaponCaliber || "—"],
                    ["Cápsulas", String(selected.ammunitionCount)],
                    ["Serial Arma", selected.weaponSerial || "—"],
                    ["Estado del Arma", selected.weaponCondition || "—"],
                    ["Coordenadas", selected.coordinates || "—"],
                    ["Turno", selected.shiftType ? `${selected.shiftType} (${selected.shiftHours || 12}h)` : "Sin asignar"],
                    ["Notas Turno", selected.shiftNotes || "—"],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-muted rounded-lg p-3">
                      <span className="text-xs text-muted-foreground block">{label}</span>
                      <span className="font-medium text-card-foreground">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Linked Fixed Asset */}
                {(() => {
                  const la = weaponAssetMap.get(selected.id);
                  if (!la) return selected.weaponSerial && selected.weaponSerial !== "No visible" && selected.weaponSerial !== "Borrosos" ? (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <h3 className="text-sm font-semibold text-amber-800 mb-1 flex items-center gap-1.5">
                        <Package className="h-4 w-4" /> Activo Fijo
                      </h3>
                      <p className="text-xs text-amber-600">Esta arma (serial: {selected.weaponSerial}) no está vinculada a ningún registro de Activo Fijo.</p>
                    </div>
                  ) : null;
                  return (
                    <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <h3 className="text-sm font-semibold text-emerald-800 mb-2 flex items-center gap-1.5">
                        <Package className="h-4 w-4" /> Activo Fijo Vinculado
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white/70 rounded p-2">
                          <span className="text-emerald-600 block">Código Activo</span>
                          <span className="font-bold text-emerald-900 font-mono">{la.assetId}</span>
                        </div>
                        <div className="bg-white/70 rounded p-2">
                          <span className="text-emerald-600 block">Código Original</span>
                          <span className="font-medium text-emerald-900">{la.codigoOriginal || "—"}</span>
                        </div>
                        <div className="col-span-2 bg-white/70 rounded p-2">
                          <span className="text-emerald-600 block">Descripción</span>
                          <span className="font-medium text-emerald-900">{la.descripcion}</span>
                        </div>
                        <div className="bg-white/70 rounded p-2">
                          <span className="text-emerald-600 block">Estado Inventario</span>
                          <span className="font-medium text-emerald-900 capitalize">{la.estado.replace(/_/g, " ")}</span>
                        </div>
                        <div className="bg-white/70 rounded p-2">
                          <span className="text-emerald-600 block">Condición</span>
                          <span className="font-medium text-emerald-900 capitalize">{la.condicion.replace(/_/g, " ")}</span>
                        </div>
                        {la.fechaAdquisicion && (
                          <div className="bg-white/70 rounded p-2">
                            <span className="text-emerald-600 block">Fecha Adquisición</span>
                            <span className="font-medium text-emerald-900">{la.fechaAdquisicion}</span>
                          </div>
                        )}
                        {la.ubicacion && (
                          <div className="bg-white/70 rounded p-2">
                            <span className="text-emerald-600 block">Ubicación Registrada</span>
                            <span className="font-medium text-emerald-900">{la.ubicacion}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Transfer History */}
                {selected.transferHistory && selected.transferHistory.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-card-foreground mb-2 flex items-center gap-1.5">
                      <ArrowRightLeft className="h-4 w-4" /> Historial de Traslados
                    </h3>
                    <div className="space-y-2">
                      {selected.transferHistory.map((t) => (
                        <div key={t.id} className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs">
                          <div className="flex items-center gap-1 text-amber-800">
                            <span className="font-medium">{t.fromClient}/{t.fromLocation}</span>
                            <ChevronRight className="h-3 w-3" />
                            <span className="font-medium">{t.toClient}/{t.toLocation}</span>
                          </div>
                          <p className="text-amber-600 mt-0.5">{new Date(t.date).toLocaleDateString("es-DO")} — {t.reason || "Sin razón"}</p>
                          {t.replacedBy && <p className="text-amber-700">Reemplazo: {t.replacedBy}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parseCoords(selected.coordinates) && (
                  <div className="mt-4">
                    <a href={`https://www.openstreetmap.org/?mlat=${selected.coordinates.split(',')[0].trim()}&mlon=${selected.coordinates.split(',')[1].trim()}#map=17/${selected.coordinates.split(',')[0].trim()}/${selected.coordinates.split(',')[1].trim()}`} target="_blank" rel="noopener"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors w-full justify-center">
                      <MapPin className="h-4 w-4" /> Ver ubicación en OpenStreetMap
                    </a>
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-border flex justify-end gap-2">
                <button onClick={() => setTransferTarget(selected)} className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors flex items-center gap-1.5">
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Transferir
                </button>
                {user?.isAdmin && (
                  <button onClick={() => handleStartEdit(selected)} className="px-4 py-2 rounded-lg text-sm font-medium bg-muted text-card-foreground hover:bg-border transition-colors flex items-center gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                )}
                <button onClick={() => setSelected(null)} className="btn-gold text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* Transfer Log Panel */}
        {showTransferLog && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5" /> Historial de Traslados
                </h2>
                <button onClick={() => setShowTransferLog(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5">
                {(() => {
                  const allTransfers = personnel.flatMap(p =>
                    (p.transferHistory || []).map(t => ({ ...t, personnelName: p.name || p.employeeCode, personnelId: p.id }))
                  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                  if (allTransfers.length === 0) return (
                    <p className="text-center text-muted-foreground py-8">No hay traslados registrados</p>
                  );

                  return (
                    <div className="space-y-3">
                      {allTransfers.map((t, i) => (
                        <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-amber-900 text-sm">{t.personnelName}</p>
                              <div className="flex items-center gap-1 text-amber-800 text-xs mt-1">
                                <span>{t.fromClient}/{t.fromLocation}</span>
                                <ChevronRight className="h-3 w-3" />
                                <span className="font-medium">{t.toClient}/{t.toLocation}</span>
                              </div>
                            </div>
                            <span className="text-xs text-amber-600">{new Date(t.date).toLocaleDateString("es-DO", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          {t.reason && <p className="text-xs text-amber-700 mt-1.5 bg-amber-100 rounded px-2 py-1">{t.reason}</p>}
                          {t.replacedBy && <p className="text-xs text-amber-800 mt-1">Reemplazo: <strong>{t.replacedBy}</strong></p>}
                          <p className="text-xs text-amber-500 mt-0.5">Autorizado por: {t.authorizedBy}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {assignTarget && (
          <AssignVigilanteModal
            vacantPost={assignTarget}
            allPersonnel={personnel}
            onClose={() => setAssignTarget(null)}
            onAssign={handleAssignToVacant}
          />
        )}


        {transferTarget && (
          <TransferModal
            person={transferTarget}
            allPersonnel={personnel}
            onClose={() => setTransferTarget(null)}
            onTransfer={handleTransfer}
          />
        )}

        {/* Add/Edit Modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">{editingId ? "Editar Personal Armado" : "Registrar Personal Armado"}</h2>
                <button onClick={() => { setShowAdd(false); setEditingId(null); setPhotoPreview(""); setForm({ status: "Activo" }); }} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Foto</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border">
                      {photoPreview ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" /> : <Image className="h-8 w-8 text-muted-foreground" />}
                    </div>
                    <div>
                      <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png" onChange={handlePhotoUpload} className="hidden" />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-sm font-medium text-card-foreground hover:bg-border transition-colors">
                        <Upload className="h-4 w-4" /> Subir foto
                      </button>
                    </div>
                  </div>
                </div>

                {formFields.map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">{label}</label>
                    <input type="text" value={(form as any)[key] || ""} onChange={(e) => setForm({ ...form, [key]: key === "ammunitionCount" ? Number(e.target.value) || 0 : e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                      placeholder={key === "coordinates" ? "ej: 18.49, -69.99" : ""} />
                  </div>
                ))}

                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Provincia *</label>
                  <select value={form.province || ""} onChange={e => setForm({ ...form, province: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="">Seleccionar...</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Tipo de Munición</label>
                  <select value={form.weaponCaliber || ""} onChange={e => setForm({ ...form, weaponCaliber: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="">Seleccionar...</option>
                    <option value="Letal">Letal</option>
                    <option value="No letal">No letal</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Estado del Arma</label>
                  <select value={form.weaponCondition || ""} onChange={e => setForm({ ...form, weaponCondition: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="">Seleccionar...</option>
                    {WEAPON_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Shift Configuration */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                  <label className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> Turno de Trabajo
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-blue-700 block mb-1">Tipo de Turno</label>
                      <select value={form.shiftType || ""} onChange={e => {
                        const val = e.target.value as ShiftType;
                        setForm({ ...form, shiftType: val, shiftHours: val === "12h" ? 12 : val === "24h" ? 24 : val === "24h+" ? 36 : form.shiftHours });
                      }} className="w-full px-2 py-2 rounded-lg bg-white border border-blue-300 text-foreground text-sm outline-none">
                        <option value="">Sin asignar</option>
                        <option value="12h">12 horas</option>
                        <option value="24h">24 horas</option>
                        <option value="24h+">24+ horas (extendido)</option>
                        <option value="Personalizado">Personalizado</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-blue-700 block mb-1">Horas</label>
                      <input type="number" min={1} max={72} value={form.shiftHours || ""} onChange={e => setForm({ ...form, shiftHours: Number(e.target.value) })}
                        className="w-full px-2 py-2 rounded-lg bg-white border border-blue-300 text-foreground text-sm outline-none" />
                    </div>
                  </div>
                  {form.shiftType === "24h+" && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">⚠️ Turnos de 24+ horas requieren consentimiento documentado del vigilante</p>
                  )}
                  <div>
                    <label className="text-xs text-blue-700 block mb-1">Notas del turno</label>
                    <input type="text" value={form.shiftNotes || ""} onChange={e => setForm({ ...form, shiftNotes: e.target.value })}
                      className="w-full px-2 py-2 rounded-lg bg-white border border-blue-300 text-foreground text-sm outline-none"
                      placeholder="Ej: Rotación semanal, vigilante aceptó turno extendido..." />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Venc. Licencia</label>
                    <input type="date" value={form.licenseExpiry || ""} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Estado Vigilante</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ArmedPersonnel["status"] })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      {["Activo", "Licencia", "Inactivo"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => { setShowAdd(false); setEditingId(null); setPhotoPreview(""); setForm({ status: "Activo" }); }} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={editingId ? handleSaveEdit : handleAdd} className="btn-gold text-sm">{editingId ? "Guardar Cambios" : "Registrar"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default OperationsPage;
