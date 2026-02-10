import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

interface AdminAuthResult {
  user_id: string
  org_id: string
}

/**
 * Vérifie que l'utilisateur est authentifié et admin de l'organisation.
 * Retourne { user_id, org_id } ou null si non autorisé.
 *
 * TODO: Quand le schéma BAAS sera connu, vérifier le rôle admin via
 * la table d'appartenance à l'org (ex: public.org_members).
 * Pour l'instant, on vérifie simplement que l'utilisateur est authentifié
 * et que l'org_id est fourni.
 */
export async function getAdminAuth(orgId: string | null): Promise<AdminAuthResult | null> {
  if (!orgId) return null

  const user = await getAuthenticatedUser()
  if (!user) return null

  // TODO: Vérifier le rôle admin dans la table BAAS
  // Exemple futur :
  // const { data } = await supabase
  //   .from('org_members')
  //   .select('role')
  //   .eq('user_id', user.id)
  //   .eq('org_id', orgId)
  //   .single()
  // if (!data || data.role !== 'admin') return null

  return {
    user_id: user.id,
    org_id: orgId,
  }
}

/**
 * Vérifie que l'utilisateur est admin de l'org propriétaire d'une ressource.
 * Utile pour PUT/DELETE où on a l'ID de la ressource mais pas l'org_id directement.
 */
export async function getAdminAuthForChannel(channelId: string): Promise<AdminAuthResult | null> {
  const user = await getAuthenticatedUser()
  if (!user) return null

  const supabase = createServiceClient()
  const { data: channel } = await supabase
    .schema('notifications')
    .from('channels')
    .select('org_id')
    .eq('id', channelId)
    .single()

  if (!channel || !channel.org_id) return null

  return getAdminAuth(channel.org_id)
}

/**
 * Vérifie que l'utilisateur est admin de l'org propriétaire d'un workflow.
 */
export async function getAdminAuthForWorkflow(workflowId: string): Promise<AdminAuthResult | null> {
  const user = await getAuthenticatedUser()
  if (!user) return null

  const supabase = createServiceClient()
  const { data: workflow } = await supabase
    .schema('notifications')
    .from('workflows')
    .select('org_id')
    .eq('id', workflowId)
    .single()

  if (!workflow) return null

  return getAdminAuth(workflow.org_id)
}
