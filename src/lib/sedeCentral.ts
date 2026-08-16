// Sede Central de SafeOne Security Company — punto de referencia para la bóveda
// de armas (armas que no están asignadas a ningún puesto en el reporte del día).

export const SEDE_CENTRAL = {
  nombre: "Sede Central",
  empresa: "SafeOne Security Company",
  direccion: "SafeOne Security Company, Santo Domingo, República Dominicana",
  /** Coordenada de respaldo (Santo Domingo) si la geocodificación falla. */
  fallback: [18.4861, -69.9312] as [number, number],
};

let cached: [number, number] | null = null;

/** Resuelve la coordenada de la Sede Central (OpenStreetMap / Nominatim). */
export async function resolveSedeCentral(): Promise<[number, number]> {
  if (cached) return cached;
  try {
    const q = encodeURIComponent(SEDE_CENTRAL.direccion);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`);
    const js = await res.json();
    if (Array.isArray(js) && js[0]) {
      cached = [parseFloat(js[0].lat), parseFloat(js[0].lon)];
      return cached;
    }
  } catch { /* sin geocodificación */ }
  cached = SEDE_CENTRAL.fallback;
  return cached;
}
