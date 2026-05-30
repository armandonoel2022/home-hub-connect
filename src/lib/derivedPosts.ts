// Puestos derivados del Personal Armado.
// Fuente única de verdad: cada registro de ArmedPersonnel ya contiene
// cliente, ubicación (puesto), provincia, supervisor y datos del arma.
// Agrupamos por cliente+puesto para formar el "Puesto de Trabajo" sin
// duplicar datos en otro almacén. Se superpone (overlay) la información
// editable guardada en postsData (gerente de operaciones, notas) por clave.

import type { ArmedPersonnel } from "@/lib/types";
import { loadPosts, type WorkPost } from "@/lib/postsData";

export interface DerivedWeapon {
  personnelId: string;
  agentName: string;
  arma: string;
  marca: string;
  serial: string;
  capsulas: number | null;
  estatus: string;
  caliber: string;
}

export interface DerivedPost {
  key: string;
  cliente: string;
  nombre: string;        // ubicación / puesto
  provincia: string;
  coordenada: string;
  supervisorName: string;
  gerenteOperaciones: string;
  agents: ArmedPersonnel[];
  weapons: DerivedWeapon[];
  storedPost?: WorkPost;  // overlay editable (gerente, notas, etc.)
}

const DEFAULT_GERENTE = "Remit Andrés López Rodríguez";

function postKey(cliente: string, nombre: string): string {
  return `${(cliente || "Sin cliente").trim().toLowerCase()}::${(nombre || "Sin puesto").trim().toLowerCase()}`;
}

export function buildPostsFromPersonnel(personnel: ArmedPersonnel[]): DerivedPost[] {
  const stored = loadPosts();
  const storedByKey = new Map<string, WorkPost>();
  stored.forEach((p) => storedByKey.set(postKey(p.cliente, p.nombre), p));

  const map = new Map<string, DerivedPost>();

  personnel.forEach((p) => {
    const cliente = p.client || "Sin cliente";
    const nombre = p.location || "Sin puesto";
    const key = postKey(cliente, nombre);
    let post = map.get(key);
    if (!post) {
      const sp = storedByKey.get(key);
      post = {
        key,
        cliente,
        nombre,
        provincia: p.province || sp?.provincia || "",
        coordenada: p.coordinates || sp?.coordenada || "",
        supervisorName: p.supervisor || sp?.supervisorName || "Sin supervisor asignado",
        gerenteOperaciones: sp?.gerenteOperaciones || DEFAULT_GERENTE,
        agents: [],
        weapons: [],
        storedPost: sp,
      };
      map.set(key, post);
    }
    post.agents.push(p);
    // Cada agente con arma aporta un arma al puesto
    if (p.weaponType || p.weaponSerial) {
      post.weapons.push({
        personnelId: p.id,
        agentName: p.name || p.employeeCode,
        arma: p.weaponType || "—",
        marca: p.weaponBrand || "",
        serial: p.weaponSerial || "",
        capsulas: typeof p.ammunitionCount === "number" ? p.ammunitionCount : null,
        estatus: p.weaponCondition || "",
        caliber: p.weaponCaliber || "",
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const c = a.cliente.localeCompare(b.cliente);
    return c !== 0 ? c : a.nombre.localeCompare(b.nombre);
  });
}

// Jerarquía Gerencia de Operaciones → Supervisor → Puestos
export interface PostsHierarchy {
  gerente: string;
  supervisores: { supervisor: string; posts: DerivedPost[] }[];
}

export function groupPostsHierarchy(posts: DerivedPost[]): PostsHierarchy[] {
  const byGer = new Map<string, Map<string, DerivedPost[]>>();
  posts.forEach((p) => {
    const ger = p.gerenteOperaciones || DEFAULT_GERENTE;
    if (!byGer.has(ger)) byGer.set(ger, new Map());
    const sm = byGer.get(ger)!;
    const sup = p.supervisorName || "Sin supervisor asignado";
    if (!sm.has(sup)) sm.set(sup, []);
    sm.get(sup)!.push(p);
  });
  return Array.from(byGer.entries()).map(([gerente, sm]) => ({
    gerente,
    supervisores: Array.from(sm.entries())
      .map(([supervisor, posts]) => ({ supervisor, posts }))
      .sort((a, b) => a.supervisor.localeCompare(b.supervisor)),
  }));
}
