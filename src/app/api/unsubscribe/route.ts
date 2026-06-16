/**
 * Désabonnement 1-clic depuis un email (List-Unsubscribe).
 *  - POST : RFC 8058 (List-Unsubscribe-Post=One-Click) — agit sans interaction.
 *  - GET  : ouvre une page de confirmation (clic humain sur le lien).
 * Le jeton signé encode la personne (recipient) + le workflow → opt-out par
 * recipient_id, sans session requise.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubToken } from '@/lib/notifications/unsubscribe-token'
import { createServiceClient } from '@/lib/supabase/server'
import { baseUrl } from '@/lib/oauth/base-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function applyOptout(token: string): Promise<{ ok: boolean; eventLabel?: string }> {
  const payload = verifyUnsubToken(token)
  if (!payload) return { ok: false }

  const sb = createServiceClient().schema('notifications')

  // Idempotent : ne créer que si absent (clé recipient_id + workflow_id)
  const { data: existing } = await sb
    .from('user_optouts')
    .select('id')
    .eq('recipient_id', payload.r)
    .eq('workflow_id', payload.w)
    .maybeSingle()

  if (!existing) {
    const { error } = await sb
      .from('user_optouts')
      .insert({ recipient_id: payload.r, workflow_id: payload.w })
    if (error && (error as { code?: string }).code !== '23505') return { ok: false }
  }

  const { data: wf } = await sb
    .from('workflows')
    .select('events:event_id ( label )')
    .eq('id', payload.w)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventLabel = (wf as any)?.events?.label as string | undefined

  return { ok: true, eventLabel }
}

function htmlPage(base: string, title: string, message: string, status: number) {
  const prefs = `${base}/preferences`
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1rem;color:#1f2937;background:#fff}
    .card{border:1px solid #e5e7eb;border-radius:16px;padding:2rem;text-align:center}
    h1{font-size:1.25rem;margin:.5rem 0}
    p{color:#4b5563;line-height:1.5}
    a.btn{display:inline-block;margin-top:1rem;padding:.6rem 1.1rem;background:#111827;color:#fff;border-radius:10px;text-decoration:none;font-size:.9rem}
    .bell{font-size:2rem}
  </style></head>
  <body><div class="card"><div class="bell">🔕</div><h1>${title}</h1><p>${message}</p>
  <a class="btn" href="${prefs}">Gérer toutes mes notifications</a></div></body></html>`
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

// RFC 8058 — désabonnement en un clic (déclenché par le client mail)
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return new NextResponse('Bad Request', { status: 400 })
  const res = await applyOptout(token)
  return new NextResponse(res.ok ? 'OK' : 'Invalid token', { status: res.ok ? 200 : 400 })
}

export async function GET(request: NextRequest) {
  const base = baseUrl(request)
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return htmlPage(base, 'Lien invalide', 'Ce lien de désabonnement est incomplet.', 400)

  const res = await applyOptout(token)
  if (!res.ok) {
    return htmlPage(base, 'Lien invalide', 'Ce lien de désabonnement est invalide ou a expiré.', 400)
  }
  return htmlPage(
    base,
    'Désabonnement confirmé',
    `Vous ne recevrez plus ${res.eventLabel ? `« ${res.eventLabel} »` : 'cette notification'}. Vous pouvez réactiver ou ajuster tout depuis votre espace.`,
    200
  )
}
