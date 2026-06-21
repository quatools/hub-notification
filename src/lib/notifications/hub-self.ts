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
export async function notifyOperator(event: string, payload: Record<string, unknown>): Promise<void> {
  const key = process.env.HUB_SELF_API_KEY
  const orgId = process.env.HUB_SELF_ORG_ID
  const base = process.env.HUB_SELF_URL
  if (!key || !orgId || !base) return

  try {
    await fetch(`${base.replace(/\/$/, '')}/api/notifications/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ event, org_id: orgId, payload }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // silencieux : non bloquant
  }
}
