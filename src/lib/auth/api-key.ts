/**
 * Validation des API keys pour les endpoints server-to-server (register, emit).
 * Les clés sont stockées dans NOTIFICATION_API_KEYS au format JSON:
 * {"baas-esport": "clé-secrète-1", "cours-quatools": "clé-secrète-2"}
 */

interface ApiKeyValidation {
  valid: boolean
  app?: string
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

    for (const [appName, key] of Object.entries(apiKeys)) {
      if (key === apiKey) {
        return { valid: true, app: appName }
      }
    }

    return { valid: false }
  } catch {
    console.error('NOTIFICATION_API_KEYS is not valid JSON')
    return { valid: false }
  }
}
