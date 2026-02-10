import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

interface AdminAuthResult {
  user_id: string
  org_id: string
}

/**
 * Vérifie que l'utilisateur est authentifié et admin du club (org).
 * Vérifie dans la table public.club_admins du BAAS.
 */
export async function getAdminAuth(orgId: string | null): Promise<AdminAuthResult | null> {
  if (!orgId) return null

  const user = await getAuthenticatedUser()
  if (!user) return null

  const supabase = createServiceClient()
  const { data: admin } = await supabase
    .from('club_admins')
    .select('id')
    .eq('user_id', user.id)
    .eq('club_id', orgId)
    .eq('is_active', true)
    .single()

  if (!admin) return null

  return {
    user_id: user.id,
    org_id: orgId,
  }
}

/**
 * Retourne la liste des clubs dont l'utilisateur est admin.
 */
export async function getUserClubs(userId: string): Promise<Array<{
  club_id: string
  club_name: string
  club_slug: string
  role: string
}>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('get_user_clubs', {
    user_uuid: userId,
  })

  if (error || !data) return []
  return data
}

/**
 * Vérifie que l'utilisateur est admin de l'org propriétaire d'un canal.
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
