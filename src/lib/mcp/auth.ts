/**
 * Validation OAuth côté Resource Server pour la route MCP.
 * Vérifie l'access token Bearer (signature, exp, audience == org ciblée) puis
 * confirme que l'utilisateur est admin actif de l'org (club_admins du BAAS).
 */

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAccessToken } from '@/lib/oauth/jwt'
import { baseUrl, mcpResource } from '@/lib/oauth/base-url'

export type McpAuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string }

function extractBearer(request: NextRequest): string | null {
  const h = request.headers.get('authorization') || ''
  if (h.toLowerCase().startsWith('bearer ')) {
    const t = h.slice(7).trim()
    return t || null
  }
  return null
}

export async function authenticateMcp(request: NextRequest, orgId: string): Promise<McpAuthResult> {
  const token = extractBearer(request)
  if (!token) {
    return { ok: false, status: 401, error: 'Token Bearer manquant' }
  }

  const claims = await verifyAccessToken(token)
  if (!claims) {
    return { ok: false, status: 401, error: 'Token invalide ou expiré' }
  }

  // Liaison d'audience : le token doit avoir été émis pour CETTE org.
  const base = baseUrl(request)
  const expectedResource = mcpResource(base, orgId)
  if (claims.orgId !== orgId || (claims.aud && claims.aud !== expectedResource)) {
    return { ok: false, status: 401, error: 'Token non valide pour cette organisation' }
  }

  // L'utilisateur est-il toujours admin actif de l'org ?
  const supabase = createServiceClient()
  const { data: admin } = await supabase
    .from('club_admins')
    .select('id')
    .eq('user_id', claims.sub)
    .eq('club_id', orgId)
    .eq('is_active', true)
    .maybeSingle()

  if (!admin) {
    return { ok: false, status: 403, error: "Vous n'êtes pas administrateur de cette organisation" }
  }

  return { ok: true, userId: claims.sub }
}
