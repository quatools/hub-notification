import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/auth/api-key'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveRoutes } from '@/lib/notifications/routing'
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

  // 4b. Enregistrer les destinataires fournis par l'event (CDC v2).
  // Crée/retrouve une fiche destinataire par descripteur (sans rien envoyer) :
  // c'est ce qui rend les notifications rattachables au compte hub du membre.
  if (Array.isArray(body.recipients)) {
    await Promise.allSettled(
      body.recipients.map((r) =>
        resolveRecipient({
          app: auth.app,
          appUserId: r.app_user_id,
          email: r.email,
          discordId: r.discord_id,
          name: r.name,
        })
      )
    )
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

  // 7. Dispatcher en parallèle avec logging dans workflow_executions
  const executionIds: string[] = []
  const channelTypes = new Set<string>()

  const dispatchPromises = routes.map(async (route) => {
    // Rattacher l'exécution à une fiche destinataire (pour la vue membre + opt-out).
    // Best-effort : un échec de résolution ne bloque jamais l'envoi.
    let recipientId: string | null = null
    try {
      const resolved = await resolveRecipient({ authUserId: route.user_id })
      recipientId = resolved.recipientId
    } catch {
      recipientId = null
    }

    // Créer l'exécution (status pending)
    const { data: execution, error: execError } = await supabase
      .schema('notifications')
      .from('workflow_executions')
      .insert({
        workflow_id: route.workflow_id,
        event_slug: body.event,
        channel_id: route.channel_id,
        user_id: route.user_id,
        recipient_id: recipientId,
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

    // Dispatcher
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

    // Canal MP "membre concerné" : résoudre l'ID Discord du destinataire (route.user_id)
    let dispatchConfig = route.channel_config
    if (route.channel_type === 'discord_dm' && route.channel_config.recipient === 'member') {
      const discordId = await resolveDiscordUserId(route.user_id)
      if (!discordId) {
        await supabase
          .schema('notifications')
          .from('workflow_executions')
          .update({
            status: 'failed',
            error_message: 'Aucun compte Discord lié à ce membre (connexion via Discord requise)',
          })
          .eq('id', execution.id)
        return
      }
      dispatchConfig = { ...route.channel_config, discord_user_id: discordId }
    }

    const result = await dispatcher({
      config: dispatchConfig,
      event: notifEvent,
      payload: body.payload,
      step: route.step,
      sender,
    })

    // Mettre à jour l'exécution
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
