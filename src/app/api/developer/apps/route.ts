/**
 * Espace Développeur (self-service) : gérer SES applications.
 * Auth = session ; toute personne connectée peut créer son app.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { listApps, createApp } from '@/lib/notifications/apps'

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  return NextResponse.json({ apps: await listApps(user.id) })
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { name?: string; slug?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const res = await createApp(user.id, body.name || '', body.slug || '')
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ app: res.app }, { status: 201 })
}
