/**
 * Synchronise les canaux de réception PERSO du membre depuis ses IDENTITÉS
 * Supabase (Discord, Google, GitHub…). La possession est prouvée par le provider
 * via Supabase (OAuth `linkIdentity`) → on n'ajoute QUE des canaux vérifiés,
 * jamais une adresse tapée à la main. Idempotent (pas de doublon).
 */
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveDiscordUserId } from '@/lib/notifications/discord-recipient'

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  email: 'Email',
  discord: 'Discord',
}

export async function POST() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const sb = createServiceClient()

  // Canaux perso déjà présents (pour ne pas dupliquer).
  const { data: existing } = await sb
    .schema('notifications')
    .from('channels')
    .select('type, config')
    .eq('user_id', user.id)
    .is('org_id', null)
  const have = new Set<string>()
  for (const c of (existing as { type: string; config: Record<string, unknown> }[] | null) || []) {
    const v = (c.config?.email as string) || (c.config?.discord_user_id as string) || ''
    have.add(`${c.type}:${String(v).toLowerCase()}`)
  }

  // Identités liées (emails vérifiés par le provider).
  const { data: u } = await sb.auth.admin.getUserById(user.id)
  const identities = (u?.user?.identities || []) as Array<{ provider: string; identity_data?: Record<string, unknown> }>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toAdd: any[] = []
  const seen = new Set<string>()

  for (const id of identities) {
    const email = id.identity_data?.email as string | undefined
    if (email && email.includes('@')) {
      const key = `email:${email.toLowerCase()}`
      if (!have.has(key) && !seen.has(key)) {
        seen.add(key)
        toAdd.push({
          user_id: user.id,
          org_id: null,
          type: 'email',
          label: PROVIDER_LABEL[id.provider] || 'Email',
          config: { email },
          is_verified: true,
        })
      }
    }
  }

  // Discord : ID résolu via la fonction SECURITY DEFINER existante.
  const discordId = await resolveDiscordUserId(user.id)
  if (discordId && !have.has(`discord_dm:${String(discordId).toLowerCase()}`)) {
    toAdd.push({
      user_id: user.id,
      org_id: null,
      type: 'discord_dm',
      label: 'Discord',
      config: { discord_user_id: discordId, recipient: 'fixed' },
      is_verified: true,
    })
  }

  if (toAdd.length > 0) {
    await sb.schema('notifications').from('channels').insert(toAdd)
  }

  return NextResponse.json({ added: toAdd.length })
}
