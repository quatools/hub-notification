import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/auth/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { verifyDiscordUser } from '@/lib/dispatchers/discord-dm'

// GET /api/admin/channels?org_id=xxx
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('org_id')
  const auth = await getAdminAuth(orgId)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .schema('notifications')
    .from('channels')
    .select('*')
    .eq('org_id', auth.org_id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Erreur lors du chargement des canaux' }, { status: 500 })
  }

  // Sécurité (L3) : ne jamais renvoyer le secret webhook Discord en clair. On
  // masque le token et on expose un drapeau « configuré » pour l'UI. L'édition
  // utilise un placeholder ; le webhook_url n'est mis à jour que si l'admin en
  // saisit un nouveau.
  const channels = (data || []).map((c) => {
    if (c.type === 'discord_webhook' && c.config && typeof c.config.webhook_url === 'string') {
      const url = c.config.webhook_url as string
      return {
        ...c,
        config: {
          ...c.config,
          webhook_url: undefined,
          webhook_configured: true,
          webhook_hint: `…${url.slice(-12)}`,
        },
      }
    }
    return c
  })

  return NextResponse.json({ channels })
}

// POST /api/admin/channels
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  let body: { org_id: string; type: string; label?: string; config: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  if (!body.org_id) {
    return NextResponse.json({ error: 'org_id requis' }, { status: 400 })
  }
  if (!body.type || !body.config) {
    return NextResponse.json({ error: 'type et config requis' }, { status: 400 })
  }

  const auth = await getAdminAuth(body.org_id)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // Vérification Discord webhook
  let isVerified = false
  if (body.type === 'discord_webhook') {
    const webhookUrl = body.config.webhook_url as string
    if (!webhookUrl || (
      !webhookUrl.startsWith('https://discord.com/api/webhooks/') &&
      !webhookUrl.startsWith('https://discordapp.com/api/webhooks/')
    )) {
      return NextResponse.json({ error: 'URL webhook Discord invalide' }, { status: 400 })
    }

    try {
      const res = await fetch(webhookUrl)
      isVerified = res.ok
    } catch {
      isVerified = false
    }
  }

  if (body.type === 'email') {
    const email = body.config.email as string
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
    }
    isVerified = true
  }

  if (body.type === 'discord_dm') {
    // Mode "membre concerné" : pas d'ID à saisir, le destinataire est résolu
    // à l'envoi depuis le compte Discord du membre concerné par l'événement.
    if (body.config.recipient === 'member') {
      body.config = { recipient: 'member' }
      isVerified = true
      if (!body.label) body.label = 'MP au membre concerné'
    } else {
      // Mode "personne précise" : ID Discord fixe (capitaine, admin, test)
      const check = await verifyDiscordUser(body.config.discord_user_id as string)
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 })
      }
      isVerified = true
      if (!body.label && check.username) body.label = `MP @${check.username}`
    }
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .schema('notifications')
    .from('channels')
    .insert({
      user_id: auth.user_id,
      org_id: auth.org_id,
      type: body.type,
      label: body.label || null,
      config: body.config,
      is_verified: isVerified,
    })
    .select()
    .single()

  if (error) {
    console.error('Erreur création canal:', error)
    return NextResponse.json({ error: 'Erreur lors de la création du canal' }, { status: 500 })
  }

  return NextResponse.json({ channel: data }, { status: 201 })
}
