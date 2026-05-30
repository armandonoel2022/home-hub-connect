// Vista de Puestos de Trabajo — derivada del Personal Armado (fuente única).
// Muestra la jerarquía Gerencia de Operaciones → Supervisor → Puesto,
// con los agentes y armas de cada puesto, además de métricas por puesto.

import { useMemo, useState } from "react";
import type { ArmedPersonnel } from "@/lib/types";
import { buildPostsFromPersonnel, groupPostsHierarchy, type DerivedPost } from "@/lib/derivedPosts";
import {
  Building2, ChevronDown, ChevronRight, MapPin, Shield, Users, UserCheck,
  Crosshair, ArrowRightLeft, FileText,
} from "lucide-react";
import { printPostFicha } from "@/lib/ficha";

const conditionColor = (c: string) => {
  if (c?.includes("buenas") || c === "En condiciones") return "bg-emerald-50 text-emerald-700";
  if (c === "Falta de mantenimiento") return "bg-amber-50 text-amber-700";
  if (c?.includes("fiscalia")) return "bg-purple-50 text-purple-700";
  if (c) return "bg-red-50 text-red-700";
  return "bg-gray-100 text-gray-500";
};

function PostCard({ post, onSelectAgent, onTransfer }: {
  post: DerivedPost;
  onSelectAgent: (p: ArmedPersonnel) => void;
  onTransfer: (p: ArmedPersonnel) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="font-heading font-semibold text-sm text-card-foreground truncate">{post.nombre}</p>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><MapPin className="h-3 w-3" /> {post.provincia || "Sin provincia"}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-blue-50 text-blue-700"><Users className="h-3 w-3" /> {post.agents.length}</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-purple-50 text-purple-700"><Crosshair className="h-3 w-3" /> {post.weapons.length}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-3 bg-muted/20">
          {/* Agentes del puesto */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Users className="h-3 w-3" /> Agentes ({post.agents.length})</p>
            {post.agents.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Puesto sin agentes asignados</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {post.agents.map((a) => (
                  <div key={a.id} className="bg-card border border-border rounded-lg p-2.5 flex items-center gap-2">
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onSelectAgent(a)}>
                      <p className="text-sm font-medium text-card-foreground truncate hover:text-primary">{a.name || "(Sin nombre)"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.employeeCode} · {a.position || "Vigilante"} {a.shiftType ? `· ${a.shiftType}` : ""}
                      </p>
                    </div>
                    <button onClick={() => onTransfer(a)} title="Transferir" className="p-1 rounded hover:bg-amber-50 text-muted-foreground hover:text-amber-600 shrink-0">
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Armas del puesto */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Crosshair className="h-3 w-3" /> Armas ({post.weapons.length})</p>
            {post.weapons.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sin armas registradas</p>
            ) : (
              <div className="space-y-1.5">
                {post.weapons.map((w, i) => (
                  <div key={`${w.personnelId}-${i}`} className="bg-card border border-border rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-card-foreground">{w.arma}</span>
                      {w.marca && <span className="text-muted-foreground"> · {w.marca}</span>}
                      <span className="text-muted-foreground"> · Serial {w.serial || "—"}</span>
                      <span className="block text-muted-foreground">Custodia: {w.agentName} · {w.caliber || "—"} · {w.capsulas ?? 0} cáps.</span>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-md ${conditionColor(w.estatus)}`}>{w.estatus || "Sin estado"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PostsView({ personnel, search, onSelectAgent, onTransfer }: {
  personnel: ArmedPersonnel[];
  search: string;
  onSelectAgent: (p: ArmedPersonnel) => void;
  onTransfer: (p: ArmedPersonnel) => void;
}) {
  const posts = useMemo(() => buildPostsFromPersonnel(personnel), [personnel]);

  const filteredPosts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return posts;
    return posts.filter((p) =>
      `${p.cliente} ${p.nombre} ${p.provincia} ${p.supervisorName}`.toLowerCase().includes(q) ||
      p.agents.some((a) => `${a.name} ${a.employeeCode}`.toLowerCase().includes(q))
    );
  }, [posts, search]);

  const hierarchy = useMemo(() => groupPostsHierarchy(filteredPosts), [filteredPosts]);

  if (filteredPosts.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-2 opacity-40" />
        <p>No hay puestos que coincidan con la búsqueda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hierarchy.map((g) => {
        const totalPosts = g.supervisores.reduce((s, x) => s + x.posts.length, 0);
        const totalAgents = g.supervisores.reduce((s, x) => s + x.posts.reduce((a, p) => a + p.agents.length, 0), 0);
        return (
          <div key={g.gerente} className="space-y-4">
            <div className="rounded-xl bg-secondary text-secondary-foreground px-4 py-3 flex items-center gap-3">
              <Building2 className="h-5 w-5 text-gold" />
              <div className="min-w-0 flex-1">
                <p className="font-heading font-bold text-sm">Gerencia de Operaciones</p>
                <p className="text-xs opacity-80 truncate">{g.gerente}</p>
              </div>
              <span className="text-xs opacity-90 shrink-0">{totalPosts} puestos · {totalAgents} agentes</span>
            </div>

            {g.supervisores.map((s) => (
              <div key={s.supervisor} className="space-y-2 pl-2 sm:pl-4 border-l-2 border-gold/40">
                <div className="flex items-center gap-2 text-sm">
                  <UserCheck className="h-4 w-4 text-gold" />
                  <span className="font-semibold text-card-foreground">{s.supervisor}</span>
                  <span className="text-xs text-muted-foreground">· {s.posts.length} puestos</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {s.posts.map((p) => (
                    <PostCard key={p.key} post={p} onSelectAgent={onSelectAgent} onTransfer={onTransfer} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
