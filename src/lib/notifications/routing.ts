import { createServiceClient } from '@/lib/supabase/server'
import { getDefaultTemplate } from './default-templates'
import type { NotificationEvent, NotificationTemplate } from '@/lib/types/notifications'

export interface RouteResult {
  user_id: string
  channel_id: string
  channel_type: string
  channel_config: Record<string, unknown>
  template: NotificationTemplate | null
}

/**
 * Résout les routes de notification pour un événement donné.
 * Retourne la liste des (user, channel, template) à dispatcher.
 */
export async function resolveRoutes(
  event: NotificationEvent,
  orgId: string,
  targetUsers?: string[]
): Promise<RouteResult[]> {
  const supabase = createServiceClient()

  // 1. Trouver les préférences actives pour cet event dans cette org
  let query = supabase
    .schema('notifications')
    .from('preferences')
    .select(`
      user_id,
      channel_id,
      channels:channel_id (
        id,
        type,
        config,
        is_active,
        is_verified
      )
    `)
    .eq('event_id', event.id)
    .eq('org_id', orgId)
    .eq('is_active', true)

  // Filtrer par target_users si fourni
  if (targetUsers && targetUsers.length > 0) {
    query = query.in('user_id', targetUsers)
  }

  const { data: preferences, error } = await query

  if (error) {
    console.error('Erreur routing - fetch preferences:', error)
    return []
  }

  if (!preferences || preferences.length === 0) {
    return []
  }

  // 2. Charger les templates pour cet event
  const { data: templates } = await supabase
    .schema('notifications')
    .from('templates')
    .select('*')
    .eq('event_id', event.id)

  const templatesByType = new Map<string, NotificationTemplate>()
  if (templates) {
    for (const t of templates) {
      templatesByType.set(t.channel_type, t as NotificationTemplate)
    }
  }

  // 3. Construire les routes
  const routes: RouteResult[] = []

  for (const pref of preferences) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = pref.channels as any
    if (!channel) continue

    // Vérifier que le canal est actif et vérifié
    if (!channel.is_active || !channel.is_verified) continue

    // Récupérer le template (DB ou fallback par défaut)
    let template = templatesByType.get(channel.type) ?? null
    if (!template) {
      const defaultTpl = getDefaultTemplate(event.slug, channel.type)
      if (defaultTpl) {
        template = {
          id: '',
          event_id: event.id,
          channel_type: channel.type,
          subject: defaultTpl.subject ?? null,
          body: defaultTpl.body,
          format: defaultTpl.format,
          created_at: '',
          updated_at: '',
        }
      }
    }

    routes.push({
      user_id: pref.user_id,
      channel_id: channel.id,
      channel_type: channel.type,
      channel_config: channel.config,
      template,
    })
  }

  return routes
}
