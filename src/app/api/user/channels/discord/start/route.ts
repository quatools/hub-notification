/**
 * Démarre la connexion d'un canal de LIVRAISON Discord (≠ login).
 * OAuth Discord dédié (scope identify) : on récupère juste l'ID Discord du compte
 * autorisé pour prouver la possession, sans en faire une identité de login.
 * Gère donc n'importe quel compte (y compris un alt déjà utilisé ailleurs).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { getSigningSecret } from '@/lib/signing-secret'
import { baseUrl } from '@/lib/oauth/base-url'
import { createHmac } from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const base = baseUrl(request)
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.redirect(new URL('/login', base))

  const clientId = process.env.NEXT_PUBLIC_DISCORD_APP_ID
  if (!clientId) {
    const done = new URL('/preferences/channels', base)
    done.searchParams.set('error_code', 'discord_not_configured')
    return NextResponse.redirect(done)
  }

  // State signé : porte l'utilisateur + une expiration courte (anti-CSRF/rejeu).
  const payload = { uid: user.id, exp: Math.floor(Date.now() / 1000) + 600 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', getSigningSecret()).update(body).digest('base64url')
  const state = `${body}.${sig}`

  const authorize = new URL('https://discord.com/api/oauth2/authorize')
  authorize.searchParams.set('client_id', clientId)
  authorize.searchParams.set('redirect_uri', `${base}/api/user/channels/discord/callback`)
  authorize.searchParams.set('response_type', 'code')
  authorize.searchParams.set('scope', 'identify')
  authorize.searchParams.set('state', state)
  authorize.searchParams.set('prompt', 'consent')

  return NextResponse.redirect(authorize.toString())
}
