import { renderTemplate } from '@/lib/notifications/templates'
import type { DispatchResult, DispatchParams } from './index'

/** Couleurs Discord par catégorie d'événement */
const CATEGORY_COLORS: Record<string, number> = {
  billing: 0x3498db,  // bleu
  member: 0x2ecc71,   // vert
  team: 0xe67e22,     // orange
  shop: 0x9b59b6,     // violet
  system: 0x95a5a6,   // gris
}

function getCategoryColor(category: string): number {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.system
}

export async function dispatchDiscordWebhook(params: DispatchParams): Promise<DispatchResult> {
  const { config, event, payload, step, sender } = params

  const webhookUrl = config.webhook_url as string
  if (!webhookUrl) {
    return { success: false, error: 'webhook_url manquant dans la config du canal' }
  }

  // Valider l'URL
  if (
    !webhookUrl.startsWith('https://discord.com/api/webhooks/') &&
    !webhookUrl.startsWith('https://discordapp.com/api/webhooks/')
  ) {
    return { success: false, error: 'URL webhook Discord invalide' }
  }

  // Construire la description depuis le step template
  const description = step.body
    ? renderTemplate(step.body, payload)
    : `Événement: ${event.label}`

  // Construire l'embed (username = nom de l'org si configuré, marque blanche)
  const body = {
    ...(sender?.name && { username: sender.name }),
    embeds: [
      {
        title: event.label,
        description,
        color: getCategoryColor(event.category),
        footer: { text: sender?.name || 'Quatools Notifications' },
        timestamp: new Date().toISOString(),
      },
    ],
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')

      if (response.status === 429) {
        return { success: false, error: `Discord rate limit. ${errorText}` }
      }
      if (response.status === 404) {
        return { success: false, error: 'Webhook Discord introuvable (404). Le webhook a peut-être été supprimé.' }
      }

      return { success: false, error: `Discord HTTP ${response.status}: ${errorText}` }
    }

    return { success: true }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, error: 'Timeout: Discord n\'a pas répondu dans les 10 secondes' }
    }
    return { success: false, error: `Erreur Discord: ${error instanceof Error ? error.message : 'Unknown'}` }
  }
}
