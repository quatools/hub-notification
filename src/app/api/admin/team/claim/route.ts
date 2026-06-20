import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { claimOwnership } from '@/lib/auth/org-team'

// POST /api/admin/team/claim { org_id } — devenir propriétaire d'une structure
// qui n'en a pas encore (bootstrap), si on y a déjà accès.
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { org_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }
  if (!body.org_id) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })

  const res = await claimOwnership(user.id, body.org_id)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ success: true })
}
