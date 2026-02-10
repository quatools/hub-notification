import type { NotificationEvent } from '@/lib/types/notifications'
import { dispatchDiscordWebhook } from './discord-webhook'
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
}

type DispatchFn = (params: DispatchParams) => Promise<DispatchResult>

/** Registry des dispatchers par type de canal */
const dispatchers: Record<string, DispatchFn> = {
  discord_webhook: dispatchDiscordWebhook,
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
