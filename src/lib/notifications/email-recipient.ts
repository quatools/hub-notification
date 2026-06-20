import { createServiceClient } from '@/lib/supabase/server'

/**
 * Résout l'adresse email d'un utilisateur à partir de son compte auth.
 * Utilisé pour tester un canal email "membre concerné" : le test part à
 * l'adresse de l'admin testeur lui-même (symétrique du MP Discord).
 * Retourne null si aucune adresse n'est connue.
 */
export async function resolveUserEmail(userId: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) {
    console.error('Erreur résolution email utilisateur:', error)
    return null
  }
  return data.user?.email || null
}
