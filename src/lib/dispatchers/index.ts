import type { NotificationEvent } from '@/lib/types/notifications'
import type { SenderIdentity } from '@/lib/notifications/sender'
import { dispatchDiscordWebhook } from './discord-webhook'
import { dispatchDiscordDm } from './discord-dm'
import { dispatchEmail } from './email'

export interface DispatchResult {
  success: boolean
  error?: string
}

export interface DispatchParams {
  config: Record<string, unknown>
  event: NotificationEvent
  payload: Record<string, unknown>
  step: {
    subject: string | null
    body: string
    format: 'text' | 'html' | 'markdown'
  }
  /** Identité d'expéditeur de l'organisation (marque blanche) */
  sender?: SenderIdentity
  /** URL de désabonnement 1-clic (List-Unsubscribe), pour les canaux email. */
  unsubUrl?: string
}

type DispatchFn = (params: DispatchParams) => Promise<DispatchResult>

/** Registry des dispatchers par type de canal */
const dispatchers: Record<string, DispatchFn> = {
  discord_webhook: dispatchDiscordWebhook,
  discord_dm: dispatchDiscordDm,
  email: dispatchEmail,
}

/**
 * Retourne la fonction de dispatch pour un type de canal donné.
 */
export function getDispatcher(channelType: string): DispatchFn | null {
  return dispatchers[channelType] ?? null
}

/**
 * Vérifie si un type de canal est supporté.
 */
export function isSupportedChannel(channelType: string): boolean {
  return channelType in dispatchers
}
