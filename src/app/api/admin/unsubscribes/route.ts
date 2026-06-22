import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/auth/admin'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/admin/unsubscribes?org_id=xxx
// Détail des désabonnements de l'org : QUI a coupé QUELLE notif, et pourquoi.
// Data du club (sur ses propres membres) — gated admin de l'org.
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('org_id')
  const auth = await getAdminAuth(orgId)
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const sb = createServiceClient().schema('notifications')

  // Workflows de l'org → libellé d'événement.
  const { data: wfs } = await sb.from('workflows').select('id, events:event_id ( label )').eq('org_id', auth.org_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wfLabel = new Map<string, string>(((wfs as any[]) || []).map((w) => [w.id, w.events?.label || '—']))
  const wfIds = Array.from(wfLabel.keys())
  if (wfIds.length === 0) return NextResponse.json({ optouts: [] })

  const { data: optouts } = await sb
    .from('user_optouts')
    .select('recipient_id, workflow_id, reason, created_at')
    .in('workflow_id', wfIds)
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (optouts as { recipient_id: string | null; workflow_id: string; reason: string | null; created_at: string }[] | null) || []
  const recipientIds = Array.from(new Set(rows.map((r) => r.recipient_id).filter(Boolean))) as string[]

  const nameById = new Map<string, string>()
  const emailById = new Map<string, string>()
  if (recipientIds.length > 0) {
    const { data: recs } = await sb.from('recipients').select('id, display_name').in('id', recipientIds)
    for (const r of (recs as { id: string; display_name: string | null }[] | null) || []) {
      if (r.display_name) nameById.set(r.id, r.display_name)
    }
    const { data: idents } = await sb
      .from('recipient_identities')
      .select('recipient_id, value')
      .eq('kind', 'email')
      .in('recipient_id', recipientIds)
    for (const i of (idents as { recipient_id: string; value: string }[] | null) || []) {
      if (!emailById.has(i.recipient_id)) emailById.set(i.recipient_id, i.value)
    }
  }

  const result = rows.map((r) => ({
    member: (r.recipient_id && nameById.get(r.recipient_id)) || 'Membre',
    email: (r.recipient_id && emailById.get(r.recipient_id)) || null,
    event: wfLabel.get(r.workflow_id) || '—',
    reason: r.reason,
    date: r.created_at,
  }))

  return NextResponse.json({ optouts: result })
}
