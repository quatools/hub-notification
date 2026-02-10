import { createClient } from './server'

/**
 * Récupère l'utilisateur authentifié depuis les cookies de la requête.
 * À utiliser dans les API routes front-facing (pas les API server-to-server).
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}
