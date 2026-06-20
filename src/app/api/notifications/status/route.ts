import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/auth/api-key'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/notifications/status?org_id=xxx  (auth : clé API server-to-server)
// État de configuration des notifications d'une org : pour que l'app appelante
// affiche « non configuré » / « actif · N workflows » (façon Stripe Connect).
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ error: 'API key invalide' }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get('org_id')
  if (!orgId) {
    return NextResponse.json({ error: 'org_id requis' }, { status: 400 })
  }

  const sb = createServiceClient().schema('notifications')
  const [channelsRes, workflowsRes] = await Promise.all([
    sb.from('channels').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    sb.from('workflows').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_active', true),
  ])

  const channels = channelsRes.count ?? 0
  const workflows = workflowsRes.count ?? 0

  return NextResponse.json({
    channels,
    workflows,
    configured: workflows > 0,
  })
}
