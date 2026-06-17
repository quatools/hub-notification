/**
 * Secret HMAC interne du hub (signatures de jetons : désabonnement, etc.).
 * Centralise le contrôle d'entropie minimale pour éviter qu'un déploiement
 * laisse la valeur d'exemple (« change-me… »).
 */

const MIN_LENGTH = 32

/** Renvoie le secret, ou lève si absent/trop court (à utiliser pour signer). */
export function getSigningSecret(): string {
  const s = process.env.MCP_OAUTH_SECRET || process.env.UNSUBSCRIBE_SECRET || ""
  if (s.length < MIN_LENGTH) {
    throw new Error(
      `Secret de signature manquant ou trop court (MCP_OAUTH_SECRET, min. ${MIN_LENGTH} caractères)`
    )
  }
  return s
}

/** Variante fail-closed pour les chemins de vérification (renvoie null si invalide). */
export function getSigningSecretOrNull(): string | null {
  try {
    return getSigningSecret()
  } catch {
    return null
  }
}
