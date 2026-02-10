import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/auth/admin'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/admin/logs?org_id=xxx&limit=50&offset=0&status=sent&event_slug=baas.payment.failed
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('org_id')
  const auth = await getAdminAuth(orgId)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50'), 100)
  const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0')
  const status = request.nextUrl.searchParams.get('status')
  const eventSlug = request.nextUrl.searchParams.get('event_slug')

  const supabase = createServiceClient()
  let query = supabase
    .schema('notifications')
    .from('workflow_executions')
    .select(`
      *,
      events:event_slug (
        label,
        category
      ),
      channels:channel_id (
        type,
        label
      )
    `, { count: 'exact' })
    .eq('org_id', auth.org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (eventSlug) query = query.eq('event_slug', eventSlug)

  const { data, error, count } = await query

  if (error) {
    console.error('Erreur chargement logs:', error)
    // Fallback sans les jointures si elles échouent
    const { data: fallbackData, error: fallbackError, count: fallbackCount } = await supabase
      .schema('notifications')
      .from('workflow_executions')
      .select('*', { count: 'exact' })
      .eq('org_id', auth.org_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (fallbackError) {
      return NextResponse.json({ error: 'Erreur lors du chargement des logs' }, { status: 500 })
    }

    return NextResponse.json({
      logs: fallbackData,
      total: fallbackCount || 0,
      limit,
      offset,
    })
  }

  return NextResponse.json({
    logs: data,
    total: count || 0,
    limit,
    offset,
  })
}
