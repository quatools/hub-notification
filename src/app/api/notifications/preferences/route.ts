import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createClient } from '@/lib/supabase/server'
import type { PreferenceEventRow, PreferenceChannelState, NotificationEvent, NotificationChannel } from '@/lib/types/notifications'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get('org_id')
  if (!orgId) {
    return NextResponse.json({ error: 'org_id requis' }, { status: 400 })
  }

  const supabase = await createClient()

  // 1. Charger tous les events actifs
  const { data: events } = await supabase
    .schema('notifications')
    .from('events')
    .select('*')
    .eq('is_active', true)
    .is('deprecated_at', null)
    .order('category')
    .order('label')

  if (!events || events.length === 0) {
    return NextResponse.json({ preferences: [] })
  }

  // 2. Charger les canaux de l'user
  const { data: channels } = await supabase
    .schema('notifications')
    .from('channels')
    .select('*')
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .eq('is_active', true)

  if (!channels || channels.length === 0) {
    // Retourner les events sans canaux
    const preferences: PreferenceEventRow[] = (events as NotificationEvent[]).map((e) => ({
      event_id: e.id,
      event_slug: e.slug,
      event_label: e.label,
      event_category: e.category,
      channels: [],
    }))
    return NextResponse.json({ preferences })
  }

  // 3. Charger les préférences existantes
  const { data: existingPrefs } = await supabase
    .schema('notifications')
    .from('preferences')
    .select('*')
    .eq('org_id', orgId)

  // Index des prefs existantes : clé = "event_id:channel_id"
  const prefMap = new Map<string, boolean>()
  if (existingPrefs) {
    for (const p of existingPrefs) {
      prefMap.set(`${p.event_id}:${p.channel_id}`, p.is_active)
    }
  }

  // 4. Construire la matrice events × channels
  const preferences: PreferenceEventRow[] = (events as NotificationEvent[]).map((event) => {
    const channelStates: PreferenceChannelState[] = (channels as NotificationChannel[])
      .filter((ch) => event.supported_channels.includes(ch.type))
      .map((ch) => {
        const key = `${event.id}:${ch.id}`
        const existingPref = prefMap.get(key)

        return {
          channel_id: ch.id,
          channel_type: ch.type,
          channel_label: ch.label,
          is_active: existingPref !== undefined ? existingPref : event.default_active,
        }
      })

    return {
      event_id: event.id,
      event_slug: event.slug,
      event_label: event.label,
      event_category: event.category,
      channels: channelStates,
    }
  })

  return NextResponse.json({ preferences })
}

export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  let body: { org_id: string; event_id: string; channel_id: string; is_active: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  if (!body.org_id || !body.event_id || !body.channel_id || typeof body.is_active !== 'boolean') {
    return NextResponse.json(
      { error: 'Champs requis: org_id, event_id, channel_id, is_active (boolean)' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // UPSERT : si la pref existe → update, sinon → insert
  const { data: preference, error } = await supabase
    .schema('notifications')
    .from('preferences')
    .upsert(
      {
        user_id: user.id,
        org_id: body.org_id,
        event_id: body.event_id,
        channel_id: body.channel_id,
        is_active: body.is_active,
      },
      { onConflict: 'user_id,org_id,event_id,channel_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('Erreur PUT preferences:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }

  return NextResponse.json({ preference })
}
