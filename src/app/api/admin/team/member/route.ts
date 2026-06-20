import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { isOrgOwner, setMemberRole, removeMember } from '@/lib/auth/org-team'

/** Refuse si l'appelant n'est pas owner de l'org. Renvoie la réponse d'erreur, ou null. */
async function denyIfNotOwner(orgId: string): Promise<NextResponse | null> {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!(await isOrgOwner(user.id, orgId))) {
    return NextResponse.json({ error: 'Réservé au propriétaire de la structure' }, { status: 403 })
  }
  return null
}

// PUT /api/admin/team/member { org_id, user_id, role } — change le rôle d'un membre.
export async function PUT(request: NextRequest) {
  let body: { org_id?: string; user_id?: string; role?: 'owner' | 'admin' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }
  if (!body.org_id || !body.user_id || (body.role !== 'owner' && body.role !== 'admin')) {
    return NextResponse.json({ error: 'org_id, user_id et role requis' }, { status: 400 })
  }
  const deny = await denyIfNotOwner(body.org_id)
  if (deny) return deny
  const res = await setMemberRole(body.org_id, body.user_id, body.role)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ success: true })
}

// DELETE /api/admin/team/member { org_id, user_id } — retire un membre.
export async function DELETE(request: NextRequest) {
  let body: { org_id?: string; user_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }
  if (!body.org_id || !body.user_id) {
    return NextResponse.json({ error: 'org_id et user_id requis' }, { status: 400 })
  }
  const deny = await denyIfNotOwner(body.org_id)
  if (deny) return deny
  const res = await removeMember(body.org_id, body.user_id)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ success: true })
}
