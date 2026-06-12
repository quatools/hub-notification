/**
 * Serveur MCP du hub notification (JSON-RPC sur HTTP).
 * Une URL par organisation : /api/mcp/[orgId], protégée par OAuth 2.1
 * (droits = admins actifs de l'org via club_admins).
 *
 * Permet de piloter les notifications depuis claude.ai : catalogue d'events,
 * canaux, workflows (création en masse de messages par l'IA), tests,
 * historique, marque blanche (identité + domaine d'envoi).
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateMcp } from '@/lib/mcp/auth'
import { baseUrl } from '@/lib/oauth/base-url'
import { hubTools } from '@/lib/mcp/tools'
import {
  listEvents,
  listChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  listWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  testWorkflow,
  getLogs,
  getSenderIdentityTool,
  setSenderIdentity,
  setupSendingDomain,
  checkSendingDomain,
} from '@/lib/mcp/handlers'

export const runtime = 'nodejs'

type Args = Record<string, unknown>

async function executeTool(name: string, args: Args, orgId: string, userId: string) {
  switch (name) {
    case 'list_events': return listEvents(orgId, args)
    case 'list_channels': return listChannels(orgId)
    case 'create_channel': return createChannel(orgId, userId, args)
    case 'update_channel': return updateChannel(orgId, args)
    case 'delete_channel': return deleteChannel(orgId, args)
    case 'list_workflows': return listWorkflows(orgId, args)
    case 'create_workflow': return createWorkflow(orgId, userId, args)
    case 'update_workflow': return updateWorkflow(orgId, args)
    case 'delete_workflow': return deleteWorkflow(orgId, args)
    case 'test_workflow': return testWorkflow(orgId, args)
    case 'get_logs': return getLogs(orgId, args)
    case 'get_sender_identity': return getSenderIdentityTool(orgId)
    case 'set_sender_identity': return setSenderIdentity(orgId, args)
    case 'setup_sending_domain': return setupSendingDomain(orgId, args)
    case 'check_sending_domain': return checkSendingDomain(orgId)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function handleMCPRequest(request: any, orgId: string, userId: string) {
  const { id, method, params } = request

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'quatools-hub-notification-mcp', version: '1.0.0' },
          },
        }

      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: hubTools } }

      case 'tools/call': {
        const { name, arguments: args } = params
        const result = await executeTool(name, args || {}, orgId, userId)
        return { jsonrpc: '2.0', id, result }
      }

      // Notifications de cycle de vie sans réponse attendue
      case 'notifications/initialized':
        return null

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        }
    }
  } catch (error: any) {
    console.error('MCP Error:', error)
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: error.message || 'Internal error' },
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params
    const body = await request.json().catch(() => null)

    const auth = await authenticateMcp(request, orgId)
    if (!auth.ok) {
      const base = baseUrl(request)
      const resourceMeta = `${base}/.well-known/oauth-protected-resource/api/mcp/${orgId}`
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: body?.id ?? null,
          error: { code: -32001, message: auth.error },
        },
        {
          status: auth.status,
          headers:
            auth.status === 401
              ? { 'WWW-Authenticate': `Bearer resource_metadata="${resourceMeta}", error="invalid_token"` }
              : undefined,
        }
      )
    }

    if (!body) {
      return NextResponse.json(
        { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
        { status: 400 }
      )
    }

    const response = await handleMCPRequest(body, orgId, auth.userId)
    if (response === null) {
      return new NextResponse(null, { status: 202 })
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error('MCP POST Error:', error)
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params
  return NextResponse.json({
    name: 'Quatools Hub Notification MCP Server',
    version: '1.0.0',
    protocol: 'Model Context Protocol',
    orgId,
    endpoints: { jsonrpc: `/api/mcp/${orgId}` },
    tools: { count: hubTools.length },
    status: 'ready',
  })
}
