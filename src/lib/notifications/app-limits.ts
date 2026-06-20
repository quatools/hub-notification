/**
 * Garde-fou anti-abus du self-service : une app 'trial' ne peut émettre que
 * jusqu'à son plafond (trial_limit) ; au-delà (ou si 'blocked'), l'emit est
 * refusé tant que l'opérateur n'a pas débloqué l'app après revue.
 */
import { createServiceClient } from '@/lib/supabase/server'

export async function checkAppSendGate(
  appId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const sb = createServiceClient()
  const { data: app } = await sb
    .schema('notifications')
    .from('apps')
    .select('status, send_count, trial_limit')
    .eq('id', appId)
    .maybeSingle()

  if (!app) return { allowed: true } // clé env (pas une app DB) : pas de plafond
  if (app.status === 'blocked') {
    return { allowed: false, reason: "Application bloquée par l'opérateur." }
  }
  if (app.status === 'trial' && app.send_count >= app.trial_limit) {
    return {
      allowed: false,
      reason: `Limite d'essai atteinte (${app.trial_limit} envois). En attente de validation par l'opérateur.`,
    }
  }
  return { allowed: true }
}

/** Incrémente le compteur d'envois réels (read-modify-write ; concurrence faible). */
export async function incrementAppSendCount(appId: string, n: number) {
  if (n <= 0) return
  const sb = createServiceClient()
  const { data } = await sb
    .schema('notifications')
    .from('apps')
    .select('send_count')
    .eq('id', appId)
    .maybeSingle()
  if (!data) return
  await sb
    .schema('notifications')
    .from('apps')
    .update({ send_count: (data.send_count || 0) + n })
    .eq('id', appId)
}
