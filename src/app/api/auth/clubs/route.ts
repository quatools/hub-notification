import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { getUserClubs } from '@/lib/auth/admin'
import { getMemberOrgs } from '@/lib/auth/member-orgs'

// GET /api/auth/clubs — Retourne les organisations de l'utilisateur connecté.
// Deux sources fusionnées :
//   - clubs où il est ADMIN (get_user_clubs) → peut gérer canaux/workflows
//   - orgs où il est DESTINATAIRE (activité de notif) → peut gérer ses préférences
// Le rôle admin l'emporte si l'utilisateur est les deux pour une même org.
export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const [adminClubs, memberOrgs] = await Promise.all([
    getUserClubs(user.id),
    getMemberOrgs(user.id),
  ])

  const byId = new Map<string, { club_id: string; club_name: string; club_slug: string | null; role: string }>()
  // D'abord les orgs membre, puis les clubs admin (qui écrasent → rôle admin gagne)
  for (const o of memberOrgs) byId.set(o.club_id, o)
  for (const c of adminClubs) byId.set(c.club_id, c)

  return NextResponse.json({ clubs: Array.from(byId.values()) })
}
