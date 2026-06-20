/**
 * Token endpoint (OAuth 2.1) du MCP hub notification.
 *  - grant_type=authorization_code : valide le code (usage unique) + PKCE, émet
 *    un access token JWT + un refresh token (hashé en base).
 *  - grant_type=refresh_token : rotation (ancien révoqué), re-vérifie les droits
 *    club_admins, émet un nouveau couple.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  signAccessToken,
  verifyPkce,
  randomToken,
  hashToken,
  accessTokenTtlSeconds,
} from '@/lib/oauth/jwt'
import { isOrgAdmin } from '@/lib/auth/orgs'
import { baseUrl } from '@/lib/oauth/base-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const REFRESH_TTL_DAYS = 30

function err(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status, headers: CORS })
}

async function parseBody(request: NextRequest): Promise<Record<string, string>> {
  const ct = request.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    return (await request.json().catch(() => ({}))) as Record<string, string>
  }
  const text = await request.text()
  return Object.fromEntries(new URLSearchParams(text))
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request)
    const grantType = body.grant_type
    const base = baseUrl(request)
    const supabase = createServiceClient()

    // ---- Authorization Code grant ----
    if (grantType === 'authorization_code') {
      const { code, redirect_uri, client_id, code_verifier } = body
      if (!code || !redirect_uri || !client_id || !code_verifier) {
        return err('invalid_request', 'Paramètres manquants')
      }

      // Consommer le code de manière atomique (usage unique)
      const { data: consumed } = await supabase
        .from('oauth_auth_codes')
        .update({ used: true })
        .eq('code', code)
        .eq('used', false)
        .select('*')
        .maybeSingle()

      if (!consumed) {
        return err('invalid_grant', 'Code invalide ou déjà utilisé')
      }
      if (new Date(consumed.expires_at).getTime() < Date.now()) {
        return err('invalid_grant', 'Code expiré')
      }
      if (consumed.client_id !== client_id || consumed.redirect_uri !== redirect_uri) {
        return err('invalid_grant', 'client_id ou redirect_uri non concordant')
      }
      if (!verifyPkce(code_verifier, consumed.code_challenge)) {
        return err('invalid_grant', 'Vérification PKCE échouée')
      }

      return issueTokens(supabase, {
        base,
        clientId: client_id,
        userId: consumed.user_id,
        orgId: consumed.club_id,
        resource: consumed.resource,
        scope: consumed.scope || 'mcp',
      })
    }

    // ---- Refresh Token grant (rotation) ----
    if (grantType === 'refresh_token') {
      const { refresh_token, client_id } = body
      if (!refresh_token || !client_id) {
        return err('invalid_request', 'Paramètres manquants')
      }

      const tokenHash = hashToken(refresh_token)
      const { data: rt } = await supabase
        .from('oauth_refresh_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle()

      if (!rt || rt.revoked) {
        return err('invalid_grant', 'Refresh token invalide ou révoqué')
      }
      if (rt.client_id !== client_id) {
        return err('invalid_grant', 'client_id non concordant')
      }
      if (new Date(rt.expires_at).getTime() < Date.now()) {
        return err('invalid_grant', 'Refresh token expiré')
      }

      // Defense-in-depth : l'utilisateur est-il toujours admin de l'org ?
      // (club_admins BAAS ∪ org_admins hub)
      if (!(await isOrgAdmin(rt.user_id, rt.club_id))) {
        await supabase.from('oauth_refresh_tokens').update({ revoked: true }).eq('id', rt.id)
        return err('invalid_grant', "Droits d'administration révoqués pour cette organisation", 403)
      }

      // Rotation : révoquer l'ancien
      await supabase.from('oauth_refresh_tokens').update({ revoked: true }).eq('id', rt.id)

      return issueTokens(supabase, {
        base,
        clientId: client_id,
        userId: rt.user_id,
        orgId: rt.club_id,
        resource: rt.resource,
        scope: rt.scope || 'mcp',
        rotatedFrom: rt.id,
      })
    }

    return err('unsupported_grant_type', `grant_type non supporté: ${grantType}`)
  } catch (e) {
    // Typiquement : MCP_OAUTH_SECRET manquant côté déploiement
    return err('server_error', e instanceof Error ? e.message : 'Erreur interne', 500)
  }
}

async function issueTokens(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    base: string
    clientId: string
    userId: string
    orgId: string
    resource: string
    scope: string
    rotatedFrom?: string
  }
) {
  const accessToken = await signAccessToken({
    userId: params.userId,
    orgId: params.orgId,
    resource: params.resource,
    issuer: params.base,
    scope: params.scope,
  })

  const refreshToken = randomToken(32)
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000).toISOString()

  const { data: inserted, error } = await supabase
    .from('oauth_refresh_tokens')
    .insert({
      token_hash: hashToken(refreshToken),
      client_id: params.clientId,
      user_id: params.userId,
      club_id: params.orgId,
      resource: params.resource,
      scope: params.scope,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error) {
    return err('server_error', error.message, 500)
  }

  if (params.rotatedFrom && inserted) {
    await supabase
      .from('oauth_refresh_tokens')
      .update({ rotated_to: inserted.id })
      .eq('id', params.rotatedFrom)
  }

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: accessTokenTtlSeconds,
      refresh_token: refreshToken,
      scope: params.scope,
    },
    { headers: CORS }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
