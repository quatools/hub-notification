/**
 * Alertes opérateur — dogfood : le hub se notifie lui-même via SA PROPRE app
 * système (« hub-notification »). Quand un événement opérateur survient
 * (ex. création d'une app), on émet vers une org opérateur, qui route ensuite
 * vers le canal configuré (Discord/email de l'opérateur).
 *
 * Config (env du hub déployé) :
 *   HUB_SELF_API_KEY  — clé API de l'app hub-notification (Bearer).
 *   HUB_SELF_ORG_ID   — org opérateur destinataire.
 *   HUB_SELF_URL      — base URL du hub (ex. https://hub.quatools.fr).
 *
 * No-op si non configuré. Toujours non bloquant : une alerte ratée ne doit
 * JAMAIS casser l'action métier (création d'app, etc.).
 */
export interface SelfRecipient {
  app_user_id?: string
  email?: string
  discord_id?: string
  name?: string
}

export async function notifyOperator(
  event: string,
  payload: Record<string, unknown>,
  recipients?: SelfRecipient[]
): Promise<void> {
  const key = process.env.HUB_SELF_API_KEY
  const orgId = process.env.HUB_SELF_ORG_ID
  const base = process.env.HUB_SELF_URL
  if (!key || !orgId || !base) return

  try {
    await fetch(`${base.replace(/\/$/, '')}/api/notifications/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      // `recipients` permet aux canaux « membre concerné » (ex. mail de bienvenue
      // au créateur de l'app) de résoudre le destinataire.
      body: JSON.stringify({ event, org_id: orgId, payload, recipients }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // silencieux : non bloquant
  }
}
