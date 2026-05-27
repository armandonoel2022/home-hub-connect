/**
 * Mapeo de nombres canónicos del backend a etiquetas amigables al usuario.
 * Permite renombrar "Gerencia Comercial" → "Dirección Comercial" sin migrar
 * el campo `department` en JSON / usuarios existentes.
 */
const DEPT_DISPLAY: Record<string, string> = {
  "Gerencia Comercial": "Dirección Comercial",
};

export function displayDept(name: string | undefined | null): string {
  if (!name) return "";
  return DEPT_DISPLAY[name] || name;
}
