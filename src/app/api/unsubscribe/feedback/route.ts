/**
 * Feedback de désabonnement (raison) — posté depuis la page de confirmation.
 * Complète l'opt-out déjà créé. Raison contrainte à une liste blanche (pas de
 * texte libre). Sans session : authentifié par le même jeton signé que le désabo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubToken } from '@/lib/notifications/unsubscribe-token'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const REASONS = new Set(['trop_souvent', 'pas_pertinent', 'mauvais_moment', 'autre_canal', 'autre'])

export async function POST(request: NextRequest) {
  let body: { token?: string; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }
  if (!body.token || !body.reason || !REASONS.has(body.reason)) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const payload = verifyUnsubToken(body.token)
  if (!payload) return NextResponse.json({ error: 'Jeton invalide' }, { status: 400 })

  const sb = createServiceClient().schema('notifications')
  await sb
    .from('user_optouts')
    .update({ reason: body.reason, reason_at: new Date().toISOString() })
    .eq('recipient_id', payload.r)
    .eq('workflow_id', payload.w)

  return NextResponse.json({ ok: true })
}
