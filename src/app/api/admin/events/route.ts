import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/auth/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveOrgApp } from '@/lib/auth/orgs'

// GET /api/admin/events?org_id=xxx&category=billing
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('org_id')
  const auth = await getAdminAuth(orgId)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const category = request.nextUrl.searchParams.get('category')
  // Cloisonnement : seuls les événements de l'app propriétaire de l'org.
  const orgApp = await resolveOrgApp(auth.org_id)

  const supabase = createServiceClient()
  let query = supabase
    .schema('notifications')
    .from('events')
    .select('*')
    .eq('app', orgApp)
    .eq('is_active', true)
    .is('deprecated_at', null)
    .order('category')
    .order('label')

  if (category) query = query.eq('category', category)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Erreur lors du chargement des événements' }, { status: 500 })
  }

  return NextResponse.json({ events: data })
}
