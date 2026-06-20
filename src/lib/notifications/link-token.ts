import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Token de rattachement signé (CDC v2).
 * L'app (BAAS, Storm…) forge ce token côté serveur pour son utilisateur
 * authentifié, le hub le vérifie. Signé en HMAC-SHA256 avec la **clé API de
 * l'app** (déjà partagée via NOTIFICATION_API_KEYS) → pas de nouveau secret.
 *
 * Garanties : seul un service connaissant la clé de l'app peut forger un token
 * valide (anti-usurpation) ; expiration courte (anti-rejeu).
 */

export interface LinkTokenPayload {
  app: string
  app_user_id: string
  email?: string
  discord_id?: string
  name?: string
  // Portée du lien : 'member' (rattachement, défaut) ou 'admin' (octroi de droits
  // d'administration sur org_id). Pour 'admin', org_id est requis.
  scope?: 'member' | 'admin'
  org_id?: string
  exp: number // unix seconds
}

function appApiKey(app: string): string | null {
  const raw = process.env.NOTIFICATION_API_KEYS
  if (!raw) return null
  try {
    const keys = JSON.parse(raw) as Record<string, string>
    return keys[app] || null
  } catch {
    return null
  }
}

/** Forge un token (utilisé côté app ; fourni ici pour réutilisation/tests). */
export function mintLinkToken(payload: LinkTokenPayload): string | null {
  const key = appApiKey(payload.app)
  if (!key) return null
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', key).update(body).digest('base64url')
  return `${body}.${sig}`
}

/** Vérifie un token : signature (clé de l'app du payload) + expiration. */
export function verifyLinkToken(token: string): LinkTokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts

  let payload: LinkTokenPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!payload.app || !payload.app_user_id) return null

  const key = appApiKey(payload.app)
  if (!key) return null

  const expected = createHmac('sha256', key).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  if (!payload.exp || payload.exp * 1000 < Date.now()) return null
  return payload
}
