import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { isOrgOwner } from '@/lib/auth/org-team'
import { mintInviteToken } from '@/lib/notifications/invite-token'
import { baseUrl } from '@/lib/oauth/base-url'

// POST /api/admin/team/invite { org_id, role? } — génère un lien d'invitation
// (réservé au propriétaire). Le lien vaut 7 jours.
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { org_id?: string; role?: 'owner' | 'admin' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }
  if (!body.org_id) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })

  if (!(await isOrgOwner(user.id, body.org_id))) {
    return NextResponse.json({ error: 'Réservé au propriétaire de la structure' }, { status: 403 })
  }

  const role = body.role === 'owner' ? 'owner' : 'admin'
  const token = mintInviteToken({
    org_id: body.org_id,
    role,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  })
  const url = `${baseUrl(request)}/api/team-invite?token=${encodeURIComponent(token)}`
  return NextResponse.json({ invite_url: url, role })
}
