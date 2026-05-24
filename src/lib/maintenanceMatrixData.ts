// Matriz de Levantamiento de Mantenimiento de Armas
// Capa de datos con persistencia en localStorage.

export type MatrixEstatus = "Falta de mantenimiento" | "En buenas condiciones" | "Arma no apta" | "";
export type MatrixTipoArma = "Escopeta" | "Pistola" | "Revolver" | "Otra";

export interface MaintenanceMatrixRecord {
  id: string;
  cliente: string;
  puesto: string;
  provincia: string;
  arma: MatrixTipoArma | string;
  marca: string;
  serial: string;
  tipo: string; // Letal / No letal
  capsulas: number | null;
  estatus: MatrixEstatus | string;
  vigilante: string;
  coordenada: string;
  // Documentación / legal
  certificadaMIP?: boolean;
  licenciaFisica?: boolean;
  observaciones?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "safeone_maintenance_matrix_v1";
const SEED_FLAG = "safeone_maintenance_matrix_seed_v1";

const SEED: Omit<MaintenanceMatrixRecord, "id" | "createdAt" | "updatedAt">[] = [
  { cliente: "Paje Solis", puesto: "Paje solis Betania", provincia: "Santo Domingo Oeste", arma: "Escopeta", marca: "Maverick", serial: "MV70310A", tipo: "Letal", capsulas: 3, estatus: "Falta de mantenimiento", vigilante: "Rafael Coplin", coordenada: "" },
  { cliente: "Clinimed", puesto: "Clinimed", provincia: "Santo Domingo Oeste", arma: "Escopeta", marca: "Armed", serial: "2260", tipo: "Letal", capsulas: 2, estatus: "Falta de mantenimiento", vigilante: "Danilo Diaz", coordenada: "https://maps.app.goo.gl/qnecSVNsE4QPvpwU6" },
  { cliente: "Epeco", puesto: "Epeco", provincia: "Santo Domingo Oeste", arma: "Escopeta", marca: "Egia", serial: "58890", tipo: "Letal", capsulas: 3, estatus: "Falta de mantenimiento", vigilante: "Mayobanet Quezada", coordenada: "https://maps.app.goo.gl/Cd5wcd5YHn7askFt6" },
  { cliente: "Jose Armenteros", puesto: "Jose Armenteros", provincia: "Santo Domingo Oeste", arma: "Escopeta", marca: "No visible", serial: "R704353", tipo: "Letal", capsulas: 4, estatus: "Falta de mantenimiento", vigilante: "Jose Upia", coordenada: "https://maps.app.goo.gl/WuXFcTxe2uzrMuFC6" },
  { cliente: "Paje Solis", puesto: "Paje solis", provincia: "Santo Domingo Oeste", arma: "Escopeta", marca: "Maverick", serial: "MV98982", tipo: "Letal", capsulas: 4, estatus: "En buenas condiciones", vigilante: "Pedro Solis", coordenada: "https://maps.app.goo.gl/x2FgEWXNEnQ9s5VW8" },
  { cliente: "INVERSIONES PIURA SRL", puesto: "El pedregal", provincia: "Santo Domingo Oeste", arma: "Escopeta", marca: "Egia", serial: "58884", tipo: "Letal", capsulas: 1, estatus: "Falta de mantenimiento", vigilante: "Flores", coordenada: "https://maps.app.goo.gl/dAL2XSm31s63MirQ7" },
  { cliente: "Asociacion La Nacional", puesto: "Los Alcarrizos", provincia: "Distrito Nacional Oeste", arma: "Escopeta", marca: "Egia", serial: "58873 (POSIBLE)", tipo: "Letal", capsulas: 2, estatus: "Falta de mantenimiento", vigilante: "Jose Alberto Sanchez", coordenada: "https://maps.app.goo.gl/QmivGvCLHCjCYds67" },
  { cliente: "Asociacion La Nacional", puesto: "Independencia", provincia: "Distrito Nacional Oeste", arma: "Escopeta", marca: "Armed", serial: "2266", tipo: "Letal", capsulas: 4, estatus: "Falta de mantenimiento", vigilante: "Manuel Perez", coordenada: "https://maps.app.goo.gl/Y59jkXJvhhFhKw2k9" },
  { cliente: "Asociacion La Nacional", puesto: "Los Minas", provincia: "Santo Domingo Este", arma: "Escopeta", marca: "Egia", serial: "No visible", tipo: "Letal", capsulas: 3, estatus: "Falta de mantenimiento", vigilante: "Obispo Tapia", coordenada: "https://maps.app.goo.gl/CHgM8JksUF48kCgAA" },
  { cliente: "Asociacion La Nacional", puesto: "Sabana Larga", provincia: "Santo Domingo Este", arma: "Escopeta", marca: "No visible", serial: "K772110", tipo: "Letal", capsulas: 3, estatus: "En buenas condiciones", vigilante: "Nilson de los Santos", coordenada: "https://maps.app.goo.gl/VVKYZcNvUny32nwV8" },
  { cliente: "Safe One Security Company", puesto: "Base Operaciones", provincia: "Santo Domingo Oeste", arma: "Escopeta", marca: "Maverick", serial: "MV883640", tipo: "Letal", capsulas: null, estatus: "Arma no apta", vigilante: "", coordenada: "https://maps.app.goo.gl/ggZw5PPEGGA9Ggh89" },
  { cliente: "Safe One Security Company", puesto: "Base Operaciones", provincia: "Santo Domingo Oeste", arma: "Escopeta", marca: "Maverick", serial: "MV703101", tipo: "Letal", capsulas: null, estatus: "Arma no apta", vigilante: "", coordenada: "https://maps.app.goo.gl/ggZw5PPEGGA9Ggh89" },
  { cliente: "Safe One Security Company", puesto: "Base Operaciones", provincia: "Santo Domingo Oeste", arma: "Escopeta", marca: "Maverick", serial: "MV70310A", tipo: "Letal", capsulas: null, estatus: "Arma no apta", vigilante: "", coordenada: "https://maps.app.goo.gl/ggZw5PPEGGA9Ggh89" },
  { cliente: "Safe One Security Company", puesto: "Base Operaciones", provincia: "Santo Domingo Oeste", arma: "Escopeta", marca: "No visible", serial: "K795773", tipo: "Letal", capsulas: null, estatus: "Arma no apta", vigilante: "", coordenada: "https://maps.app.goo.gl/ggZw5PPEGGA9Ggh89" },
  { cliente: "Safe One Security Company", puesto: "Base Operaciones", provincia: "Santo Domingo Oeste", arma: "Escopeta", marca: "Maverick", serial: "MV71125A", tipo: "Letal", capsulas: null, estatus: "Arma no apta", vigilante: "", coordenada: "https://maps.app.goo.gl/ggZw5PPEGGA9Ggh89" },
  { cliente: "Safe One Security Company", puesto: "Base Operaciones", provincia: "Santo Domingo Oeste", arma: "Escopeta", marca: "Egia", serial: "58890", tipo: "Letal", capsulas: null, estatus: "Falta de mantenimiento", vigilante: "", coordenada: "https://maps.app.goo.gl/ggZw5PPEGGA9Ggh89" },
  { cliente: "Safe One Security Company", puesto: "Base Operaciones", provincia: "Santo Domingo Oeste", arma: "Escopeta", marca: "Maverick", serial: "MV70720A", tipo: "Letal", capsulas: null, estatus: "Falta de mantenimiento", vigilante: "", coordenada: "https://maps.app.goo.gl/ggZw5PPEGGA9Ggh89" },
  { cliente: "The Boulevard", puesto: "Total Energy Churchill", provincia: "Distrito Nacional Este", arma: "Escopeta", marca: "No visible", serial: "K795872", tipo: "Letal", capsulas: 4, estatus: "En buenas condiciones", vigilante: "", coordenada: "https://maps.app.goo.gl/t9ZhuUgTiPWoLGax6" },
  { cliente: "Fraga", puesto: "Residencia", provincia: "Distrito Nacional Norte", arma: "Escopeta", marca: "No visible", serial: "K794551", tipo: "Letal", capsulas: 3, estatus: "Falta de mantenimiento", vigilante: "Jose Polanco", coordenada: "https://maps.app.goo.gl/dNrQvZgNi895zAhV8" },
  { cliente: "Transporte Miguel Peguero", puesto: "Haina", provincia: "Sur", arma: "Escopeta", marca: "No visible", serial: "K413715", tipo: "Letal", capsulas: 4, estatus: "Falta de mantenimiento", vigilante: "", coordenada: "https://maps.app.goo.gl/VcX6znjB1qnPuRNq7" },
  { cliente: "R Tajoma", puesto: "Total Energy Sabana Perdida", provincia: "Santo Domingo Este", arma: "Escopeta", marca: "Maverick", serial: "MV019082", tipo: "Letal", capsulas: 3, estatus: "Arma no apta", vigilante: "Manuel Martinez", coordenada: "https://maps.app.goo.gl/ZHqMSu4RPtYCbpug7" },
  { cliente: "Asociacion La Nacional", puesto: "Villa Mella", provincia: "Santo Domingo Este", arma: "Escopeta", marca: "Egia", serial: "58875", tipo: "Letal", capsulas: 2, estatus: "En buenas condiciones", vigilante: "Porfirio de la Rosa", coordenada: "https://maps.app.goo.gl/hjiQiUaeBXULY4fQ7" },
  { cliente: "Asociacion La Nacional", puesto: "Isabel la Catolica", provincia: "Distrito Nacional Este", arma: "Escopeta", marca: "No visible", serial: "K795960", tipo: "Letal", capsulas: 0, estatus: "", vigilante: "Ramon Garcia", coordenada: "https://maps.app.goo.gl/yq3bhkRoJKyufCXq9" },
  { cliente: "Paje Solis", puesto: "6 de noviembre", provincia: "Sur", arma: "Escopeta", marca: "Maverick", serial: "MV03490P", tipo: "Letal", capsulas: 4, estatus: "En buenas condiciones", vigilante: "Leiby Tibrey", coordenada: "https://maps.app.goo.gl/C8iVhxyJ14vwU59C8" },
  { cliente: "Golider", puesto: "Golider", provincia: "Distrito Nacional Oeste", arma: "Pistola", marca: "Arcus", serial: "26EF400325", tipo: "Letal", capsulas: 4, estatus: "En buenas condiciones", vigilante: "", coordenada: "https://maps.app.goo.gl/CVyZ3siQr1wUrtyt9" },
  { cliente: "Asociacion La Nacional", puesto: "Oficina Principal", provincia: "Distrito Nacional Este", arma: "Pistola", marca: "No visible", serial: "44097", tipo: "Letal", capsulas: 4, estatus: "En buenas condiciones", vigilante: "Elvin Martinez Moya", coordenada: "https://maps.app.goo.gl/arjFvy4oUTrSmyfq7" },
  { cliente: "Asociacion La Nacional", puesto: "Oficina Principal", provincia: "Distrito Nacional Este", arma: "Pistola", marca: "No visible", serial: "Borrosos", tipo: "Letal", capsulas: 4, estatus: "Falta de mantenimiento", vigilante: "", coordenada: "https://maps.app.goo.gl/arjFvy4oUTrSmyfq7" },
  { cliente: "Asociacion La Nacional", puesto: "Monte Plata", provincia: "Santo Domingo Este", arma: "Pistola", marca: "Arcus", serial: "28EF400325", tipo: "Letal", capsulas: 5, estatus: "Falta de mantenimiento", vigilante: "Edwin Hernandez", coordenada: "https://maps.app.goo.gl/AQ9rQMbyZ5rtRnPv6" },
  { cliente: "Asociacion La Nacional", puesto: "Bolivar (Romulo)", provincia: "Distrito Nacional Oeste", arma: "Pistola", marca: "No visible", serial: "G36054", tipo: "Letal", capsulas: 8, estatus: "En buenas condiciones", vigilante: "Bernardo Tavares", coordenada: "https://maps.app.goo.gl/6kz3PdzofQeieZAQ8" },
  { cliente: "Asociacion La Nacional", puesto: "Los Minas", provincia: "Santo Domingo Este", arma: "Pistola", marca: "Daewoo", serial: "RA294142", tipo: "Letal", capsulas: 7, estatus: "Falta de mantenimiento", vigilante: "Wilkin Meran", coordenada: "https://maps.app.goo.gl/CHgM8JksUF48kCgAA" },
  { cliente: "Asociacion La Nacional", puesto: "Sabana Larga", provincia: "Santo Domingo Este", arma: "Pistola", marca: "No visible", serial: "636054", tipo: "Letal", capsulas: 5, estatus: "En buenas condiciones", vigilante: "Juan Sanchez", coordenada: "https://maps.app.goo.gl/VVKYZcNvUny32nwV8" },
  { cliente: "Asociacion La Nacional", puesto: "Herrera", provincia: "Distrito Nacional Oeste", arma: "Pistola", marca: "Daewoo", serial: "BA100421", tipo: "Letal", capsulas: 6, estatus: "En buenas condiciones", vigilante: "Jesus Alburquerque", coordenada: "https://maps.app.goo.gl/pK3HatEs7N5pBVTy5" },
  { cliente: "Fraga", puesto: "Residencia", provincia: "Distrito Nacional Norte", arma: "Pistola", marca: "Sig Saber", serial: "B126103", tipo: "Letal", capsulas: 8, estatus: "Falta de mantenimiento", vigilante: "Rolando Beato", coordenada: "https://maps.app.goo.gl/dNrQvZgNi895zAhV8" },
  { cliente: "City Store", puesto: "City Store", provincia: "Santo Domingo Oeste", arma: "Revolver", marca: "Tauro", serial: "JH338872", tipo: "Letal", capsulas: 5, estatus: "Falta de mantenimiento", vigilante: "Rafael Diaz", coordenada: "https://maps.app.goo.gl/zsp4FytvLTURNKvq8" },
  { cliente: "Asociacion La Nacional", puesto: "Los prados", provincia: "Distrito Nacional Oeste", arma: "Revolver", marca: "Tauro", serial: "JH338872", tipo: "Letal", capsulas: 5, estatus: "Falta de mantenimiento", vigilante: "Rodny Diaz", coordenada: "https://maps.app.goo.gl/FEHrPmkXUFeSgjA99" },
  { cliente: "Asociacion La Nacional", puesto: "Naco", provincia: "Distrito Nacional Este", arma: "Revolver", marca: "No visible", serial: "777401", tipo: "Letal", capsulas: 5, estatus: "Falta de mantenimiento", vigilante: "Payano Rodriguez", coordenada: "https://maps.app.goo.gl/1g3weZo2sneoFU4s9" },
  { cliente: "Asociacion La Nacional", puesto: "Bella Vista Mall", provincia: "Distrito Nacional Oeste", arma: "Revolver", marca: "Interarms", serial: "J017187", tipo: "Letal", capsulas: 6, estatus: "En buenas condiciones", vigilante: "Bolivar Jaquez", coordenada: "https://maps.app.goo.gl/QxHto8sJe5xnYJEg6" },
  { cliente: "Asociacion La Nacional", puesto: "Los Alcarrizos", provincia: "Distrito Nacional Oeste", arma: "Revolver", marca: "Taurus", serial: "JH33887", tipo: "Letal", capsulas: 5, estatus: "Arma no apta", vigilante: "Clemente de Leon", coordenada: "https://maps.app.goo.gl/QmivGvCLHCjCYds67" },
  { cliente: "Asociacion La Nacional", puesto: "Independencia", provincia: "Distrito Nacional Oeste", arma: "Revolver", marca: "Taurus", serial: "JH338857", tipo: "Letal", capsulas: 5, estatus: "Falta de mantenimiento", vigilante: "Ramon Collado", coordenada: "https://maps.app.goo.gl/Y59jkXJvhhFhKw2k9" },
  { cliente: "Asociacion La Nacional", puesto: "Friusa", provincia: "Este", arma: "Revolver", marca: "No visible", serial: "No visible", tipo: "Letal", capsulas: 6, estatus: "Arma no apta", vigilante: "Esmerlin Sanchez", coordenada: "https://maps.app.goo.gl/Lf7FRre4pfsrN7cM6" },
  { cliente: "Asociacion La Nacional", puesto: "Av Duarte", provincia: "Distrito Nacional Este", arma: "Revolver", marca: "Saw", serial: "PHE7731", tipo: "Letal", capsulas: 6, estatus: "En buenas condiciones", vigilante: "Modesto Paula", coordenada: "https://maps.app.goo.gl/ptcJSakSBKzSADQs7" },
  { cliente: "Asociacion La Nacional", puesto: "Padre Castellanos", provincia: "Santo Domingo Este", arma: "Revolver", marca: "No visible", serial: "8882877", tipo: "Letal", capsulas: 6, estatus: "En buenas condiciones", vigilante: "Rangel Mejia", coordenada: "https://maps.app.goo.gl/q2GfHXghYYBRfFfe6" },
  { cliente: "Asociacion La Nacional", puesto: "Sabana Perdida", provincia: "Santo Domingo Este", arma: "Revolver", marca: "No visible", serial: "C967170", tipo: "Letal", capsulas: 6, estatus: "Falta de mantenimiento", vigilante: "Kelvin de la Cruz", coordenada: "https://maps.app.goo.gl/JRkieyL5zrFQB23Q7" },
  { cliente: "Asociacion La Nacional", puesto: "Charles de Gaulle", provincia: "Santo Domingo Este", arma: "Revolver", marca: "No visible", serial: "No visible", tipo: "Letal", capsulas: 6, estatus: "Falta de mantenimiento", vigilante: "Virgilio Montero", coordenada: "https://maps.app.goo.gl/HgPyCb2kGDXuHwGZ7" },
];

export const MATRIX_SUMMARY = {
  certificadasMIP: { actual: 7, total: 18, label: "Certificación MIP propiedad SafeOne" },
  licenciasFisicas: { actual: 12, total: 44, label: "Licencias físicas en nuestro poder" },
  sinDocumentacion: { actual: 24, total: 44, label: "Armas sin documentación alguna" },
};

function uid(): string {
  return `MTX-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function load(): MaintenanceMatrixRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function save(list: MaintenanceMatrixRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function loadMatrix(): MaintenanceMatrixRecord[] {
  let list = load();
  if (list.length === 0 && !localStorage.getItem(SEED_FLAG)) {
    const now = new Date().toISOString();
    list = SEED.map((s) => ({ ...s, id: uid(), createdAt: now, updatedAt: now }));
    save(list);
    localStorage.setItem(SEED_FLAG, "1");
  }
  return list;
}

export function createRecord(input: Partial<MaintenanceMatrixRecord>): MaintenanceMatrixRecord {
  const list = loadMatrix();
  const now = new Date().toISOString();
  const rec: MaintenanceMatrixRecord = {
    id: uid(),
    cliente: input.cliente || "",
    puesto: input.puesto || "",
    provincia: input.provincia || "",
    arma: input.arma || "Escopeta",
    marca: input.marca || "",
    serial: input.serial || "",
    tipo: input.tipo || "Letal",
    capsulas: input.capsulas ?? null,
    estatus: input.estatus || "",
    vigilante: input.vigilante || "",
    coordenada: input.coordenada || "",
    certificadaMIP: input.certificadaMIP,
    licenciaFisica: input.licenciaFisica,
    observaciones: input.observaciones || "",
    createdAt: now,
    updatedAt: now,
  };
  save([rec, ...list]);
  return rec;
}

export function updateRecord(id: string, patch: Partial<MaintenanceMatrixRecord>): MaintenanceMatrixRecord | null {
  const list = loadMatrix();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
  save(list);
  return list[idx];
}

export function deleteRecord(id: string): void {
  save(loadMatrix().filter((r) => r.id !== id));
}

export function resetSeed(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SEED_FLAG);
}
