/**
 * Helpers cryptographiques pour le serveur OAuth 2.1 du MCP.
 * Transposé du pattern BAAS Esport.
 *
 * - Access tokens = JWT auto-portants signés HS256 (secret MCP_OAUTH_SECRET),
 *   validables sans lookup DB (compatible serverless).
 * - PKCE (S256) + génération/hash de tokens opaques (codes, refresh tokens).
 */

import { SignJWT, jwtVerify } from 'jose'
import { createHash, randomBytes } from 'crypto'

let cachedKey: Uint8Array | null = null
function getKey(): Uint8Array {
  if (cachedKey) return cachedKey
  const secret = process.env.MCP_OAUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'MCP_OAUTH_SECRET manquant ou trop court (>=32 caractères requis) pour signer les tokens OAuth du MCP'
    )
  }
  cachedKey = new TextEncoder().encode(secret)
  return cachedKey
}

const ACCESS_TOKEN_TTL_SECONDS = 3600 // 1h

export interface AccessTokenClaims {
  sub: string // user_id (auth.users.id)
  orgId: string
  scope: string
  aud: string // URI canonique de la ressource MCP de l'org
  iss: string
}

/** Signe un access token JWT pour un (utilisateur, org, ressource). */
export async function signAccessToken(params: {
  userId: string
  orgId: string
  resource: string
  issuer: string
  scope?: string
}): Promise<string> {
  return new SignJWT({ orgId: params.orgId, scope: params.scope || 'mcp' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(params.userId)
    .setAudience(params.resource)
    .setIssuer(params.issuer)
    .setIssuedAt()
    .setJti(randomToken(16))
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getKey())
}

/** Vérifie un access token (signature + exp). Retourne null si invalide. */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getKey(), { clockTolerance: 30 })
    if (!payload.sub || !payload.orgId || !payload.aud) return null
    return {
      sub: payload.sub,
      orgId: payload.orgId as string,
      scope: (payload.scope as string) || 'mcp',
      aud: Array.isArray(payload.aud) ? payload.aud[0] : (payload.aud as string),
      iss: payload.iss as string,
    }
  } catch {
    return null
  }
}

export const accessTokenTtlSeconds = ACCESS_TOKEN_TTL_SECONDS

/** Génère un token opaque aléatoire (hex). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

/** Hash SHA-256 (hex) — pour stocker les refresh tokens sans clair. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** PKCE : BASE64URL(SHA256(verifier)). */
export function pkceChallengeFromVerifier(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

/** Vérifie un couple PKCE (méthode S256 uniquement). */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false
  return pkceChallengeFromVerifier(verifier) === challenge
}
