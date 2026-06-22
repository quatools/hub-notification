import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/auth/admin'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/admin/settings?org_id=xxx
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('org_id')
  const auth = await getAdminAuth(orgId)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .schema('notifications')
    .from('org_settings')
    .select('sender_name, reply_to, sender_domain, domain_status, brand_color')
    .eq('org_id', auth.org_id)
    .single()

  return NextResponse.json({
    settings: data || {
      sender_name: null,
      reply_to: null,
      sender_domain: null,
      domain_status: 'unconfigured',
      brand_color: null,
    },
  })
}

// PUT /api/admin/settings
export async function PUT(request: NextRequest) {
  let body: { org_id?: string; sender_name?: string | null; reply_to?: string | null; brand_color?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const auth = await getAdminAuth(body.org_id || null)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const senderName = body.sender_name?.trim() || null
  const replyTo = body.reply_to?.trim() || null

  if (senderName && senderName.length > 80) {
    return NextResponse.json({ error: "Nom d'expéditeur trop long (80 caractères max)" }, { status: 400 })
  }
  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
    return NextResponse.json({ error: 'Adresse de réponse invalide' }, { status: 400 })
  }

  const payload: Record<string, unknown> = { org_id: auth.org_id, sender_name: senderName, reply_to: replyTo }
  if (body.brand_color !== undefined) {
    const bc = body.brand_color?.trim() || null
    if (bc && !/^#[0-9a-fA-F]{6}$/.test(bc)) {
      return NextResponse.json({ error: 'Couleur invalide (format #RRGGBB attendu)' }, { status: 400 })
    }
    payload.brand_color = bc
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .schema('notifications')
    .from('org_settings')
    .upsert(payload, { onConflict: 'org_id' })
    .select('sender_name, reply_to, sender_domain, domain_status, brand_color')
    .single()

  if (error) {
    console.error('Erreur sauvegarde settings:', error)
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}
