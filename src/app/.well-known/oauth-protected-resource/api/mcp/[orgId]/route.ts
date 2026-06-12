/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 * Décrit la ressource MCP d'une organisation et pointe vers le serveur
 * d'autorisation (le hub lui-même).
 */

import { NextRequest, NextResponse } from 'next/server'
import { baseUrl, mcpResource } from '@/lib/oauth/base-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params
  const base = baseUrl(request)

  return NextResponse.json(
    {
      resource: mcpResource(base, orgId),
      authorization_servers: [base],
      scopes_supported: ['mcp'],
      bearer_methods_supported: ['header'],
      resource_name: 'Quatools Hub Notification MCP',
    },
    { headers: CORS }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
