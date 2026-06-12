import { createServiceClient } from '@/lib/supabase/server'

/**
 * Journalise une exécution (envoi réel ou test) dans workflow_executions.
 * Best effort : une erreur de journalisation ne doit jamais faire échouer l'envoi.
 */
export async function logExecution(params: {
  workflowId: string
  eventSlug: string
  channelId: string | null
  userId: string
  orgId: string
  payload: Record<string, unknown>
  success: boolean
  error?: string | null
  isTest?: boolean
}): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase
      .schema('notifications')
      .from('workflow_executions')
      .insert({
        workflow_id: params.workflowId,
        event_slug: params.eventSlug,
        channel_id: params.channelId,
        user_id: params.userId,
        org_id: params.orgId,
        status: params.success ? 'sent' : 'failed',
        payload: params.payload,
        error_message: params.error || null,
        sent_at: params.success ? new Date().toISOString() : null,
        attempts: 1,
        is_test: params.isTest ?? false,
      })
  } catch (error) {
    console.error('Erreur journalisation exécution:', error)
  }
}
