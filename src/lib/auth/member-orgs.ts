import { createServiceClient } from '@/lib/supabase/server'
import { getOrgsByIds, type OrgRef } from '@/lib/auth/orgs'

export type MemberOrg = OrgRef

/**
 * Organisations dont l'utilisateur est DESTINATAIRE (membre), dérivées de
 * l'activité de notification (CDC v2 : "mes orgs" déduites, sans dépendre des
 * tables membres des apps). Permet à un joueur non-admin de voir et gérer ses
 * notifications par club.
 */
export async function getMemberOrgs(authUserId: string): Promise<MemberOrg[]> {
  const supabase = createServiceClient()

  // 1. Le destinataire canonique de cet utilisateur
  const { data: recipient } = await supabase
    .schema('notifications')
    .from('recipients')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (!recipient) return []
  const recipientId = (recipient as { id: string }).id

  // 2. Les org_id distincts des notifications reçues...
  const { data: execs } = await supabase
    .schema('notifications')
    .from('workflow_executions')
    .select('org_id')
    .eq('recipient_id', recipientId)
    .not('org_id', 'is', null)

  const orgIdSet = new Set(((execs as { org_id: string }[] | null) || []).map((e) => e.org_id))

  // ...complétées par les orgs où le membre a déjà posé un refus (opt-out) :
  // l'org reste visible même s'il a tout désactivé (pour pouvoir réactiver).
  const { data: optouts } = await supabase
    .schema('notifications')
    .from('user_optouts')
    .select('workflow_id')
    .eq('recipient_id', recipientId)
  const optoutWfIds = ((optouts as { workflow_id: string }[] | null) || []).map((o) => o.workflow_id)
  if (optoutWfIds.length > 0) {
    const { data: wfs } = await supabase
      .schema('notifications')
      .from('workflows')
      .select('org_id')
      .in('id', optoutWfIds)
    for (const w of (wfs as { org_id: string }[] | null) || []) {
      if (w.org_id) orgIdSet.add(w.org_id)
    }
  }

  const orgIds = Array.from(orgIdSet)
  if (orgIds.length === 0) return []

  // 3. Noms des orgs (clubs BAAS ∪ orgs hub)
  return getOrgsByIds(orgIds)
}
