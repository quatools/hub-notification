import { renderTemplate } from '@/lib/notifications/templates'
import type { DispatchResult, DispatchParams } from './index'

/**
 * Envoi de message privé Discord via le bot partagé (app "Notify").
 * Pur REST : ouverture du canal DM puis envoi — pas de connexion gateway.
 *
 * Conditions Discord :
 * - le bot doit partager un serveur avec le destinataire (le club a invité le bot)
 * - le destinataire peut bloquer les MP des membres du serveur (erreur 50007)
 *
 * Config canal : { "discord_user_id": "123456789012345678" }
 */

const DISCORD_API = 'https://discord.com/api/v10'

/** Couleurs d'embed par catégorie (cohérent avec le webhook et l'email) */
const CATEGORY_COLORS: Record<string, number> = {
  billing: 0x3498db,
  member: 0x2ecc71,
  team: 0xe67e22,
  shop: 0x9b59b6,
  system: 0x95a5a6,
}

function getBotToken(): string | null {
  return process.env.DISCORD_BOT_TOKEN || null
}

async function discordFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getBotToken()
  if (!token) throw new Error('DISCORD_BOT_TOKEN non configuré')
  return fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    signal: AbortSignal.timeout(10000),
  })
}

interface DiscordError {
  code?: number
  message?: string
  retry_after?: number
}

export async function dispatchDiscordDm(params: DispatchParams): Promise<DispatchResult> {
  const { config, event, payload, step, sender } = params

  const discordUserId = config.discord_user_id as string
  if (!discordUserId || !/^\d{15,21}$/.test(discordUserId)) {
    return { success: false, error: 'discord_user_id manquant ou invalide dans la config du canal' }
  }

  if (!getBotToken()) {
    return { success: false, error: 'Bot Discord non configuré (DISCORD_BOT_TOKEN requis)' }
  }

  const description = step.body
    ? renderTemplate(step.body, payload)
    : `Événement: ${event.label}`

  try {
    // 1. Ouvrir (ou récupérer) le canal DM avec l'utilisateur
    const dmRes = await discordFetch('/users/@me/channels', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: discordUserId }),
    })

    if (!dmRes.ok) {
      const err = (await dmRes.json().catch(() => ({}))) as DiscordError
      if (dmRes.status === 400 && err.code === 50033) {
        return { success: false, error: 'Utilisateur Discord introuvable (ID invalide)' }
      }
      return { success: false, error: `Discord (ouverture DM) HTTP ${dmRes.status}: ${err.message || 'Unknown'}` }
    }

    const dmChannel = (await dmRes.json()) as { id: string }

    // 2. Envoyer le message (embed marque blanche)
    const msgRes = await discordFetch(`/channels/${dmChannel.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        embeds: [
          {
            author: sender?.name ? { name: sender.name } : undefined,
            title: event.label,
            description,
            color: CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.system,
            footer: { text: sender?.name || 'Quatools Notifications' },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    })

    if (!msgRes.ok) {
      const err = (await msgRes.json().catch(() => ({}))) as DiscordError

      if (err.code === 50007) {
        return {
          success: false,
          error:
            "MP refusé : l'utilisateur n'autorise pas les messages privés des membres du serveur, ou ne partage aucun serveur avec le bot",
        }
      }
      if (msgRes.status === 429) {
        return { success: false, error: `Rate limit Discord (réessayer dans ${err.retry_after ?? '?'}s)` }
      }
      return { success: false, error: `Discord (envoi DM) HTTP ${msgRes.status}: ${err.message || 'Unknown'}` }
    }

    return { success: true }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return { success: false, error: "Timeout: Discord n'a pas répondu dans les 10 secondes" }
    }
    return { success: false, error: `Erreur Discord DM: ${error instanceof Error ? error.message : 'Unknown'}` }
  }
}

/**
 * Vérifie qu'un utilisateur Discord existe (utilisé à la création du canal).
 * Ne garantit pas que le DM aboutira (serveur mutuel + préférences utilisateur),
 * mais valide l'ID.
 */
export async function verifyDiscordUser(discordUserId: string): Promise<{ ok: boolean; username?: string; error?: string }> {
  if (!/^\d{15,21}$/.test(discordUserId)) {
    return { ok: false, error: 'ID Discord invalide (attendu : identifiant numérique)' }
  }
  if (!getBotToken()) {
    return { ok: false, error: 'Bot Discord non configuré (DISCORD_BOT_TOKEN requis)' }
  }
  try {
    const res = await discordFetch(`/users/${discordUserId}`)
    if (!res.ok) {
      return { ok: false, error: res.status === 404 ? 'Utilisateur Discord introuvable' : `Discord HTTP ${res.status}` }
    }
    const user = (await res.json()) as { username?: string; global_name?: string }
    return { ok: true, username: user.global_name || user.username }
  } catch {
    return { ok: false, error: 'Discord injoignable' }
  }
}
