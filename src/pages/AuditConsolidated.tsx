import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import {
  Shield,
  FileText,
  FileSpreadsheet,
  Search,
  Lock,
  ImageIcon,
  Shirt,
  Flashlight as FlashIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  personnelApi,
  uniformAssignmentsApi,
  flashlightsApi,
  isApiConfigured,
} from "@/lib/api";
import type {
  ArmedPersonnel,
  UniformAssignment,
  FlashlightItem,
} from "@/lib/types";
import {
  exportAuditReportPDF,
  exportAuditReportExcel,
  type AuditAgentBundle,
} from "@/lib/auditReport";

export default function AuditConsolidated() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canView =
    user?.isAdmin ||
    user?.department === "Operaciones" ||
    user?.department === "Gerencia General" ||
    user?.department === "Calidad";

  const [personnel, setPersonnel] = useState<ArmedPersonnel[]>([]);
  const [uniforms, setUniforms] = useState<UniformAssignment[]>([]);
  const [flashes, setFlashes] = useState<FlashlightItem[]>([]);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [selected, setSelected] = useState<ArmedPersonnel | null>(null);

  useEffect(() => {
    if (!isApiConfigured()) return;
    Promise.all([
      personnelApi.getAll().catch(() => []),
      uniformAssignmentsApi.getAll().catch(() => []),
      flashlightsApi.getAll().catch(() => []),
    ]).then(([p, u, f]) => {
      setPersonnel(p);
      setUniforms(u);
      setFlashes(f);
    });
  }, []);

  const clients = useMemo(
    () =>
      Array.from(new Set(personnel.map((p) => p.client).filter(Boolean))).sort(),
    [personnel]
  );

  const filtered = useMemo(() => {
    return personnel.filter((p) => {
      if (clientFilter && p.client !== clientFilter) return false;
      const q = search.toLowerCase();
      return (
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.employeeCode?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q) ||
        p.weaponSerial?.toLowerCase().includes(q)
      );
    });
  }, [personnel, search, clientFilter]);

  const buildBundle = (a: ArmedPersonnel): AuditAgentBundle => ({
    agent: a,
    uniforms: uniforms.filter((u) => u.employeeCode === a.employeeCode),
    flashlights: flashes.filter((f) => f.assignedToCode === a.employeeCode),
  });

  const exportAll = (kind: "pdf" | "xlsx") => {
    if (!filtered.length) {
      toast({ title: "Sin agentes para exportar", variant: "destructive" });
      return;
    }
    const bundles = filtered.map(buildBundle);
    const meta = { generatedBy: user?.fullName || "—" };
    if (kind === "pdf") exportAuditReportPDF(bundles, meta);
    else exportAuditReportExcel(bundles, meta);
  };

  const exportOne = (a: ArmedPersonnel, kind: "pdf" | "xlsx") => {
    const bundles = [buildBundle(a)];
    const meta = { generatedBy: user?.fullName || "—" };
    if (kind === "pdf") exportAuditReportPDF(bundles, meta);
    else exportAuditReportExcel(bundles, meta);
  };

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
              Solo Operaciones, Gerencia General, Calidad o Administrador
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
              <Shield className="h-6 w-6 text-gold" />
              Auditoría Superintendencia — Vista 360° por Agente
            </h1>
            <p className="text-sm text-muted-foreground">
              Consolida datos del agente, armas, fotos, uniformes y linternas para
              auditorías externas.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportAll("pdf")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/90 text-white text-sm font-medium hover:bg-destructive"
            >
              <FileText className="h-4 w-4" /> PDF ({filtered.length})
            </button>
            <button
              onClick={() => exportAll("xlsx")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel ({filtered.length})
            </button>
          </div>
        </header>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card flex-1 min-w-[240px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar agente, código, puesto, serial..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="">Todos los clientes</option>
            {clients.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        {!isApiConfigured() && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            API no configurada. Esta vista requiere el backend SafeOne corriendo en
            el servidor local.
          </div>
        )}

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Agente</th>
                <th className="text-left px-3 py-2">Cliente / Puesto</th>
                <th className="text-left px-3 py-2">Arma</th>
                <th className="text-center px-3 py-2">Fotos</th>
                <th className="text-center px-3 py-2">Uniformes</th>
                <th className="text-center px-3 py-2">Linternas</th>
                <th className="text-right px-3 py-2">Reporte</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    Sin agentes
                  </td>
                </tr>
              )}
              {filtered.map((a) => {
                const uCount = uniforms.filter((u) => u.employeeCode === a.employeeCode).length;
                const fCount = flashes.filter((f) => f.assignedToCode === a.employeeCode).length;
                const photoCount =
                  (a.agentPhotos?.length || 0) +
                  (a.weaponPhotos?.length || 0) +
                  (a.photo ? 1 : 0) +
                  (a.weaponPhoto ? 1 : 0);
                return (
                  <tr
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className="border-t border-border hover:bg-muted/40 cursor-pointer"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {a.photo ? (
                          <img
                            src={a.photo}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.employeeCode}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{a.client}</div>
                      <div className="text-xs text-muted-foreground">{a.location}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs">{a.weaponSerial || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{a.weaponType}</div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs">
                        <ImageIcon className="h-3 w-3" />
                        {photoCount}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs">
                        <Shirt className="h-3 w-3" />
                        {uCount}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs">
                        <FlashIcon className="h-3 w-3" />
                        {fCount}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportOne(a, "pdf");
                        }}
                        className="px-2 py-1 rounded text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 mr-1"
                      >
                        PDF
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportOne(a, "xlsx");
                        }}
                        className="px-2 py-1 rounded text-xs bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20"
                      >
                        XLS
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <AgentDetailModal
          agent={selected}
          uniforms={uniforms.filter((u) => u.employeeCode === selected.employeeCode)}
          flashes={flashes.filter((f) => f.assignedToCode === selected.employeeCode)}
          onClose={() => setSelected(null)}
          onExportPDF={() => exportOne(selected, "pdf")}
          onExportXLS={() => exportOne(selected, "xlsx")}
        />
      )}
    </AppLayout>
  );
}

function AgentDetailModal({
  agent,
  uniforms,
  flashes,
  onClose,
  onExportPDF,
  onExportXLS,
}: {
  agent: ArmedPersonnel;
  uniforms: UniformAssignment[];
  flashes: FlashlightItem[];
  onClose: () => void;
  onExportPDF: () => void;
  onExportXLS: () => void;
}) {
  const allAgentPhotos = [
    ...(agent.photo
      ? [
          {
            url: agent.photo,
            uploadedAt: "",
            uploadedBy: "—",
            kind: "agent" as const,
          },
        ]
      : []),
    ...(agent.agentPhotos || []),
  ];
  const allWeaponPhotos = [
    ...(agent.weaponPhoto
      ? [
          {
            url: agent.weaponPhoto,
            uploadedAt: "",
            uploadedBy: "—",
            kind: "weapon" as const,
          },
        ]
      : []),
    ...(agent.weaponPhotos || []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-heading font-bold text-lg text-card-foreground">
              {agent.name}
            </h2>
            <p className="text-xs text-muted-foreground">
              {agent.employeeCode} · {agent.client} · {agent.location}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onExportPDF}
              className="px-3 py-1.5 rounded-lg bg-destructive/90 text-white text-xs font-medium"
            >
              PDF
            </button>
            <button
              onClick={onExportXLS}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium"
            >
              Excel
            </button>
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-muted-foreground">
              Cerrar
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Datos */}
          <section>
            <h3 className="font-semibold text-sm mb-2 text-card-foreground">
              Datos del agente
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Field label="Provincia" value={agent.province} />
              <Field label="Posición" value={agent.position} />
              <Field label="Supervisor" value={agent.supervisor} />
              <Field label="Tel. Flota" value={agent.fleetPhone} />
              <Field label="Tel. Personal" value={agent.personalPhone} />
              <Field label="Estado" value={agent.status} />
              <Field label="Asignado desde" value={agent.assignedDate} />
              <Field label="Turno" value={agent.shiftType || "—"} />
              <Field label="Dirección" value={agent.address} />
            </div>
          </section>

          {/* Armas */}
          <section>
            <h3 className="font-semibold text-sm mb-2 text-card-foreground">
              Arma asignada
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Field label="Tipo" value={agent.weaponType} />
              <Field label="Serial" value={agent.weaponSerial} mono />
              <Field label="Marca" value={agent.weaponBrand} />
              <Field label="Calibre" value={agent.weaponCaliber} />
              <Field label="Munición" value={String(agent.ammunitionCount || 0)} />
              <Field label="Condición" value={agent.weaponCondition} />
              <Field label="Licencia" value={agent.licenseNumber} />
              <Field label="Vence licencia" value={agent.licenseExpiry} />
            </div>
          </section>

          {/* Photo galleries */}
          <section>
            <h3 className="font-semibold text-sm mb-2 text-card-foreground">
              Fotos del agente ({allAgentPhotos.length})
            </h3>
            <PhotoGrid photos={allAgentPhotos as any} />
          </section>
          <section>
            <h3 className="font-semibold text-sm mb-2 text-card-foreground">
              Fotos del arma ({allWeaponPhotos.length})
            </h3>
            <PhotoGrid photos={allWeaponPhotos as any} />
          </section>

          {/* Uniformes */}
          <section>
            <h3 className="font-semibold text-sm mb-2 text-card-foreground">
              Uniformes entregados ({uniforms.length})
            </h3>
            {uniforms.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin entregas registradas</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-2 py-1">Tipo</th>
                    <th className="text-left px-2 py-1">Talla</th>
                    <th className="text-right px-2 py-1">Cant.</th>
                    <th className="text-left px-2 py-1">Condición</th>
                    <th className="text-left px-2 py-1">Entregado</th>
                    <th className="text-left px-2 py-1">Por</th>
                  </tr>
                </thead>
                <tbody>
                  {uniforms.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-2 py-1">{u.uniformType}</td>
                      <td className="px-2 py-1 font-mono">{u.uniformSize}</td>
                      <td className="px-2 py-1 text-right">{u.quantity}</td>
                      <td className="px-2 py-1">{u.condition}</td>
                      <td className="px-2 py-1">{u.deliveredAt?.slice(0, 10)}</td>
                      <td className="px-2 py-1 text-muted-foreground">{u.deliveredBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Linternas */}
          <section>
            <h3 className="font-semibold text-sm mb-2 text-card-foreground">
              Linternas asignadas ({flashes.length})
            </h3>
            {flashes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin linternas asignadas</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-2 py-1">Código</th>
                    <th className="text-left px-2 py-1">Marca / Modelo</th>
                    <th className="text-left px-2 py-1">Serial</th>
                    <th className="text-left px-2 py-1">Condición</th>
                    <th className="text-left px-2 py-1">Asignada</th>
                  </tr>
                </thead>
                <tbody>
                  {flashes.map((f) => (
                    <tr key={f.id} className="border-t border-border">
                      <td className="px-2 py-1 font-mono">{f.code}</td>
                      <td className="px-2 py-1">
                        {f.brand} {f.model}
                      </td>
                      <td className="px-2 py-1">{f.serial || "—"}</td>
                      <td className="px-2 py-1">{f.condition}</td>
                      <td className="px-2 py-1">{f.assignedAt?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
      <p className={`text-card-foreground ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

function PhotoGrid({
  photos,
}: {
  photos: Array<{ url: string; uploadedAt?: string; uploadedBy?: string }>;
}) {
  if (!photos.length)
    return <p className="text-xs text-muted-foreground">Sin fotos cargadas</p>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {photos.map((p, i) => (
        <div key={i} className="border border-border rounded-lg overflow-hidden bg-muted/30">
          <img src={p.url} alt="" className="w-full h-32 object-cover" />
          <div className="p-2 text-[10px] text-muted-foreground">
            <div>{p.uploadedAt ? new Date(p.uploadedAt).toLocaleString("es-DO") : "—"}</div>
            <div className="truncate">por {p.uploadedBy || "—"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
