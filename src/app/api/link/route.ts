/**
 * Rattachement d'une identité d'app au compte hub (CDC v2).
 *
 * Flux : l'app (BAAS…) redirige le membre vers /api/link?token=‹signé›.
 *  1. Vérifie le token (signature clé de l'app + expiration) → preuve que l'app
 *     authentifiée vouche ce membre.
 *  2. Exige une session hub (OAuth Supabase) → confirme QUI réclame. Sinon login.
 *  3. claimAppIdentity : rattache l'identité + fusionne la fiche flottante.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyLinkToken } from '@/lib/notifications/link-token'
import { claimAppIdentity } from '@/lib/notifications/recipients'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { baseUrl } from '@/lib/oauth/base-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function htmlError(message: string, status = 400) {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Rattachement</title>
  <style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1f2937}
  .card{border:1px solid #e5e7eb;border-radius:12px;padding:2rem;background:#fff}h1{font-size:1.25rem}</style></head>
  <body><div class="card"><h1>⛔ Rattachement impossible</h1><p>${message}</p></div></body></html>`
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return htmlError('Lien de rattachement incomplet (token manquant).')

  const payload = verifyLinkToken(token)
  if (!payload) return htmlError('Lien de rattachement invalide ou expiré. Relancez depuis votre application.')

  const base = baseUrl(request)

  // Session hub requise (OAuth Supabase). Sinon, login puis retour ici.
  const user = await getAuthenticatedUser()
  if (!user) {
    const here = `${request.nextUrl.pathname}${request.nextUrl.search}`
    const loginUrl = new URL('/login', base)
    loginUrl.searchParams.set('next', here)
    return NextResponse.redirect(loginUrl)
  }

  try {
    await claimAppIdentity(user.id, payload.name || null, {
      app: payload.app,
      appUserId: payload.app_user_id,
      email: payload.email,
      discordId: payload.discord_id,
    })
  } catch (e) {
    return htmlError(`Erreur lors du rattachement : ${e instanceof Error ? e.message : 'inconnue'}`, 500)
  }

  // Rattaché → espace préférences
  return NextResponse.redirect(new URL('/preferences?linked=1', base))
}
