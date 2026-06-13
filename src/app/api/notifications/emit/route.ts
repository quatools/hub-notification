import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/auth/api-key'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveRoutes, type RouteResult } from '@/lib/notifications/routing'
import { getSenderIdentity } from '@/lib/notifications/sender'
import { resolveDiscordUserId } from '@/lib/notifications/discord-recipient'
import { resolveRecipient } from '@/lib/notifications/recipients'
import { getDispatcher } from '@/lib/dispatchers'
import type { EmitRequest, EmitResponse, NotificationEvent } from '@/lib/types/notifications'

export async function POST(request: NextRequest) {
  // 1. Auth par API key
  const auth = validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ error: 'API key invalide' }, { status: 401 })
  }

  // 2. Parser le body
  let body: EmitRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  // 3. Validation
  if (!body.event || typeof body.event !== 'string') {
    return NextResponse.json({ error: 'Champ "event" requis (slug)' }, { status: 400 })
  }
  if (!body.org_id || typeof body.org_id !== 'string') {
    return NextResponse.json({ error: 'Champ "org_id" requis' }, { status: 400 })
  }
  if (!body.payload || typeof body.payload !== 'object') {
    return NextResponse.json({ error: 'Champ "payload" requis (object)' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 4. Résolution de l'événement
  const { data: event, error: eventError } = await supabase
    .schema('notifications')
    .from('events')
    .select('*')
    .eq('slug', body.event)
    .eq('is_active', true)
    .is('deprecated_at', null)
    .single()

  if (eventError || !event) {
    return NextResponse.json(
      { error: `Événement inconnu ou inactif: "${body.event}"` },
      { status: 404 }
    )
  }

  const notifEvent = event as NotificationEvent

  // 4b. Résoudre les destinataires fournis par l'event (CDC v2) en fiches
  // canoniques. C'est ce qui rend les notifications rattachables au compte hub
  // du membre ET ce qui permet de livrer "au membre concerné" sur SON identité.
  // Aucun envoi ici : on ne fait que résoudre/rattacher.
  interface ResolvedMember {
    recipientId: string
    appUserId: string | null
    discordId: string | null
    email: string | null
    name: string | null
  }
  const members: ResolvedMember[] = []
  if (Array.isArray(body.recipients)) {
    const settled = await Promise.allSettled(
      body.recipients.map(async (r) => {
        const res = await resolveRecipient({
          app: auth.app,
          appUserId: r.app_user_id,
          email: r.email,
          discordId: r.discord_id,
          name: r.name,
        })
        return {
          recipientId: res.recipientId,
          appUserId: r.app_user_id ?? null,
          discordId: r.discord_id ?? null,
          email: r.email ?? null,
          name: r.name ?? null,
        } satisfies ResolvedMember
      })
    )
    for (const s of settled) if (s.status === 'fulfilled') members.push(s.value)
  }

  // 5. Résoudre les routes via les workflows
  const routes = await resolveRoutes(notifEvent, body.org_id, body.target_users)

  if (routes.length === 0) {
    return NextResponse.json({
      dispatched: 0,
      channels: [],
      execution_ids: [],
    } satisfies EmitResponse)
  }

  // 6. Identité d'expéditeur de l'org (marque blanche)
  const sender = await getSenderIdentity(body.org_id)

  // 7. Construire les "jobs" de livraison.
  // Canal "membre concerné" (config.recipient === 'member') : une livraison par
  // destinataire fourni par l'event, adressée à SON identité (Discord/email) et
  // rattachée à SA fiche → la personne peut ensuite refuser/rerouter.
  // Sinon (webhook d'org, email/DM à adresse fixe) : comportement inchangé,
  // destinataire = créateur du workflow (admin).
  interface DeliveryJob {
    route: RouteResult
    recipientId: string | null
    userId: string
    dispatchConfig: Record<string, unknown>
    isMember: boolean
    skipReason?: string
  }

  const jobs: DeliveryJob[] = []
  for (const route of routes) {
    const config = route.channel_config || {}
    const memberAddressed = config.recipient === 'member'

    if (memberAddressed && members.length > 0) {
      // Un envoi par destinataire fourni par l'event.
      for (const m of members) {
        let dispatchConfig: Record<string, unknown> = config
        let skipReason: string | undefined
        if (route.channel_type === 'discord_dm') {
          if (m.discordId) dispatchConfig = { ...config, discord_user_id: m.discordId }
          else skipReason = 'Aucun compte Discord pour ce membre'
        } else if (route.channel_type === 'email') {
          if (m.email) dispatchConfig = { ...config, email: m.email }
          else skipReason = 'Aucun email pour ce membre'
        }
        jobs.push({
          route,
          recipientId: m.recipientId,
          userId: m.appUserId || m.recipientId,
          dispatchConfig,
          isMember: true,
          skipReason,
        })
      }
    } else {
      // Route d'org / admin : fiche résolue depuis route.user_id (auth hub).
      let recipientId: string | null = null
      try {
        recipientId = (await resolveRecipient({ authUserId: route.user_id })).recipientId
      } catch {
        recipientId = null
      }
      // Canal MP "membre" SANS descripteur fourni : on tente l'ancienne
      // résolution Discord par user_id (membre déjà connu côté hub via Discord).
      let dispatchConfig: Record<string, unknown> = config
      let skipReason: string | undefined
      if (route.channel_type === 'discord_dm' && memberAddressed) {
        const discordId = await resolveDiscordUserId(route.user_id)
        if (discordId) dispatchConfig = { ...config, discord_user_id: discordId }
        else skipReason = 'Aucun compte Discord lié à ce membre (connexion via Discord requise)'
      }
      jobs.push({ route, recipientId, userId: route.user_id, dispatchConfig, isMember: false, skipReason })
    }
  }

  // 7b. Opt-out par destinataire : la personne peut refuser une notif qui LUI
  // est adressée (jobs membre uniquement ; un webhook d'org reste une diffusion).
  const memberRecipientIds = Array.from(
    new Set(jobs.filter((j) => j.isMember && j.recipientId).map((j) => j.recipientId as string))
  )
  let optoutSet = new Set<string>() // `${recipientId}:${workflowId}`
  if (memberRecipientIds.length > 0) {
    const { data: optouts } = await supabase
      .schema('notifications')
      .from('user_optouts')
      .select('recipient_id, workflow_id')
      .in('recipient_id', memberRecipientIds)
    if (optouts) {
      optoutSet = new Set(
        (optouts as { recipient_id: string; workflow_id: string }[]).map(
          (o) => `${o.recipient_id}:${o.workflow_id}`
        )
      )
    }
  }

  // 8. Dispatcher en parallèle avec logging dans workflow_executions
  const executionIds: string[] = []
  const channelTypes = new Set<string>()

  const dispatchPromises = jobs.map(async (job) => {
    const { route } = job

    // Refus du membre → on n'envoie pas (et on ne crée pas d'exécution).
    if (job.isMember && job.recipientId && optoutSet.has(`${job.recipientId}:${route.workflow_id}`)) {
      return
    }

    // Créer l'exécution (status pending)
    const { data: execution, error: execError } = await supabase
      .schema('notifications')
      .from('workflow_executions')
      .insert({
        workflow_id: route.workflow_id,
        event_slug: body.event,
        channel_id: route.channel_id,
        user_id: job.userId,
        recipient_id: job.recipientId,
        org_id: body.org_id,
        status: 'pending',
        payload: body.payload,
      })
      .select('id')
      .single()

    if (execError || !execution) {
      console.error('Erreur création execution:', execError)
      return
    }

    executionIds.push(execution.id)
    channelTypes.add(route.channel_type)

    // Destinataire membre sans identité utilisable (pas de Discord/email) → échec propre.
    if (job.skipReason) {
      await supabase
        .schema('notifications')
        .from('workflow_executions')
        .update({ status: 'failed', error_message: job.skipReason })
        .eq('id', execution.id)
      return
    }

    const dispatcher = getDispatcher(route.channel_type)
    if (!dispatcher) {
      await supabase
        .schema('notifications')
        .from('workflow_executions')
        .update({
          status: 'failed',
          error_message: `Dispatcher non trouvé pour le type: ${route.channel_type}`,
        })
        .eq('id', execution.id)
      return
    }

    const result = await dispatcher({
      config: job.dispatchConfig,
      event: notifEvent,
      payload: body.payload,
      step: route.step,
      sender,
    })

    await supabase
      .schema('notifications')
      .from('workflow_executions')
      .update({
        status: result.success ? 'sent' : 'failed',
        error_message: result.error || null,
        sent_at: result.success ? new Date().toISOString() : null,
        attempts: 1,
      })
      .eq('id', execution.id)
  })

  // Attendre tous les dispatches (un échec n'empêche pas les autres)
  await Promise.allSettled(dispatchPromises)

  const response: EmitResponse = {
    dispatched: executionIds.length,
    channels: Array.from(channelTypes),
    execution_ids: executionIds,
  }

  return NextResponse.json(response)
}
