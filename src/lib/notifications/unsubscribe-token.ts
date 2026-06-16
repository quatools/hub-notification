import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Jeton de désabonnement 1-clic (List-Unsubscribe).
 * Signé HMAC-SHA256 avec un secret serveur (MCP_OAUTH_SECRET) — interne au hub,
 * pas lié à une app. Sans expiration : un lien présent dans un vieil email doit
 * rester valide. Encode la personne (recipient) + le workflow concerné.
 */

const SECRET = process.env.MCP_OAUTH_SECRET || process.env.UNSUBSCRIBE_SECRET || ''

export interface UnsubPayload {
  r: string // recipient_id
  w: string // workflow_id
}

export function mintUnsubToken(payload: UnsubPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyUnsubToken(token: string): UnsubPayload | null {
  if (!SECRET) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null

  const expected = createHmac('sha256', SECRET).update(body).digest('base64url')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload?.r || !payload?.w) return null
    return { r: String(payload.r), w: String(payload.w) }
  } catch {
    return null
  }
}
