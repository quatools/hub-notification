import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const supabase = await createClient()
  const app = request.nextUrl.searchParams.get('app')
  const category = request.nextUrl.searchParams.get('category')

  let query = supabase
    .schema('notifications')
    .from('events')
    .select('*')
    .eq('is_active', true)
    .is('deprecated_at', null)
    .order('category')
    .order('label')

  if (app) {
    query = query.eq('app', app)
  }
  if (category) {
    query = query.eq('category', category)
  }

  const { data: events, error } = await query

  if (error) {
    console.error('Erreur GET events:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }

  return NextResponse.json({ events: events ?? [] })
}
