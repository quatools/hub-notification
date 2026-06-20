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
 * Secrets HMAC acceptés pour une app. On renvoie TOUS les secrets valides
 * (clé env historique ET `signing_secret` en base) : pendant une migration
 * env → self-service, un token signé avec l'un OU l'autre reste accepté, donc
 * aucun ordre de bascule ne casse les link-tokens. Les deux appartiennent à la
 * même app → aucune perte de sécurité.
 */
async function appSigningSecrets(app: string): Promise<string[]> {
  const secrets: string[] = []
  // 1. App env (baas-esport…) : la clé API fait office de secret de signature.
  const raw = process.env.NOTIFICATION_API_KEYS
  if (raw) {
    try {
      const keys = JSON.parse(raw) as Record<string, string>
      if (keys[app]) secrets.push(keys[app])
    } catch {
      // env malformé : on tente la base
    }
  }
  // 2. App en base (self-service) : signing_secret dédié.
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .schema('notifications')
      .from('apps')
      .select('signing_secret')
      .eq('slug', app)
      .maybeSingle()
    const s = data?.signing_secret as string | undefined
    if (s) secrets.push(s)
  } catch {
    // ignore : on renvoie ce qu'on a
  }
  return secrets
}

/** Forge un token (utilisé côté app ; fourni ici pour réutilisation/tests). */
export async function mintLinkToken(payload: LinkTokenPayload): Promise<string | null> {
  const secrets = await appSigningSecrets(payload.app)
  // Préfère le signing_secret en base (le « nouveau ») s'il existe.
  const key = secrets[secrets.length - 1]
  if (!key) return null
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', key).update(body).digest('base64url')
  return `${body}.${sig}`
}

/** Vérifie un token : signature (un des secrets de l'app du payload) + expiration. */
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

  const secrets = await appSigningSecrets(payload.app)
  if (secrets.length === 0) return null

  const a = Buffer.from(sig)
  const ok = secrets.some((key) => {
    const expected = Buffer.from(createHmac('sha256', key).update(body).digest('base64url'))
    return a.length === expected.length && timingSafeEqual(a, expected)
  })
  if (!ok) return null

  if (!payload.exp || payload.exp * 1000 < Date.now()) return null
  return payload
}
