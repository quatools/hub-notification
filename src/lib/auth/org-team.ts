/**
 * Droits de notification du hub : rôles (owner/admin) et gestion d'équipe d'une
 * structure. Le hub possède CES droits (≠ club_admins du BAAS, qui reste sa
 * source pour ses propres features). Source : notifications.org_admins.
 */
import { createServiceClient } from '@/lib/supabase/server'
import { isOrgAdmin } from '@/lib/auth/orgs'

export type OrgRole = 'owner' | 'admin'

export interface TeamMember {
  user_id: string
  role: OrgRole
  email: string | null
  name: string | null
  avatar: string | null
  created_at: string
}

/** Rôle réel en base (ligne org_admins), ou null si l'utilisateur n'en a pas. */
export async function getDbRole(userId: string, orgId: string): Promise<OrgRole | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .schema('notifications')
    .from('org_admins')
    .select('role')
    .eq('org_id', orgId)
    .eq('auth_user_id', userId)
    .maybeSingle()
  return (data?.role as OrgRole | undefined) || null
}

/** Rôle effectif : org_admins si présent ; sinon 'admin' si accès par le filet
 *  club_admins (transition) ; sinon null. */
export async function getOrgRole(userId: string, orgId: string): Promise<OrgRole | null> {
  const role = await getDbRole(userId, orgId)
  if (role) return role
  if (await isOrgAdmin(userId, orgId)) return 'admin'
  return null
}

export async function isOrgOwner(userId: string, orgId: string): Promise<boolean> {
  return (await getDbRole(userId, orgId)) === 'owner'
}

export async function orgHasOwner(orgId: string): Promise<boolean> {
  const sb = createServiceClient()
  const { count } = await sb
    .schema('notifications')
    .from('org_admins')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('role', 'owner')
  return (count || 0) > 0
}

async function resolveUser(userId: string): Promise<{ email: string | null; name: string | null; avatar: string | null }> {
  const sb = createServiceClient()
  const { data } = await sb.auth.admin.getUserById(userId)
  const u = data?.user
  const m = (u?.user_metadata || {}) as Record<string, string>
  return {
    email: u?.email || null,
    name: m.full_name || m.name || null,
    avatar: m.avatar_url || m.picture || null,
  }
}

export async function listOrgTeam(orgId: string): Promise<TeamMember[]> {
  const sb = createServiceClient()
  const { data } = await sb
    .schema('notifications')
    .from('org_admins')
    .select('auth_user_id, role, created_at')
    .eq('org_id', orgId)
    .order('created_at')
  const rows = (data as { auth_user_id: string; role: OrgRole; created_at: string }[] | null) || []
  return Promise.all(
    rows.map(async (r) => ({
      user_id: r.auth_user_id,
      role: r.role,
      created_at: r.created_at,
      ...(await resolveUser(r.auth_user_id)),
    }))
  )
}

/** Ajoute un membre — sans rétrograder un rôle existant (upsert prudent). */
export async function addOrgAdmin(orgId: string, userId: string, role: OrgRole): Promise<void> {
  const existing = await getDbRole(userId, orgId)
  if (existing) return // déjà membre : on ne touche pas à son rôle
  const sb = createServiceClient()
  await sb
    .schema('notifications')
    .from('org_admins')
    .upsert({ org_id: orgId, auth_user_id: userId, role }, { onConflict: 'org_id,auth_user_id' })
}

/** Réclame la propriété si la structure n'a pas d'owner et que l'utilisateur y a accès. */
export async function claimOwnership(userId: string, orgId: string): Promise<{ ok: boolean; error?: string }> {
  if (await orgHasOwner(orgId)) return { ok: false, error: 'Cette structure a déjà un propriétaire.' }
  if (!(await isOrgAdmin(userId, orgId))) return { ok: false, error: 'Accès refusé.' }
  const sb = createServiceClient()
  await sb
    .schema('notifications')
    .from('org_admins')
    .upsert({ org_id: orgId, auth_user_id: userId, role: 'owner' }, { onConflict: 'org_id,auth_user_id' })
  return { ok: true }
}

export async function setMemberRole(
  orgId: string,
  targetUserId: string,
  role: OrgRole
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient()
  if (role === 'admin') {
    // Ne pas rétrograder le dernier owner.
    const { data } = await sb
      .schema('notifications')
      .from('org_admins')
      .select('auth_user_id')
      .eq('org_id', orgId)
      .eq('role', 'owner')
    const owners = (data as { auth_user_id: string }[] | null) || []
    if (owners.length <= 1 && owners.some((o) => o.auth_user_id === targetUserId)) {
      return { ok: false, error: "Impossible de rétrograder le dernier propriétaire — nommez d'abord un autre propriétaire." }
    }
  }
  const { error } = await sb
    .schema('notifications')
    .from('org_admins')
    .update({ role })
    .eq('org_id', orgId)
    .eq('auth_user_id', targetUserId)
  if (error) return { ok: false, error: 'Erreur lors du changement de rôle.' }
  return { ok: true }
}

export async function removeMember(orgId: string, targetUserId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient()
  const { data } = await sb
    .schema('notifications')
    .from('org_admins')
    .select('auth_user_id, role')
    .eq('org_id', orgId)
  const rows = (data as { auth_user_id: string; role: OrgRole }[] | null) || []
  const target = rows.find((r) => r.auth_user_id === targetUserId)
  if (!target) return { ok: false, error: 'Membre introuvable.' }
  if (target.role === 'owner' && rows.filter((r) => r.role === 'owner').length <= 1) {
    return { ok: false, error: 'Impossible de retirer le dernier propriétaire.' }
  }
  await sb.schema('notifications').from('org_admins').delete().eq('org_id', orgId).eq('auth_user_id', targetUserId)
  return { ok: true }
}
