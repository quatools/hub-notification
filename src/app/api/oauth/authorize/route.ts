/**
 * Authorization endpoint (OAuth 2.1, code + PKCE) du MCP hub notification.
 *
 * Flux : claude.ai ouvre cette URL dans le navigateur.
 *  1. Valide la requête (response_type=code, PKCE S256, client/redirect_uri, resource->orgId).
 *  2. Exige une session Supabase (login Discord) ; sinon redirige vers /login?next=...
 *  3. Vérifie que l'utilisateur est admin actif de l'org (club_admins du BAAS).
 *  4. Émet un code d'autorisation (usage unique, 120s) lié au PKCE/redirect_uri/user/org/resource.
 *
 * Les tables oauth_* (public) sont partagées avec le BAAS (même base Supabase) ;
 * la colonne club_id porte notre org_id (même valeur).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { randomToken } from '@/lib/oauth/jwt'
import { baseUrl, mcpResource } from '@/lib/oauth/base-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function htmlError(message: string, status = 400) {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Connexion MCP</title>
  <style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1f2937}
  .card{border:1px solid #e5e7eb;border-radius:12px;padding:2rem;background:#fff}h1{font-size:1.25rem}</style></head>
  <body><div class="card"><h1>⛔ Connexion impossible</h1><p>${message}</p></div></body></html>`
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const responseType = sp.get('response_type')
  const clientId = sp.get('client_id')
  const redirectUri = sp.get('redirect_uri')
  const codeChallenge = sp.get('code_challenge')
  const codeChallengeMethod = sp.get('code_challenge_method')
  const state = sp.get('state')
  const resource = sp.get('resource')
  const scope = sp.get('scope') || 'mcp'

  const base = baseUrl(request)

  // 1. Validation de base
  if (responseType !== 'code') {
    return htmlError("Paramètre response_type invalide (attendu 'code').")
  }
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return htmlError('PKCE requis (code_challenge avec method S256).')
  }
  if (!clientId || !redirectUri) {
    return htmlError('client_id et redirect_uri sont requis.')
  }

  const supabaseAdmin = createServiceClient()

  // Vérifier le client + redirect_uri exact
  const { data: client } = await supabaseAdmin
    .from('oauth_clients')
    .select('client_id, redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle()

  if (!client) {
    return htmlError('Client OAuth inconnu. Reconnectez le connecteur depuis claude.ai.')
  }
  if (!Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(redirectUri)) {
    return htmlError('redirect_uri non autorisée pour ce client.')
  }

  // Déterminer l'organisation ciblée à partir du paramètre resource
  if (!resource) {
    return htmlError("Paramètre resource manquant (URL du serveur MCP de l'organisation).")
  }
  const expectedPrefix = `${base}/api/mcp/`
  let orgId = ''
  if (resource.startsWith(expectedPrefix)) {
    orgId = resource.slice(expectedPrefix.length).split(/[/?#]/)[0]
  }
  if (!UUID_RE.test(orgId)) {
    return htmlError("Paramètre resource invalide (URL d'organisation non reconnue).")
  }

  // 2. Session Supabase (login Discord)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Reprendre l'autorisation après login
    const authorizeUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
    const loginUrl = new URL('/login', base)
    loginUrl.searchParams.set('next', authorizeUrl)
    return NextResponse.redirect(loginUrl)
  }

  // 3. L'utilisateur est-il admin actif de cette org ?
  const { data: admin } = await supabaseAdmin
    .from('club_admins')
    .select('id')
    .eq('user_id', user.id)
    .eq('club_id', orgId)
    .eq('is_active', true)
    .maybeSingle()

  if (!admin) {
    return htmlError(
      "Vous n'êtes pas administrateur de cette organisation. Demandez à un administrateur de vous inviter, puis réessayez.",
      403
    )
  }

  // 4. Émettre un code d'autorisation (usage unique, 120s)
  const code = randomToken(32)
  const expiresAt = new Date(Date.now() + 120 * 1000).toISOString()

  const { error: insErr } = await supabaseAdmin.from('oauth_auth_codes').insert({
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    user_id: user.id,
    club_id: orgId,
    resource: mcpResource(base, orgId),
    scope,
    expires_at: expiresAt,
  })

  if (insErr) {
    return htmlError(`Erreur serveur lors de l'autorisation : ${insErr.message}`, 500)
  }

  const redirect = new URL(redirectUri)
  redirect.searchParams.set('code', code)
  if (state) redirect.searchParams.set('state', state)
  return NextResponse.redirect(redirect)
}
