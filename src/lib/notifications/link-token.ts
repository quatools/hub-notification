import { createHmac, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Token de rattachement signé (CDC v2).
 * L'app (BAAS, Storm…) forge ce token côté serveur pour son utilisateur
 * authentifié, le hub le vérifie. Signé en HMAC-SHA256 avec le **secret de
 * signature de l'app** :
 *   - apps historiques (env NOTIFICATION_API_KEYS) : la clé API sert de secret ;
 *   - apps self-service (en base) : le `signing_secret` dédié de l'app.
 *
 * Garanties : seul un service connaissant le secret de l'app peut forger un
 * token valide (anti-usurpation) ; expiration courte (anti-rejeu).
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

/**
 * Secret HMAC d'une app. L'env l'emporte (apps historiques inchangées) ; sinon
 * on lit le `signing_secret` de l'app en base (self-service).
 */
async function appSigningSecret(app: string): Promise<string | null> {
  // 1. Apps env (baas-esport…) : la clé API fait office de secret de signature.
  const raw = process.env.NOTIFICATION_API_KEYS
  if (raw) {
    try {
      const keys = JSON.parse(raw) as Record<string, string>
      if (keys[app]) return keys[app]
    } catch {
      // env malformé : on tente la base
    }
  }
  // 2. Apps en base (self-service) : signing_secret dédié.
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .schema('notifications')
      .from('apps')
      .select('signing_secret')
      .eq('slug', app)
      .maybeSingle()
    return (data?.signing_secret as string | undefined) || null
  } catch {
    return null
  }
}

/** Forge un token (utilisé côté app ; fourni ici pour réutilisation/tests). */
export async function mintLinkToken(payload: LinkTokenPayload): Promise<string | null> {
  const key = await appSigningSecret(payload.app)
  if (!key) return null
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', key).update(body).digest('base64url')
  return `${body}.${sig}`
}

/** Vérifie un token : signature (secret de l'app du payload) + expiration. */
export async function verifyLinkToken(token: string): Promise<LinkTokenPayload | null> {
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

  const key = await appSigningSecret(payload.app)
  if (!key) return null

  const expected = createHmac('sha256', key).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  if (!payload.exp || payload.exp * 1000 < Date.now()) return null
  return payload
}
