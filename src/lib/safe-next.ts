/**
 * Anti open-redirect : ne renvoie qu'un chemin INTERNE sûr, sinon un fallback.
 * Neutralise les contournements classiques de `startsWith('/')` :
 *   //evil.com, /\evil.com (backslash), caractères de contrôle, schémas, etc.
 */
export function safeInternalPath(
  next: string | null | undefined,
  fallback = "/admin"
): string {
  if (!next || typeof next !== "string") return fallback
  // Rejet du backslash (les navigateurs le traitent comme '/').
  if (next.includes("\\")) return fallback
  // Rejet des caractères de contrôle (0x00–0x1F, 0x7F).
  for (let i = 0; i < next.length; i++) {
    const c = next.charCodeAt(i)
    if (c < 0x20 || c === 0x7f) return fallback
  }
  try {
    // Base interne factice : on n'accepte que les URLs qui restent same-origin.
    const base = "https://internal.invalid"
    const u = new URL(next, base)
    if (u.origin !== base) return fallback
    const path = `${u.pathname}${u.search}${u.hash}`
    if (!path.startsWith("/") || path.startsWith("//")) return fallback
    return path
  } catch {
    return fallback
  }
}
