import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams
  const orgId = searchParams.get('org_id')
  const status = searchParams.get('status')
  const eventSlug = searchParams.get('event_slug')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  let query = supabase
    .schema('notifications')
    .from('logs')
    .select('*, events:event_id(label), channels:channel_id(type, label)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (orgId) {
    query = query.eq('org_id', orgId)
  }
  if (status) {
    query = query.eq('status', status)
  }
  if (eventSlug) {
    query = query.eq('event_slug', eventSlug)
  }

  const { data: logs, error, count } = await query

  if (error) {
    console.error('Erreur GET logs:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }

  // Formatter la réponse
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedLogs = (logs ?? []).map((log: any) => ({
    id: log.id,
    event_slug: log.event_slug,
    event_label: log.events?.label ?? log.event_slug,
    channel_type: log.channels?.type ?? null,
    channel_label: log.channels?.label ?? null,
    status: log.status,
    payload: log.payload,
    error_message: log.error_message,
    sent_at: log.sent_at,
    created_at: log.created_at,
  }))

  return NextResponse.json({
    logs: formattedLogs,
    total: count ?? 0,
  })
}
