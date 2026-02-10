import { createServiceClient } from '@/lib/supabase/server'
import type { NotificationEvent } from '@/lib/types/notifications'

export interface RouteResult {
  workflow_id: string
  user_id: string
  channel_id: string
  channel_type: string
  channel_config: Record<string, unknown>
  step: {
    subject: string | null
    body: string
    format: 'text' | 'html' | 'markdown'
  }
}

/**
 * Résout les routes de notification via les workflows.
 * Pour chaque workflow actif (event + org), retourne le canal et le template à utiliser.
 */
export async function resolveRoutes(
  event: NotificationEvent,
  orgId: string,
  targetUsers?: string[]
): Promise<RouteResult[]> {
  const supabase = createServiceClient()

  // 1. Trouver tous les workflows actifs pour cet event + org
  const { data: workflows, error } = await supabase
    .schema('notifications')
    .from('workflows')
    .select(`
      id,
      channel_id,
      created_by,
      channels:channel_id (
        id,
        type,
        config,
        is_active,
        is_verified
      ),
      workflow_steps (
        subject,
        body,
        format,
        step_order
      )
    `)
    .eq('event_id', event.id)
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (error) {
    console.error('Erreur routing - fetch workflows:', error)
    return []
  }

  if (!workflows || workflows.length === 0) {
    return []
  }

  // 2. Charger les opt-outs si on a des target_users
  let optoutSet = new Set<string>()
  if (targetUsers && targetUsers.length > 0) {
    const workflowIds = workflows.map((w) => w.id)
    const { data: optouts } = await supabase
      .schema('notifications')
      .from('user_optouts')
      .select('user_id, workflow_id')
      .in('workflow_id', workflowIds)
      .in('user_id', targetUsers)

    if (optouts) {
      // Set de "userId:workflowId" pour lookup rapide
      optoutSet = new Set(optouts.map((o) => `${o.user_id}:${o.workflow_id}`))
    }
  }

  // 3. Construire les routes
  const routes: RouteResult[] = []

  for (const wf of workflows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = wf.channels as any
    if (!channel) continue

    // Vérifier que le canal est actif et vérifié
    if (!channel.is_active || !channel.is_verified) continue

    // Récupérer le step (premier par step_order)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const steps = wf.workflow_steps as any[]
    if (!steps || steps.length === 0) continue
    const step = steps.sort((a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order)[0]

    // Déterminer les users concernés
    // Pour les canaux d'org (webhook Discord), le "user" est le créateur du workflow
    // Pour les events audience "member" avec target_users, on envoie à chaque target
    const usersToNotify = targetUsers && targetUsers.length > 0
      ? targetUsers
      : [wf.created_by]  // Par défaut, notifier le créateur du workflow (admin)

    for (const userId of usersToNotify) {
      // Vérifier opt-out
      if (optoutSet.has(`${userId}:${wf.id}`)) continue

      routes.push({
        workflow_id: wf.id,
        user_id: userId,
        channel_id: channel.id,
        channel_type: channel.type,
        channel_config: channel.config,
        step: {
          subject: step.subject,
          body: step.body,
          format: step.format,
        },
      })
    }
  }

  return routes
}
