/**
 * Validation des API keys pour les endpoints server-to-server (register, emit, orgs…).
 *
 * Deux sources, dans cet ordre :
 *  1. Base de données (self-service) : clés gérées via l'espace Développeur,
 *     stockées HASHÉES dans notifications.api_keys, rattachées à une app
 *     (notifications.apps) qui porte un statut (trial/active/blocked).
 *  2. Fallback env NOTIFICATION_API_KEYS (clés historiques type baas-esport,
 *     toujours considérées 'active').
 */
import { createHash, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

export interface ApiKeyValidation {
  valid: boolean
  app?: string
  appId?: string          // présent uniquement pour les clés en base
  status?: string         // 'trial' | 'active' | 'blocked' (env => 'active')
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

/** Comparaison à temps constant (clés env). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

function extractBearer(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.slice(7) || null
}

export async function validateApiKey(request: Request): Promise<ApiKeyValidation> {
  const apiKey = extractBearer(request)
  if (!apiKey) return { valid: false }

  // 1. Clés en base (self-service) — recherche par hash.
  try {
    const supabase = createServiceClient()
    const { data: keyRow } = await supabase
      .schema('notifications')
      .from('api_keys')
      .select('id, app_id, revoked_at')
      .eq('key_hash', sha256(apiKey))
      .maybeSingle()

    if (keyRow && !keyRow.revoked_at) {
      const { data: app } = await supabase
        .schema('notifications')
        .from('apps')
        .select('slug, status')
        .eq('id', keyRow.app_id)
        .maybeSingle()

      if (app) {
        // Trace d'usage, sans bloquer la requête.
        supabase
          .schema('notifications')
          .from('api_keys')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', keyRow.id)
          .then(() => {}, () => {})

        return { valid: true, app: app.slug, appId: keyRow.app_id, status: app.status }
      }
    }
  } catch (e) {
    console.error('Erreur lookup clé API en base:', e)
  }

  // 2. Fallback env (baas-esport…) — toujours 'active'.
  const apiKeysRaw = process.env.NOTIFICATION_API_KEYS
  if (apiKeysRaw) {
    try {
      const apiKeys: Record<string, string> = JSON.parse(apiKeysRaw)
      let match: string | undefined
      // Itère sur toutes les clés (pas de court-circuit) pour rester constant.
      for (const [appName, key] of Object.entries(apiKeys)) {
        if (safeEqual(key, apiKey)) match = appName
      }
      if (match) return { valid: true, app: match, status: 'active' }
    } catch {
      console.error('NOTIFICATION_API_KEYS is not valid JSON')
    }
  }

  return { valid: false }
}
