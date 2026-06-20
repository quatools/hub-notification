import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { getOrgRole, listOrgTeam, orgHasOwner } from '@/lib/auth/org-team'

// GET /api/admin/team?org_id=xxx — équipe d'une structure (admin de l'org requis).
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const orgId = request.nextUrl.searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })

  const myRole = await getOrgRole(user.id, orgId)
  if (!myRole) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const [team, hasOwner] = await Promise.all([listOrgTeam(orgId), orgHasOwner(orgId)])
  return NextResponse.json({ team, my_role: myRole, my_user_id: user.id, has_owner: hasOwner })
}
