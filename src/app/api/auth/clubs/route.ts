import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { getUserClubs } from '@/lib/auth/admin'

// GET /api/auth/clubs — Retourne les clubs de l'utilisateur connecté
export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const clubs = await getUserClubs(user.id)

  return NextResponse.json({ clubs })
}
