import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/user/channels
export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .schema('notifications')
    .from('channels')
    .select('*')
    .eq('user_id', user.id)
    .is('org_id', null)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Erreur lors du chargement' }, { status: 500 })
  }

  return NextResponse.json({ channels: data })
}

// POST /api/user/channels
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  let body: { type: string; label?: string; config: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  if (!body.type || !body.config) {
    return NextResponse.json({ error: 'type et config requis' }, { status: 400 })
  }

  // Canaux perso : seulement email pour l'instant
  if (body.type !== 'email') {
    return NextResponse.json({ error: 'Seul le type "email" est disponible pour les canaux personnels' }, { status: 400 })
  }

  const email = body.config.email as string
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .schema('notifications')
    .from('channels')
    .insert({
      user_id: user.id,
      org_id: null,
      type: body.type,
      label: body.label || null,
      config: body.config,
      is_verified: true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })
  }

  return NextResponse.json({ channel: data }, { status: 201 })
}
