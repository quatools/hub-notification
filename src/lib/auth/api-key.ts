/**
 * Validation des API keys pour les endpoints server-to-server (register, emit).
 * Les clés sont stockées dans NOTIFICATION_API_KEYS au format JSON:
 * {"baas-esport": "clé-secrète-1", "cours-quatools": "clé-secrète-2"}
 */
import { createHash, timingSafeEqual } from 'crypto'

interface ApiKeyValidation {
  valid: boolean
  app?: string
}

/** Comparaison à temps constant (neutralise les attaques temporelles). */
function safeEqual(a: string, b: string): boolean {
  // Hachage préalable : même longueur des deux côtés (timingSafeEqual l'exige)
  // et ne fuit pas la longueur du secret.
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function validateApiKey(request: Request): ApiKeyValidation {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false }
  }

  const apiKey = authHeader.slice(7) // Retirer "Bearer "

  const apiKeysRaw = process.env.NOTIFICATION_API_KEYS
  if (!apiKeysRaw) {
    console.error('NOTIFICATION_API_KEYS not configured')
    return { valid: false }
  }

  try {
    const apiKeys: Record<string, string> = JSON.parse(apiKeysRaw)

    let match: string | undefined
    // Itérer sur TOUTES les clés (pas de court-circuit) pour rester constant.
    for (const [appName, key] of Object.entries(apiKeys)) {
      if (safeEqual(key, apiKey)) {
        match = appName
      }
    }

    return match ? { valid: true, app: match } : { valid: false }
  } catch {
    console.error('NOTIFICATION_API_KEYS is not valid JSON')
    return { valid: false }
  }
}
