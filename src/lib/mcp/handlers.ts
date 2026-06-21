/**
 * Handlers des tools MCP du hub notification.
 * Toutes les fonctions sont scopées sur l'org_id injecté depuis l'URL de la
 * ressource MCP (jamais fourni par le modèle) et réutilisent la logique des
 * routes admin.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { resolveOrgApp } from '@/lib/auth/orgs'
import { getDispatcher } from '@/lib/dispatchers'
import { verifyDiscordUser } from '@/lib/dispatchers/discord-dm'
import { getSenderIdentity } from '@/lib/notifications/sender'
import { resolveDiscordUserId } from '@/lib/notifications/discord-recipient'
import { resolveUserEmail } from '@/lib/notifications/email-recipient'
import { logExecution } from '@/lib/notifications/log-execution'
import {
  createTemDomain,
  getTemDomain,
  checkTemDomain,
  mapTemStatus,
} from '@/lib/scaleway-tem'
import type { NotificationEvent } from '@/lib/types/notifications'

interface McpResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

function ok(data: unknown): McpResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function fail(message: string): McpResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true }
}

type Args = Record<string, unknown>
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

// ---- Événements ----

export async function listEvents(orgId: string, args: Args): Promise<McpResult> {
  const supabase = createServiceClient()
  const orgApp = await resolveOrgApp(orgId)
  let query = supabase
    .schema('notifications')
    .from('events')
    .select('id, app, slug, label, description, category, supported_channels, audiences, payload_schema')
    .eq('app', orgApp)
    .eq('is_active', true)
    .is('deprecated_at', null)
    .order('category')
    .order('label')

  const category = str(args.category)
  if (category) query = query.eq('category', category)

  const { data: events, error } = await query
  if (error) return fail(error.message)

  const { data: workflows } = await supabase
    .schema('notifications')
    .from('workflows')
    .select('event_id, is_active')
    .eq('org_id', orgId)

  const countByEvent = new Map<string, number>()
  for (const wf of workflows || []) {
    if (wf.is_active) countByEvent.set(wf.event_id, (countByEvent.get(wf.event_id) || 0) + 1)
  }

  return ok(
    (events || []).map((e) => ({
      slug: e.slug,
      label: e.label,
      description: e.description,
      category: e.category,
      app: e.app,
      supported_channels: e.supported_channels,
      template_variables: e.payload_schema ? Object.keys(e.payload_schema) : [],
      active_workflows: countByEvent.get(e.id) || 0,
    }))
  )
}

// ---- Canaux ----

export async function listChannels(orgId: string): Promise<McpResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .schema('notifications')
    .from('channels')
    .select('id, type, label, config, is_verified, is_active, created_at')
    .eq('org_id', orgId)
    .order('created_at')

  if (error) return fail(error.message)
  return ok(
    (data || []).map((c) => ({
      id: c.id,
      type: c.type,
      label: c.label,
      destination:
        c.type === 'email'
          ? ((c.config as { recipient?: string }).recipient === 'member'
              ? 'membre concerné par l\'événement'
              : (c.config as { email?: string }).email)
          : c.type === 'discord_dm'
            ? ((c.config as { recipient?: string }).recipient === 'member'
                ? 'membre concerné par l\'événement'
                : `discord_user_id ${(c.config as { discord_user_id?: string }).discord_user_id || '?'}`)
            : `...${((c.config as { webhook_url?: string }).webhook_url || '').slice(-16)}`,
      is_verified: c.is_verified,
      is_active: c.is_active,
    }))
  )
}

async function verifyChannelConfig(
  type: string,
  webhookUrl?: string,
  email?: string,
  discordUserId?: string,
  recipient?: string
): Promise<{ config: Record<string, unknown>; isVerified: boolean } | { error: string }> {
  if (type === 'discord_dm') {
    // Mode "membre concerné" : aucun ID, destinataire résolu à l'envoi
    if (recipient === 'member' || (!discordUserId && recipient !== 'fixed')) {
      return { config: { recipient: 'member' }, isVerified: true }
    }
    const check = await verifyDiscordUser(discordUserId || '')
    if (!check.ok) return { error: check.error || 'ID Discord invalide' }
    return { config: { discord_user_id: discordUserId }, isVerified: true }
  }
  if (type === 'discord_webhook') {
    if (
      !webhookUrl ||
      (!webhookUrl.startsWith('https://discord.com/api/webhooks/') &&
        !webhookUrl.startsWith('https://discordapp.com/api/webhooks/'))
    ) {
      return { error: 'URL webhook Discord invalide (https://discord.com/api/webhooks/...)' }
    }
    let isVerified = false
    try {
      const res = await fetch(webhookUrl, { signal: AbortSignal.timeout(8000) })
      isVerified = res.ok
    } catch {
      isVerified = false
    }
    return { config: { webhook_url: webhookUrl }, isVerified }
  }
  if (type === 'email') {
    // Mode "membre concerné" : pas d'adresse, résolue à l'envoi (comme discord_dm).
    if (recipient === 'member') {
      return { config: { recipient: 'member' }, isVerified: true }
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'Adresse email invalide' }
    }
    return { config: { email }, isVerified: true }
  }
  return { error: `Type de canal non supporté: ${type}` }
}

export async function createChannel(orgId: string, userId: string, args: Args): Promise<McpResult> {
  const type = str(args.type) || ''
  const verified = await verifyChannelConfig(type, str(args.webhook_url), str(args.email), str(args.discord_user_id), str(args.recipient))
  if ('error' in verified) return fail(verified.error)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .schema('notifications')
    .from('channels')
    .insert({
      user_id: userId,
      org_id: orgId,
      type,
      label: str(args.label) || null,
      config: verified.config,
      is_verified: verified.isVerified,
    })
    .select('id, type, label, is_verified')
    .single()

  if (error) return fail(error.message)
  return ok({ created: true, channel: data })
}

async function getOrgChannel(orgId: string, channelId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .schema('notifications')
    .from('channels')
    .select('*')
    .eq('id', channelId)
    .eq('org_id', orgId)
    .single()
  return data
}

export async function updateChannel(orgId: string, args: Args): Promise<McpResult> {
  const channelId = str(args.channel_id)
  if (!channelId) return fail('channel_id requis')
  const channel = await getOrgChannel(orgId, channelId)
  if (!channel) return fail('Canal introuvable dans cette organisation')

  const updates: Record<string, unknown> = {}
  if (args.label !== undefined) updates.label = str(args.label) || null
  if (typeof args.is_active === 'boolean') updates.is_active = args.is_active

  const newDest = str(args.webhook_url) || str(args.email) || str(args.discord_user_id) || str(args.recipient)
  if (newDest) {
    const verified = await verifyChannelConfig(channel.type, str(args.webhook_url), str(args.email), str(args.discord_user_id), str(args.recipient))
    if ('error' in verified) return fail(verified.error)
    updates.config = verified.config
    updates.is_verified = verified.isVerified
  }

  if (Object.keys(updates).length === 0) return fail('Aucune modification fournie')

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .schema('notifications')
    .from('channels')
    .update(updates)
    .eq('id', channelId)
    .select('id, type, label, is_verified, is_active')
    .single()

  if (error) return fail(error.message)
  return ok({ updated: true, channel: data })
}

export async function deleteChannel(orgId: string, args: Args): Promise<McpResult> {
  const channelId = str(args.channel_id)
  if (!channelId) return fail('channel_id requis')
  const channel = await getOrgChannel(orgId, channelId)
  if (!channel) return fail('Canal introuvable dans cette organisation')

  const supabase = createServiceClient()
  const { error } = await supabase
    .schema('notifications')
    .from('channels')
    .delete()
    .eq('id', channelId)

  if (error) return fail(error.message)
  return ok({ deleted: true, note: 'Les workflows liés à ce canal ont été supprimés en cascade' })
}

// ---- Workflows ----

const WORKFLOW_SELECT = `
  id, is_active, created_at,
  events:event_id (slug, label, category),
  channels:channel_id (id, type, label),
  workflow_steps (subject, body, format, step_order)
`

/* eslint-disable @typescript-eslint/no-explicit-any */
function formatWorkflow(wf: any) {
  const step = (wf.workflow_steps || []).sort(
    (a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order
  )[0]
  return {
    id: wf.id,
    is_active: wf.is_active,
    event: wf.events ? { slug: wf.events.slug, label: wf.events.label } : null,
    channel: wf.channels ? { id: wf.channels.id, type: wf.channels.type, label: wf.channels.label } : null,
    message: step ? { subject: step.subject, body: step.body, format: step.format } : null,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listWorkflows(orgId: string, args: Args): Promise<McpResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .schema('notifications')
    .from('workflows')
    .select(WORKFLOW_SELECT)
    .eq('org_id', orgId)
    .order('created_at')

  if (error) return fail(error.message)

  let result = (data || []).map(formatWorkflow)
  const eventSlug = str(args.event_slug)
  if (eventSlug) result = result.filter((w) => w.event?.slug === eventSlug)
  return ok(result)
}

export async function createWorkflow(orgId: string, userId: string, args: Args): Promise<McpResult> {
  const eventSlug = str(args.event_slug)
  const channelId = str(args.channel_id)
  const body = typeof args.body === 'string' ? args.body : ''
  if (!eventSlug || !channelId || !body.trim()) {
    return fail('event_slug, channel_id et body sont requis')
  }

  const supabase = createServiceClient()
  const orgApp = await resolveOrgApp(orgId)

  const { data: event } = await supabase
    .schema('notifications')
    .from('events')
    .select('id, slug, supported_channels')
    .eq('app', orgApp)
    .eq('slug', eventSlug)
    .eq('is_active', true)
    .single()
  if (!event) return fail(`Événement inconnu: ${eventSlug} (voir list_events)`)

  const channel = await getOrgChannel(orgId, channelId)
  if (!channel) return fail('Canal introuvable dans cette organisation (voir list_channels)')
  if (!event.supported_channels.includes(channel.type)) {
    return fail(`L'événement ${eventSlug} ne supporte pas le canal ${channel.type} (supportés: ${event.supported_channels.join(', ')})`)
  }

  const format =
    str(args.format) || (channel.type === 'email' ? 'html' : channel.type === 'discord_webhook' ? 'markdown' : 'text')

  const { data: workflow, error: wfError } = await supabase
    .schema('notifications')
    .from('workflows')
    .insert({
      org_id: orgId,
      event_id: event.id,
      channel_id: channelId,
      is_active: true,
      created_by: userId,
    })
    .select('id')
    .single()
  if (wfError || !workflow) return fail(wfError?.message || 'Erreur création workflow')

  const { error: stepError } = await supabase
    .schema('notifications')
    .from('workflow_steps')
    .insert({
      workflow_id: workflow.id,
      step_order: 1,
      step_type: 'send',
      subject: str(args.subject) || null,
      body,
      format,
    })
  if (stepError) {
    await supabase.schema('notifications').from('workflows').delete().eq('id', workflow.id)
    return fail(stepError.message)
  }

  return ok({
    created: true,
    workflow_id: workflow.id,
    hint: 'Utilisez test_workflow pour vérifier le rendu avant la production',
  })
}

async function getOrgWorkflow(orgId: string, workflowId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .schema('notifications')
    .from('workflows')
    .select('id, org_id, event_id, channel_id, is_active')
    .eq('id', workflowId)
    .eq('org_id', orgId)
    .single()
  return data
}

export async function updateWorkflow(orgId: string, args: Args): Promise<McpResult> {
  const workflowId = str(args.workflow_id)
  if (!workflowId) return fail('workflow_id requis')
  const workflow = await getOrgWorkflow(orgId, workflowId)
  if (!workflow) return fail('Workflow introuvable dans cette organisation')

  const supabase = createServiceClient()

  // Modifs sur le workflow lui-même : activation et/ou canal de destination.
  const wfUpdates: Record<string, unknown> = {}
  if (typeof args.is_active === 'boolean') wfUpdates.is_active = args.is_active

  const newChannelId = str(args.channel_id)
  if (newChannelId) {
    const channel = await getOrgChannel(orgId, newChannelId)
    if (!channel) return fail('Canal introuvable dans cette organisation')
    wfUpdates.channel_id = newChannelId
  }

  if (Object.keys(wfUpdates).length > 0) {
    const { error } = await supabase
      .schema('notifications')
      .from('workflows')
      .update(wfUpdates)
      .eq('id', workflowId)
    if (error) return fail(error.message)
  }

  const stepUpdates: Record<string, unknown> = {}
  if (args.subject !== undefined) stepUpdates.subject = str(args.subject) || null
  if (typeof args.body === 'string' && args.body.trim()) stepUpdates.body = args.body
  if (str(args.format)) stepUpdates.format = str(args.format)

  if (Object.keys(stepUpdates).length > 0) {
    const { error } = await supabase
      .schema('notifications')
      .from('workflow_steps')
      .update(stepUpdates)
      .eq('workflow_id', workflowId)
    if (error) return fail(error.message)
  }

  return ok({ updated: true, workflow_id: workflowId })
}

export async function deleteWorkflow(orgId: string, args: Args): Promise<McpResult> {
  const workflowId = str(args.workflow_id)
  if (!workflowId) return fail('workflow_id requis')
  const workflow = await getOrgWorkflow(orgId, workflowId)
  if (!workflow) return fail('Workflow introuvable dans cette organisation')

  const supabase = createServiceClient()
  const { error } = await supabase
    .schema('notifications')
    .from('workflows')
    .delete()
    .eq('id', workflowId)
  if (error) return fail(error.message)
  return ok({ deleted: true })
}

export async function testWorkflow(orgId: string, userId: string, args: Args): Promise<McpResult> {
  const workflowId = str(args.workflow_id)
  if (!workflowId) return fail('workflow_id requis')

  const supabase = createServiceClient()
  const { data: workflow } = await supabase
    .schema('notifications')
    .from('workflows')
    .select('*, events:event_id (*), channels:channel_id (*), workflow_steps (subject, body, format, step_order)')
    .eq('id', workflowId)
    .eq('org_id', orgId)
    .single()

  if (!workflow) return fail('Workflow introuvable dans cette organisation')

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const event = workflow.events as any as NotificationEvent
  const channel = workflow.channels as any
  const steps = (workflow.workflow_steps as any[]) || []
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (!channel || steps.length === 0) return fail('Workflow incomplet (canal ou message manquant)')
  if (!channel.is_active || !channel.is_verified) return fail('Canal inactif ou non vérifié')

  const step = steps.sort((a, b) => a.step_order - b.step_order)[0]

  // Payload : valeurs générées du schéma, surchargées par celles fournies
  const generated: Record<string, unknown> = {}
  for (const [key, type] of Object.entries((event.payload_schema as Record<string, string>) || {})) {
    generated[key] = type === 'number' ? 42 : type === 'boolean' ? true : `Test ${key.replace(/_/g, ' ')}`
  }
  const payload = { ...generated, ...((args.payload as Record<string, unknown>) || {}) }

  // Override email éventuel
  let config = channel.config
  const overrideEmail = str(args.override_email)
  if (overrideEmail) {
    if (channel.type !== 'email') return fail("override_email ne s'applique qu'aux canaux email")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(overrideEmail)) return fail('Adresse email de test invalide')
    config = { ...channel.config, email: overrideEmail }
  }

  // Canal MP "membre concerné" : le test s'envoie à l'admin testeur lui-même
  if (channel.type === 'discord_dm' && channel.config?.recipient === 'member') {
    const discordId = await resolveDiscordUserId(userId)
    if (!discordId) return fail('Aucun compte Discord lié à votre profil pour recevoir le test')
    config = { ...channel.config, discord_user_id: discordId }
  }

  // Canal email "membre concerné" : sans override, le test part à l'email de l'admin
  if (channel.type === 'email' && channel.config?.recipient === 'member' && !overrideEmail) {
    const email = await resolveUserEmail(userId)
    if (!email) return fail('Aucune adresse email liée à votre profil pour recevoir le test')
    config = { ...channel.config, email }
  }

  const dispatcher = getDispatcher(channel.type)
  if (!dispatcher) return fail(`Dispatcher non trouvé pour le type: ${channel.type}`)

  const sender = await getSenderIdentity(orgId)
  const result = await dispatcher({
    config,
    event,
    payload,
    step: { subject: step.subject, body: step.body, format: step.format },
    sender,
  })

  await logExecution({
    workflowId,
    eventSlug: event.slug,
    channelId: channel.id,
    userId,
    orgId,
    payload,
    success: result.success,
    error: result.error,
    isTest: true,
  })

  if (!result.success) return fail(`Échec de l'envoi: ${result.error}`)
  return ok({
    sent: true,
    test_payload: payload,
    destination: overrideEmail || 'canal du workflow',
    // Le test fonctionne même sur un workflow inactif (pour vérifier le rendu
    // avant activation) — on rend l'état explicite.
    ...(!workflow.is_active && {
      warning: "Ce workflow est INACTIF : le test est parti, mais les événements réels ne déclencheront rien tant qu'il n'est pas activé (update_workflow is_active=true)",
    }),
  })
}

// ---- Historique ----

export async function getLogs(orgId: string, args: Args): Promise<McpResult> {
  const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100)
  const supabase = createServiceClient()
  let query = supabase
    .schema('notifications')
    .from('workflow_executions')
    .select('id, event_slug, status, error_message, sent_at, created_at, channels:channel_id (type, label)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  const status = str(args.status)
  if (status) query = query.eq('status', status)
  const eventSlug = str(args.event_slug)
  if (eventSlug) query = query.eq('event_slug', eventSlug)

  const { data, error } = await query
  if (error) return fail(error.message)
  return ok(data || [])
}

// ---- Marque blanche ----

export async function getSenderIdentityTool(orgId: string): Promise<McpResult> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .schema('notifications')
    .from('org_settings')
    .select('sender_name, reply_to, sender_domain, sender_local_part, domain_status')
    .eq('org_id', orgId)
    .single()

  return ok(
    data || {
      sender_name: null,
      reply_to: null,
      sender_domain: null,
      domain_status: 'unconfigured',
      note: "Aucune identité configurée — les envois utilisent l'identité par défaut Quatools",
    }
  )
}

export async function setSenderIdentity(orgId: string, args: Args): Promise<McpResult> {
  const senderName = str(args.sender_name) || null
  const replyTo = str(args.reply_to) || null

  if (senderName && senderName.length > 80) return fail("Nom d'expéditeur trop long (80 caractères max)")
  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) return fail('Adresse de réponse invalide')

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .schema('notifications')
    .from('org_settings')
    .upsert({ org_id: orgId, sender_name: senderName, reply_to: replyTo }, { onConflict: 'org_id' })
    .select('sender_name, reply_to')
    .single()

  if (error) return fail(error.message)
  return ok({ updated: true, settings: data })
}

export async function setupSendingDomain(orgId: string, args: Args): Promise<McpResult> {
  const domain = str(args.domain)?.toLowerCase()
  if (!domain || !/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(domain)) {
    return fail('Nom de domaine invalide (ex: monclub.fr)')
  }
  const localPart = str(args.local_part)?.toLowerCase() || 'notifications'

  const supabase = createServiceClient()
  const { data: existing } = await supabase
    .schema('notifications')
    .from('org_settings')
    .select('domain_provider_id')
    .eq('org_id', orgId)
    .single()
  if (existing?.domain_provider_id) {
    return fail("Un domaine est déjà configuré pour cette organisation (voir check_sending_domain)")
  }

  try {
    const tem = await createTemDomain(domain)
    await supabase
      .schema('notifications')
      .from('org_settings')
      .upsert(
        {
          org_id: orgId,
          sender_domain: tem.name,
          sender_local_part: localPart,
          domain_status: mapTemStatus(tem.status),
          domain_provider_id: tem.id,
          domain_dns_records: tem.records,
        },
        { onConflict: 'org_id' }
      )

    return ok({
      registered: true,
      domain: tem.name,
      future_from: `${localPart}@${tem.name}`,
      dns_records_to_add: tem.records,
      next_step:
        "L'organisation doit ajouter ces enregistrements DNS chez son hébergeur, puis appeler check_sending_domain",
    })
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Échec de l'enregistrement du domaine")
  }
}

export async function checkSendingDomain(orgId: string): Promise<McpResult> {
  const supabase = createServiceClient()
  const { data: settings } = await supabase
    .schema('notifications')
    .from('org_settings')
    .select('domain_provider_id, sender_local_part')
    .eq('org_id', orgId)
    .single()

  if (!settings?.domain_provider_id) {
    return fail('Aucun domaine configuré (utilisez setup_sending_domain)')
  }

  try {
    await checkTemDomain(settings.domain_provider_id).catch(() => null) // best effort
    const tem = await getTemDomain(settings.domain_provider_id)
    const status = mapTemStatus(tem.status)

    await supabase
      .schema('notifications')
      .from('org_settings')
      .update({ domain_status: status, domain_dns_records: tem.records })
      .eq('org_id', orgId)

    return ok({
      domain: tem.name,
      status,
      from_address_active: status === 'verified' ? `${settings.sender_local_part || 'notifications'}@${tem.name}` : null,
      last_error: tem.last_error,
      dns_records_expected: status !== 'verified' ? tem.records : undefined,
    })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Échec de la vérification')
  }
}
