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

  // Note : pas de jointure PostgREST sur event_slug (aucune FK vers events.slug),
  // les labels d'événements sont fusionnés via une seconde requête.
  let query = supabase
    .schema('notifications')
    .from('workflow_executions')
    .select(`
      *,
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
    return NextResponse.json({ error: 'Erreur lors du chargement des logs' }, { status: 500 })
  }

  // Enrichir avec les labels d'événements
  const slugs = Array.from(new Set((data || []).map((l) => l.event_slug).filter(Boolean)))
  let eventsBySlug = new Map<string, { label: string; category: string }>()
  if (slugs.length > 0) {
    const { data: events } = await supabase
      .schema('notifications')
      .from('events')
      .select('slug, label, category')
      .in('slug', slugs)
    eventsBySlug = new Map((events || []).map((e) => [e.slug, { label: e.label, category: e.category }]))
  }

  const logs = (data || []).map((l) => ({
    ...l,
    events: eventsBySlug.get(l.event_slug) || null,
  }))

  return NextResponse.json({
    logs,
    total: count || 0,
    limit,
    offset,
  })
}
