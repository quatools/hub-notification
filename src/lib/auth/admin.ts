import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { isOrgAdmin, listAdminOrgs, type OrgRef } from '@/lib/auth/orgs'

interface AdminAuthResult {
  user_id: string
  org_id: string
}

/**
 * Vérifie que l'utilisateur est authentifié et admin de l'org.
 * Droits résolus en UNION : club_admins du BAAS OU org_admins du hub (Storm…).
 */
export async function getAdminAuth(orgId: string | null): Promise<AdminAuthResult | null> {
  if (!orgId) return null

  const user = await getAuthenticatedUser()
  if (!user) return null

  if (!(await isOrgAdmin(user.id, orgId))) return null

  return {
    user_id: user.id,
    org_id: orgId,
  }
}

/**
 * Retourne la liste des organisations dont l'utilisateur est admin
 * (clubs BAAS ∪ orgs hub).
 */
export async function getUserClubs(userId: string): Promise<OrgRef[]> {
  return listAdminOrgs(userId)
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
