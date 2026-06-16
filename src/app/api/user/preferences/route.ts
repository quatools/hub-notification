import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveRecipient } from '@/lib/notifications/recipients'

// GET /api/user/preferences?org_id=xxx
// Snapshot complet pour l'écran « Mes notifications » : ne pas déranger, compte
// par défaut, comptes de réception, et liste des notifications de l'org (audience
// membre) avec leur état (activée / compte choisi).
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const orgId = request.nextUrl.searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })

  const supabase = createServiceClient()

  let recipientId: string | null = null
  try {
    recipientId = (await resolveRecipient({ authUserId: user.id })).recipientId
  } catch {
    recipientId = null
  }

  // Réglages personne : ne pas déranger + compte par défaut.
  let dndEnabled = false
  let defaultChannelId: string | null = null
  if (recipientId) {
    const { data: rec } = await supabase
      .schema('notifications')
      .from('recipients')
      .select('dnd_enabled, default_channel_id')
      .eq('id', recipientId)
      .maybeSingle()
    if (rec) {
      dndEnabled = !!(rec as { dnd_enabled?: boolean }).dnd_enabled
      defaultChannelId = (rec as { default_channel_id?: string | null }).default_channel_id ?? null
    }
  }

  // Comptes de réception (canaux perso du membre).
  const { data: chans } = await supabase
    .schema('notifications')
    .from('channels')
    .select('id, type, label, config')
    .eq('user_id', user.id)
    .is('org_id', null)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  const accounts = (chans || []) as { id: string; type: string; label: string | null; config: Record<string, unknown> }[]

  // Notifications de l'org dont l'audience inclut « membre ».
  const { data: workflows, error } = await supabase
    .schema('notifications')
    .from('workflows')
    .select(`event_id, events:event_id ( id, slug, label, category, audiences )`)
    .eq('org_id', orgId)
    .eq('is_active', true)
  if (error) return NextResponse.json({ error: 'Erreur lors du chargement' }, { status: 500 })

  // Dédupliquer par événement (un événement peut avoir plusieurs workflows).
  const eventsById = new Map<string, { id: string; slug: string; label: string; category: string }>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const wf of ((workflows || []) as any[])) {
    const ev = wf.events
    if (!ev || !Array.isArray(ev.audiences) || !ev.audiences.includes('member')) continue
    if (!eventsById.has(ev.id)) eventsById.set(ev.id, { id: ev.id, slug: ev.slug, label: ev.label, category: ev.category })
  }

  // Préférences par événement du membre.
  const prefByEvent = new Map<string, { is_enabled: boolean; channel_id: string | null }>()
  if (recipientId && eventsById.size > 0) {
    const { data: prefs } = await supabase
      .schema('notifications')
      .from('recipient_event_prefs')
      .select('event_id, is_enabled, channel_id')
      .eq('recipient_id', recipientId)
      .in('event_id', Array.from(eventsById.keys()))
    for (const p of (prefs || []) as { event_id: string; is_enabled: boolean; channel_id: string | null }[]) {
      prefByEvent.set(p.event_id, { is_enabled: p.is_enabled, channel_id: p.channel_id })
    }
  }

  const notifications = Array.from(eventsById.values()).map((ev) => {
    const pref = prefByEvent.get(ev.id)
    return {
      event_id: ev.id,
      event_slug: ev.slug,
      label: ev.label,
      category: ev.category,
      is_enabled: pref ? pref.is_enabled : true,
      channel_id: pref?.channel_id ?? null,
    }
  })

  return NextResponse.json({
    dnd_enabled: dndEnabled,
    default_channel_id: defaultChannelId,
    accounts,
    notifications,
  })
}

// PUT /api/user/preferences  { dnd_enabled?, default_channel_id? }
export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { dnd_enabled?: boolean; default_channel_id?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const supabase = createServiceClient()

  let recipientId: string | null = null
  try {
    recipientId = (await resolveRecipient({ authUserId: user.id })).recipientId
  } catch {
    recipientId = null
  }
  if (!recipientId) return NextResponse.json({ error: 'Destinataire introuvable' }, { status: 500 })

  const patch: Record<string, unknown> = {}
  if (typeof body.dnd_enabled === 'boolean') patch.dnd_enabled = body.dnd_enabled

  if (body.default_channel_id !== undefined) {
    if (body.default_channel_id === null) {
      patch.default_channel_id = null
    } else {
      // Vérifier que le canal appartient bien au membre (canal perso).
      const { data: ch } = await supabase
        .schema('notifications')
        .from('channels')
        .select('id')
        .eq('id', body.default_channel_id)
        .eq('user_id', user.id)
        .is('org_id', null)
        .maybeSingle()
      if (!ch) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
      patch.default_channel_id = body.default_channel_id
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  const { error } = await supabase
    .schema('notifications')
    .from('recipients')
    .update(patch)
    .eq('id', recipientId)
  if (error) return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })

  return NextResponse.json({ success: true })
}
