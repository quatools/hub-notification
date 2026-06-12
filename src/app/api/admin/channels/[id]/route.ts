import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuthForChannel } from '@/lib/auth/admin'
import { createServiceClient } from '@/lib/supabase/server'

// PUT /api/admin/channels/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAdminAuthForChannel(id)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  let body: { label?: string; config?: Record<string, unknown>; is_active?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.label !== undefined) updates.label = body.label
  if (body.config !== undefined) updates.config = body.config
  if (body.is_active !== undefined) updates.is_active = body.is_active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Si la config change, re-vérifier la destination (même logique qu'à la création)
  if (body.config !== undefined) {
    const { data: channel } = await supabase
      .schema('notifications')
      .from('channels')
      .select('type')
      .eq('id', id)
      .single()

    if (channel?.type === 'discord_webhook') {
      const webhookUrl = body.config.webhook_url as string
      if (!webhookUrl || (
        !webhookUrl.startsWith('https://discord.com/api/webhooks/') &&
        !webhookUrl.startsWith('https://discordapp.com/api/webhooks/')
      )) {
        return NextResponse.json({ error: 'URL webhook Discord invalide' }, { status: 400 })
      }
      try {
        const res = await fetch(webhookUrl)
        updates.is_verified = res.ok
      } catch {
        updates.is_verified = false
      }
    }

    if (channel?.type === 'email') {
      const email = body.config.email as string
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
      }
      updates.is_verified = true
    }

    if (channel?.type === 'discord_dm') {
      const { verifyDiscordUser } = await import('@/lib/dispatchers/discord-dm')
      const check = await verifyDiscordUser(body.config.discord_user_id as string)
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 })
      }
      updates.is_verified = true
    }
  }
  const { data, error } = await supabase
    .schema('notifications')
    .from('channels')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }

  return NextResponse.json({ channel: data })
}

// DELETE /api/admin/channels/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAdminAuthForChannel(id)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .schema('notifications')
    .from('channels')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
