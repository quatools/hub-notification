import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { getOwnedApp, deleteApp } from '@/lib/notifications/apps'

// GET : détail d'une app (propriétaire) — inclut le signing_secret (à lui).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params
  const app = await getOwnedApp(user.id, id)
  if (!app) return NextResponse.json({ error: 'Application introuvable' }, { status: 404 })
  return NextResponse.json({ app })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params
  const ok = await deleteApp(user.id, id)
  if (!ok) return NextResponse.json({ error: 'Application introuvable' }, { status: 404 })
  return NextResponse.json({ success: true })
}
