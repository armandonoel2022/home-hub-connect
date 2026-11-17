// Quién puede abrir el Explorador SafeOne (el servidor aplica la misma regla).
export const SAFEONE_EXPLORER_EMAILS = ["anoel@safeone.com.do", "tecnologia@safeone.com.do", "cfabian@safeone.com.do"];
export function canExploreSafeOne(user: { email?: string } | null | undefined): boolean {
  return SAFEONE_EXPLORER_EMAILS.includes(String(user?.email || "").trim().toLowerCase());
}
