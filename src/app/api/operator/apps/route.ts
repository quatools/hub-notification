import { NextRequest, NextResponse } from 'next/server'
import { getOperator } from '@/lib/auth/operator'
import { createServiceClient } from '@/lib/supabase/server'

const STATUSES = ['trial', 'active', 'blocked'] as const

// GET /api/operator/apps — toutes les apps self-service (réservé opérateur).
export async function GET() {
  const op = await getOperator()
  if (!op) return NextResponse.json({ error: "Réservé à l'opérateur" }, { status: 403 })

  const sb = createServiceClient()
  const { data: apps } = await sb
    .schema('notifications')
    .from('apps')
    .select('id, slug, name, owner_user_id, status, send_count, trial_limit, created_at')
    .order('created_at', { ascending: false })

  const rows =
    (apps as Array<{
      id: string
      slug: string
      name: string
      owner_user_id: string
      status: string
      send_count: number
      trial_limit: number
      created_at: string
    }> | null) || []

  const withOwners = await Promise.all(
    rows.map(async (a) => {
      let owner_email: string | null = null
      try {
        const { data } = await sb.auth.admin.getUserById(a.owner_user_id)
        owner_email = data?.user?.email || null
      } catch {
        // ignore : owner non résolu
      }
      return { ...a, owner_email }
    })
  )

  return NextResponse.json({ apps: withOwners })
}

// PATCH /api/operator/apps { app_id, status } — valider / bloquer une app.
export async function PATCH(request: NextRequest) {
  const op = await getOperator()
  if (!op) return NextResponse.json({ error: "Réservé à l'opérateur" }, { status: 403 })

  let body: { app_id?: string; status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }
  if (!body.app_id || !STATUSES.includes((body.status || '') as (typeof STATUSES)[number])) {
    return NextResponse.json({ error: 'app_id et status (trial|active|blocked) requis' }, { status: 400 })
  }

  const sb = createServiceClient()
  const { error } = await sb
    .schema('notifications')
    .from('apps')
    .update({ status: body.status })
    .eq('id', body.app_id)
  if (error) return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })

  return NextResponse.json({ success: true })
}
