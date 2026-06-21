import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/auth/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveOrgApp } from '@/lib/auth/orgs'

// Couleur de pastille par catégorie d'événement (charte Quatools)
const CAT_COLOR: Record<string, string> = {
  billing: '#2F7D5B',
  member: '#C05B2E',
  team: '#24405E',
  shop: '#8F3E1F',
  system: '#9197A1',
}

function chanWord(type?: string | null) {
  if (type === 'email') return 'Email'
  if (type === 'discord_webhook' || type === 'discord_dm') return 'Discord'
  return 'Notification'
}

function relTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `${diffMin} min`
  const h = Math.round(diffMin / 60)
  if (h < 24) return `${h} h`
  return `${Math.round(h / 24)} j`
}

// GET /api/admin/dashboard?org_id=xxx — données du tableau de bord (santé)
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('org_id')
  const auth = await getAdminAuth(orgId)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const orgApp = await resolveOrgApp(auth.org_id)
  const sb = createServiceClient().schema('notifications')

  // Workflows de l'org + events du catalogue (cloisonnés par l'app de l'org)
  const [{ data: wfs }, { data: events }] = await Promise.all([
    sb.from('workflows').select('id, event_id, is_active').eq('org_id', orgId),
    sb.from('events').select('id, slug, label, category').eq('app', orgApp).eq('is_active', true).is('deprecated_at', null),
  ])

  const activeWfs = (wfs || []).filter((w) => w.is_active)
  const activeEventIds = new Set(activeWfs.map((w) => w.event_id))
  const eventList = events || []
  const labelBySlug = new Map(eventList.map((e) => [e.slug, e.label]))

  // À configurer = events sans workflow actif (max 5)
  const toConfigure = eventList
    .filter((e) => !activeEventIds.has(e.id))
    .slice(0, 5)
    .map((e) => ({ label: e.label, color: CAT_COLOR[e.category as string] || '#9197A1' }))

  // Exécutions des 7 derniers jours
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const { data: execs } = await sb
    .from('workflow_executions')
    .select('id, event_slug, status, created_at, sent_at, destination, error_message, channels:channel_id ( type, label )')
    .eq('org_id', orgId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (execs as any[]) || []
  const sent7d = rows.filter((r) => r.status === 'sent').length
  const failed7d = rows.filter((r) => r.status === 'failed').length
  const total = sent7d + failed7d
  const successRate = total > 0 ? (sent7d / total) * 100 : null

  const activity = rows.slice(0, 6).map((r) => {
    const label = labelBySlug.get(r.event_slug) || r.event_slug
    const type = r.channels?.type as string | undefined
    const ok = r.status === 'sent'
    let text: string
    if (!ok) {
      const err = r.error_message ? ` — ${String(r.error_message).slice(0, 48)}` : ''
      text = `Échec ${chanWord(type)} « ${label} »${err}`
    } else if (type === 'email') {
      text = `Email « ${label} » envoyé${r.destination ? ` à ${r.destination}` : ''}`
    } else if (type === 'discord_webhook') {
      text = `Discord « ${label} » → ${r.channels?.label || 'salon'}`
    } else if (type === 'discord_dm') {
      text = `Discord « ${label} » en message privé`
    } else {
      text = `« ${label} » envoyé`
    }
    return { text, color: ok ? '#2F7D5B' : '#B5402F', time: relTime(r.sent_at || r.created_at) }
  })

  return NextResponse.json({
    active_workflows: activeWfs.length,
    sent_7d: sent7d,
    success_rate: successRate,
    to_configure: toConfigure,
    activity,
  })
}
