import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { getOwnedApp, listKeys, generateKey } from '@/lib/notifications/apps'

// GET : liste des clés (préfixes uniquement, jamais le secret).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params
  const app = await getOwnedApp(user.id, id)
  if (!app) return NextResponse.json({ error: 'Application introuvable' }, { status: 404 })
  return NextResponse.json({ keys: await listKeys(id) })
}

// POST : génère une clé — renvoie le secret EN CLAIR une seule fois.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params
  let body: { label?: string } = {}
  try {
    body = await request.json()
  } catch {
    // label optionnel
  }
  const res = await generateKey(user.id, id, body.label)
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ secret: res.secret }, { status: 201 })
}
