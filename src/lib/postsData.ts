// Puestos de trabajo (Posts)
// Entidad central que agrupa cliente, ubicación, supervisor responsable,
// vigilantes asignados (con turno) y armas en custodia del puesto.
// Persistencia en localStorage. Seeds derivados de la matriz de mantenimiento.

import { loadMatrix } from "@/lib/maintenanceMatrixData";

export type Shift = "Diurno" | "Nocturno" | "24h" | "Rotativo";

export interface PostGuardAssignment {
  id: string;
  guardName: string;
  shift: Shift;
  isLead?: boolean; // jefe de puesto
  assignedAt: string;
}

export interface PostWeaponAssignment {
  id: string;
  matrixRecordId?: string; // referencia al registro de la matriz
  arma: string;            // tipo
  marca: string;
  serial: string;
  capsulas: number | null;
  estatus: string;
  notes?: string;
}

export interface PostHandoverEntry {
  id: string;
  weaponId: string;        // PostWeaponAssignment.id
  fromGuard: string;
  toGuard: string;
  shift: Shift;
  at: string;
  notes?: string;
}

export interface WorkPost {
  id: string;
  cliente: string;
  nombre: string;
  provincia: string;
  coordenada: string;
  supervisorId?: string;   // user id del supervisor
  supervisorName?: string;
  gerenteOperaciones?: string; // nombre o id
  guards: PostGuardAssignment[];
  weapons: PostWeaponAssignment[];
  handovers: PostHandoverEntry[];
  createdAt: string;
  updatedAt: string;
}

const KEY = "safeone_work_posts_v1";
const SEED_FLAG = "safeone_work_posts_seed_v1";

function uid(prefix = "PST"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function load(): WorkPost[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function persist(list: WorkPost[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  try { window.dispatchEvent(new CustomEvent("safeone:posts-updated")); } catch {}
}

export function loadPosts(): WorkPost[] {
  let list = load();
  if (list.length === 0 && !localStorage.getItem(SEED_FLAG)) {
    list = seedFromMatrix();
    persist(list);
    localStorage.setItem(SEED_FLAG, "1");
  }
  return list;
}

function seedFromMatrix(): WorkPost[] {
  const matrix = loadMatrix();
  const byKey = new Map<string, WorkPost>();
  const now = new Date().toISOString();
  matrix.forEach((m) => {
    const key = `${m.cliente}::${m.puesto}`;
    let post = byKey.get(key);
    if (!post) {
      post = {
        id: uid(),
        cliente: m.cliente,
        nombre: m.puesto,
        provincia: m.provincia,
        coordenada: m.coordenada,
        guards: [],
        weapons: [],
        handovers: [],
        createdAt: now,
        updatedAt: now,
      };
      byKey.set(key, post);
    }
    // Add weapon
    post.weapons.push({
      id: uid("WPN"),
      matrixRecordId: m.id,
      arma: String(m.arma),
      marca: m.marca,
      serial: m.serial,
      capsulas: m.capsulas,
      estatus: String(m.estatus || ""),
    });
    // Add guard (if present and not duplicate)
    if (m.vigilante && !post.guards.find((g) => g.guardName.toLowerCase() === m.vigilante.toLowerCase())) {
      post.guards.push({
        id: uid("GRD"),
        guardName: m.vigilante,
        shift: "Diurno",
        assignedAt: now,
      });
    }
  });
  return Array.from(byKey.values());
}

export function createPost(input: Partial<WorkPost>): WorkPost {
  const list = loadPosts();
  const now = new Date().toISOString();
  const post: WorkPost = {
    id: uid(),
    cliente: input.cliente || "",
    nombre: input.nombre || "",
    provincia: input.provincia || "",
    coordenada: input.coordenada || "",
    supervisorId: input.supervisorId,
    supervisorName: input.supervisorName,
    gerenteOperaciones: input.gerenteOperaciones,
    guards: input.guards || [],
    weapons: input.weapons || [],
    handovers: [],
    createdAt: now,
    updatedAt: now,
  };
  persist([post, ...list]);
  return post;
}

export function updatePost(id: string, patch: Partial<WorkPost>): WorkPost | null {
  const list = loadPosts();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
  persist(list);
  return list[idx];
}

export function deletePost(id: string) {
  persist(loadPosts().filter((p) => p.id !== id));
}

export function addGuard(postId: string, g: Omit<PostGuardAssignment, "id" | "assignedAt">) {
  const list = loadPosts();
  const post = list.find((p) => p.id === postId);
  if (!post) return;
  post.guards.push({ ...g, id: uid("GRD"), assignedAt: new Date().toISOString() });
  post.updatedAt = new Date().toISOString();
  persist(list);
}

export function removeGuard(postId: string, guardId: string) {
  const list = loadPosts();
  const post = list.find((p) => p.id === postId);
  if (!post) return;
  post.guards = post.guards.filter((g) => g.id !== guardId);
  post.updatedAt = new Date().toISOString();
  persist(list);
}

export function addWeapon(postId: string, w: Omit<PostWeaponAssignment, "id">) {
  const list = loadPosts();
  const post = list.find((p) => p.id === postId);
  if (!post) return;
  post.weapons.push({ ...w, id: uid("WPN") });
  post.updatedAt = new Date().toISOString();
  persist(list);
}

export function removeWeapon(postId: string, weaponId: string) {
  const list = loadPosts();
  const post = list.find((p) => p.id === postId);
  if (!post) return;
  post.weapons = post.weapons.filter((w) => w.id !== weaponId);
  post.updatedAt = new Date().toISOString();
  persist(list);
}

export function recordHandover(postId: string, entry: Omit<PostHandoverEntry, "id" | "at">) {
  const list = loadPosts();
  const post = list.find((p) => p.id === postId);
  if (!post) return;
  post.handovers.unshift({ ...entry, id: uid("HND"), at: new Date().toISOString() });
  post.updatedAt = new Date().toISOString();
  persist(list);
}

export function resetPostsSeed() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(SEED_FLAG);
}
