/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414).
 * Découverte des endpoints OAuth pour les clients MCP (claude.ai).
 */

import { NextRequest, NextResponse } from 'next/server'
import { baseUrl } from '@/lib/oauth/base-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function GET(request: NextRequest) {
  const base = baseUrl(request)
  return NextResponse.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/api/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['mcp'],
    },
    { headers: CORS }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
