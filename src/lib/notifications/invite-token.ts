/**
 * Jeton d'invitation à une équipe (signé par le HUB, pas par une app).
 * Un owner génère un lien ; quiconque le suit et se connecte rejoint l'org avec
 * le rôle indiqué. Signé HMAC-SHA256 avec le secret de signature interne du hub.
 */
import { createHmac, timingSafeEqual } from 'crypto'
import { getSigningSecret } from '@/lib/signing-secret'

export interface InviteTokenPayload {
  org_id: string
  role: 'owner' | 'admin'
  exp: number // unix seconds
}

export function mintInviteToken(payload: InviteTokenPayload): string {
  const secret = getSigningSecret()
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyInviteToken(token: string): InviteTokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts

  let payload: InviteTokenPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!payload.org_id || (payload.role !== 'owner' && payload.role !== 'admin')) return null

  let secret: string
  try {
    secret = getSigningSecret()
  } catch {
    return null
  }
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('base64url'))
  const a = Buffer.from(sig)
  if (a.length !== expected.length || !timingSafeEqual(a, expected)) return null

  if (!payload.exp || payload.exp * 1000 < Date.now()) return null
  return payload
}
