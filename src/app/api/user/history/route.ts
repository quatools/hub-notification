import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/user/history?org_id=xxx
// Historique des notifications réellement envoyées (ou échouées) au membre :
// les exécutions rattachées à SA fiche destinataire. Lecture seule.
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get('org_id')
  const supabase = createServiceClient()

  // Fiche destinataire de l'utilisateur connecté
  const { data: recipient } = await supabase
    .schema('notifications')
    .from('recipients')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!recipient) return NextResponse.json({ items: [] })

  let query = supabase
    .schema('notifications')
    .from('workflow_executions')
    .select('id, event_slug, status, sent_at, created_at, destination, channels:channel_id ( type, label )')
    .eq('recipient_id', (recipient as { id: string }).id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (orgId) query = query.eq('org_id', orgId)

  const { data: execs, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Erreur lors du chargement' }, { status: 500 })
  }

  // Libellés d'événements (jointure par slug, pas de FK)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (execs as any[]) || []
  const slugs = Array.from(new Set(rows.map((e) => e.event_slug).filter(Boolean)))
  const labelBySlug = new Map<string, { label: string; category: string | null }>()
  if (slugs.length > 0) {
    const { data: events } = await supabase
      .schema('notifications')
      .from('events')
      .select('slug, label, category')
      .in('slug', slugs)
    for (const ev of (events as { slug: string; label: string; category: string | null }[] | null) || []) {
      labelBySlug.set(ev.slug, { label: ev.label, category: ev.category })
    }
  }

  const items = rows.map((e) => ({
    id: e.id,
    event_label: labelBySlug.get(e.event_slug)?.label || e.event_slug,
    event_category: labelBySlug.get(e.event_slug)?.category || null,
    channel_type: e.channels?.type || null,
    channel_label: e.channels?.label || null,
    destination: (e.destination as string | null) || null,
    status: e.status as 'pending' | 'sent' | 'failed',
    sent_at: e.sent_at as string | null,
    created_at: e.created_at as string,
  }))

  return NextResponse.json({ items })
}
