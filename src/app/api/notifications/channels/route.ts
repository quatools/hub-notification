import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createClient } from '@/lib/supabase/server'
import type { ChannelType } from '@/lib/types/notifications'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const supabase = await createClient()
  const orgId = request.nextUrl.searchParams.get('org_id')

  let query = supabase
    .schema('notifications')
    .from('channels')
    .select('*')
    .order('created_at', { ascending: false })

  if (orgId) {
    // Canaux de l'org + canaux perso (org_id null)
    query = query.or(`org_id.eq.${orgId},org_id.is.null`)
  } else {
    query = query.is('org_id', null)
  }

  const { data: channels, error } = await query

  if (error) {
    console.error('Erreur GET channels:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }

  return NextResponse.json({ channels: channels ?? [] })
}

const VALID_TYPES: ChannelType[] = ['email', 'discord_webhook', 'discord_dm', 'sms']

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  let body: { type: ChannelType; label?: string; config: Record<string, unknown>; org_id?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  // Validation type
  if (!body.type || !VALID_TYPES.includes(body.type)) {
    return NextResponse.json({ error: `Type invalide. Valides: ${VALID_TYPES.join(', ')}` }, { status: 400 })
  }

  if (!body.config || typeof body.config !== 'object') {
    return NextResponse.json({ error: 'Champ "config" requis (object)' }, { status: 400 })
  }

  // Validation spécifique par type
  let isVerified = false

  if (body.type === 'email') {
    const email = body.config.email as string
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'config.email invalide' }, { status: 400 })
    }
    isVerified = true // Email = vérifié directement (l'user le renseigne lui-même)
  }

  if (body.type === 'discord_webhook') {
    const webhookUrl = body.config.webhook_url as string
    if (
      !webhookUrl ||
      (!webhookUrl.startsWith('https://discord.com/api/webhooks/') &&
        !webhookUrl.startsWith('https://discordapp.com/api/webhooks/'))
    ) {
      return NextResponse.json({ error: 'config.webhook_url doit être une URL Discord webhook valide' }, { status: 400 })
    }

    // Vérifier que le webhook existe en faisant un GET
    try {
      const res = await fetch(webhookUrl, { method: 'GET' })
      if (!res.ok) {
        return NextResponse.json({ error: 'Webhook Discord invalide ou inaccessible' }, { status: 400 })
      }
      isVerified = true
    } catch {
      return NextResponse.json({ error: 'Impossible de vérifier le webhook Discord' }, { status: 400 })
    }
  }

  const supabase = await createClient()

  const { data: channel, error } = await supabase
    .schema('notifications')
    .from('channels')
    .insert({
      user_id: user.id,
      org_id: body.org_id ?? null,
      type: body.type,
      label: body.label ?? null,
      config: body.config,
      is_verified: isVerified,
    })
    .select()
    .single()

  if (error) {
    console.error('Erreur POST channels:', error)
    return NextResponse.json({ error: 'Erreur lors de la création du canal' }, { status: 500 })
  }

  return NextResponse.json({ channel }, { status: 201 })
}
