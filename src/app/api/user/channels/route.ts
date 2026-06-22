import { NextResponse } from 'next/server'
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

// POST /api/user/channels — DÉSACTIVÉ.
// On n'ajoute plus de canal par saisie libre (une adresse non vérifiée = trou de
// sécurité + risque de réputation). Les canaux se connectent via une identité
// PROUVÉE (Discord/Google/GitHub) → /api/user/channels/sync après linkIdentity.
export async function POST() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  return NextResponse.json(
    {
      error:
        'Connectez un compte (Discord, Google, GitHub) pour ajouter un canal — la possession est ainsi vérifiée.',
    },
    { status: 400 }
  )
}
