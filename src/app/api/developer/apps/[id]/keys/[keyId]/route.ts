import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { getOwnedApp, revokeKey } from '@/lib/notifications/apps'

// DELETE : révoque une clé (propriétaire de l'app uniquement).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id, keyId } = await params
  const app = await getOwnedApp(user.id, id)
  if (!app) return NextResponse.json({ error: 'Application introuvable' }, { status: 404 })
  await revokeKey(id, keyId)
  return NextResponse.json({ success: true })
}
