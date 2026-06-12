/**
 * Dynamic Client Registration (RFC 7591).
 * claude.ai s'enregistre automatiquement comme client public (PKCE, pas de secret).
 * Table oauth_clients partagée avec le BAAS (même base).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { randomToken } from '@/lib/oauth/jwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function POST(request: NextRequest) {
  let body: { redirect_uris?: unknown; client_name?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: 'Corps JSON invalide' },
      { status: 400, headers: CORS }
    )
  }

  const redirectUris: string[] = Array.isArray(body?.redirect_uris) ? body.redirect_uris : []
  const validUris = redirectUris.filter(
    (u) => typeof u === 'string' && (u.startsWith('https://') || u.startsWith('http://localhost'))
  )
  if (validUris.length === 0) {
    return NextResponse.json(
      { error: 'invalid_redirect_uri', error_description: 'Au moins une redirect_uri HTTPS est requise' },
      { status: 400, headers: CORS }
    )
  }

  const clientId = `mcp_client_${randomToken(24)}`
  const supabase = createServiceClient()

  const { error } = await supabase.from('oauth_clients').insert({
    client_id: clientId,
    client_name: typeof body?.client_name === 'string' ? body.client_name : null,
    redirect_uris: validUris,
    token_endpoint_auth_method: 'none',
  })

  if (error) {
    return NextResponse.json(
      { error: 'server_error', error_description: error.message },
      { status: 500, headers: CORS }
    )
  }

  return NextResponse.json(
    {
      client_id: clientId,
      redirect_uris: validUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: body?.client_name ?? undefined,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201, headers: CORS }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
