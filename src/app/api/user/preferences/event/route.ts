import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveRecipient } from '@/lib/notifications/recipients'

// PUT /api/user/preferences/event  { event_id, is_enabled?, channel_id? }
// Préférence d'une notification précise : l'activer/désactiver et choisir sur
// quel compte la recevoir (channel_id null = compte par défaut).
export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { event_id?: string; is_enabled?: boolean; channel_id?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }
  if (!body.event_id) {
    return NextResponse.json({ error: 'event_id requis' }, { status: 400 })
  }
  if (body.is_enabled === undefined && body.channel_id === undefined) {
    return NextResponse.json({ error: 'is_enabled ou channel_id requis' }, { status: 400 })
  }

  const supabase = createServiceClient()

  let recipientId: string | null = null
  try {
    recipientId = (await resolveRecipient({ authUserId: user.id })).recipientId
  } catch {
    recipientId = null
  }
  if (!recipientId) return NextResponse.json({ error: 'Destinataire introuvable' }, { status: 500 })

  // L'événement existe ?
  const { data: ev } = await supabase
    .schema('notifications')
    .from('events')
    .select('id')
    .eq('id', body.event_id)
    .maybeSingle()
  if (!ev) return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 })

  // Le compte choisi appartient bien au membre ?
  if (body.channel_id !== undefined && body.channel_id !== null) {
    const { data: ch } = await supabase
      .schema('notifications')
      .from('channels')
      .select('id')
      .eq('id', body.channel_id)
      .eq('user_id', user.id)
      .is('org_id', null)
      .maybeSingle()
    if (!ch) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
  }

  // Upsert de la préférence (clé recipient_id + event_id).
  const { data: existing } = await supabase
    .schema('notifications')
    .from('recipient_event_prefs')
    .select('id, is_enabled, channel_id')
    .eq('recipient_id', recipientId)
    .eq('event_id', body.event_id)
    .maybeSingle()

  if (existing) {
    const patch: Record<string, unknown> = {}
    if (body.is_enabled !== undefined) patch.is_enabled = body.is_enabled
    if (body.channel_id !== undefined) patch.channel_id = body.channel_id
    const { error } = await supabase
      .schema('notifications')
      .from('recipient_event_prefs')
      .update(patch)
      .eq('id', (existing as { id: string }).id)
    if (error) return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  } else {
    const { error } = await supabase
      .schema('notifications')
      .from('recipient_event_prefs')
      .insert({
        recipient_id: recipientId,
        event_id: body.event_id,
        is_enabled: body.is_enabled === undefined ? true : body.is_enabled,
        channel_id: body.channel_id ?? null,
      })
    if (error) return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
