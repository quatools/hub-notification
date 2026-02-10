import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/auth/admin'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/admin/events?org_id=xxx&app=baas-esport&category=billing
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('org_id')
  const auth = await getAdminAuth(orgId)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const app = request.nextUrl.searchParams.get('app')
  const category = request.nextUrl.searchParams.get('category')

  const supabase = createServiceClient()
  let query = supabase
    .schema('notifications')
    .from('events')
    .select('*')
    .eq('is_active', true)
    .is('deprecated_at', null)
    .order('category')
    .order('label')

  if (app) query = query.eq('app', app)
  if (category) query = query.eq('category', category)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Erreur lors du chargement des événements' }, { status: 500 })
  }

  return NextResponse.json({ events: data })
}
