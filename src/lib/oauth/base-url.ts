/**
 * Détermine l'URL de base (origine) du déploiement courant depuis les headers
 * de la requête, pour que chaque déploiement (localhost, prod) se décrive
 * correctement dans les métadonnées OAuth.
 */

import { NextRequest } from 'next/server'

export function baseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost || request.headers.get('host')
  if (host) {
    const proto =
      request.headers.get('x-forwarded-proto') ||
      (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
    return `${proto}://${host}`
  }
  return request.nextUrl.origin
}

/** URI canonique de la ressource MCP d'une organisation (= audience du token). */
export function mcpResource(base: string, orgId: string): string {
  return `${base}/api/mcp/${orgId}`
}
