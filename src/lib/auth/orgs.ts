import { createServiceClient } from '@/lib/supabase/server'

/**
 * Résolution des organisations et des droits admin en UNION de deux sources :
 *   - le BAAS (public.clubs / public.club_admins) — couplage historique ;
 *   - le hub lui-même (notifications.organizations / org_admins) — apps tierces
 *     (Storm…) dont les organisations ne sont pas des clubs esport.
 *
 * Les espaces d'identifiants ne se chevauchent pas (UUID distincts), donc une
 * union par recherche dans les deux sources est sûre. Aucune donnée n'est
 * migrée : le BAAS continue de fonctionner sans changement.
 */

export interface OrgRef {
  club_id: string
  club_name: string
  club_slug: string | null
  role: string
}

/** L'utilisateur est-il admin de cette org ? (club_admins BAAS OU org_admins hub) */
export async function isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { data: club } = await supabase
    .from('club_admins')
    .select('id')
    .eq('user_id', userId)
    .eq('club_id', orgId)
    .eq('is_active', true)
    .maybeSingle()
  if (club) return true

  const { data: hub } = await supabase
    .schema('notifications')
    .from('org_admins')
    .select('id')
    .eq('auth_user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()
  return !!hub
}

/** Orgs dont l'utilisateur est admin : clubs BAAS ∪ orgs hub. */
export async function listAdminOrgs(userId: string): Promise<OrgRef[]> {
  const supabase = createServiceClient()
  const byId = new Map<string, OrgRef>()

  // BAAS
  const { data: clubs } = await supabase.rpc('get_user_clubs', { user_uuid: userId })
  for (const c of (clubs as OrgRef[] | null) || []) byId.set(c.club_id, c)

  // Hub
  const { data: links } = await supabase
    .schema('notifications')
    .from('org_admins')
    .select('org_id, role')
    .eq('auth_user_id', userId)
  const linkRows = (links as { org_id: string; role: string }[] | null) || []
  if (linkRows.length > 0) {
    const roleByOrg = new Map(linkRows.map((l) => [l.org_id, l.role]))
    const { data: orgs } = await supabase
      .schema('notifications')
      .from('organizations')
      .select('id, name, slug')
      .in('id', linkRows.map((l) => l.org_id))
    for (const o of (orgs as { id: string; name: string; slug: string | null }[] | null) || []) {
      if (!byId.has(o.id)) {
        byId.set(o.id, { club_id: o.id, club_name: o.name, club_slug: o.slug, role: roleByOrg.get(o.id) || 'admin' })
      }
    }
  }

  return Array.from(byId.values())
}

/** Noms d'organisations par ids : clubs BAAS ∪ orgs hub (rôle 'member'). */
export async function getOrgsByIds(ids: string[]): Promise<OrgRef[]> {
  if (ids.length === 0) return []
  const supabase = createServiceClient()
  const out = new Map<string, OrgRef>()

  const { data: clubs } = await supabase.from('clubs').select('id, name, slug').in('id', ids)
  for (const c of (clubs as { id: string; name: string; slug: string | null }[] | null) || []) {
    out.set(c.id, { club_id: c.id, club_name: c.name, club_slug: c.slug, role: 'member' })
  }

  const missing = ids.filter((id) => !out.has(id))
  if (missing.length > 0) {
    const { data: orgs } = await supabase
      .schema('notifications')
      .from('organizations')
      .select('id, name, slug')
      .in('id', missing)
    for (const o of (orgs as { id: string; name: string; slug: string | null }[] | null) || []) {
      out.set(o.id, { club_id: o.id, club_name: o.name, club_slug: o.slug, role: 'member' })
    }
  }

  return Array.from(out.values())
}
