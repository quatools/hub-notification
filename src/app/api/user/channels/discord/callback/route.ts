/**
 * Retour de l'OAuth Discord (canal de livraison). On échange le code, on lit
 * l'ID Discord du compte autorisé, et on crée un canal MP Discord vérifié —
 * SANS lier d'identité de login. Idempotent.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSigningSecret } from '@/lib/signing-secret'
import { baseUrl } from '@/lib/oauth/base-url'
import { createHmac, timingSafeEqual } from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function verifyState(state: string): { uid: string } | null {
  const [body, sig] = (state || '').split('.')
  if (!body || !sig) return null
  let secret: string
  try {
    secret = getSigningSecret()
  } catch {
    return null
  }
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('base64url'))
  const a = Buffer.from(sig)
  if (a.length !== expected.length || !timingSafeEqual(a, expected)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!p.uid || !p.exp || p.exp * 1000 < Date.now()) return null
    return { uid: String(p.uid) }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const base = baseUrl(request)
  const done = new URL('/preferences/channels', base)
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const st = state ? verifyState(state) : null

  if (!code || !st) {
    done.searchParams.set('error_code', 'discord_link_failed')
    return NextResponse.redirect(done)
  }

  const clientId = process.env.DISCORD_OAUTH_CLIENT_ID
  const clientSecret = process.env.DISCORD_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    done.searchParams.set('error_code', 'discord_not_configured')
    return NextResponse.redirect(done)
  }
  const redirectUri = `${base}/api/user/channels/discord/callback`

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })
    const token = await tokenRes.json()
    if (!token.access_token) {
      console.error('[discord channel] token exchange failed', token)
      done.searchParams.set('error_code', 'discord_link_failed')
      return NextResponse.redirect(done)
    }

    const meRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    const me = await meRes.json()
    if (!me?.id) {
      done.searchParams.set('error_code', 'discord_link_failed')
      return NextResponse.redirect(done)
    }
    const username = me.global_name || me.username || 'Discord'

    const sb = createServiceClient()
    const { data: existing } = await sb
      .schema('notifications')
      .from('channels')
      .select('id, config')
      .eq('user_id', st.uid)
      .is('org_id', null)
      .eq('type', 'discord_dm')
    const dup = ((existing as { config: Record<string, unknown> }[] | null) || []).some(
      (c) => c.config?.discord_user_id === me.id
    )
    if (!dup) {
      await sb.schema('notifications').from('channels').insert({
        user_id: st.uid,
        org_id: null,
        type: 'discord_dm',
        label: `Discord · ${username}`,
        config: { discord_user_id: me.id, recipient: 'fixed', username },
        is_verified: true,
      })
    }
  } catch (e) {
    console.error('[discord channel] error', e)
    done.searchParams.set('error_code', 'discord_link_failed')
    return NextResponse.redirect(done)
  }

  done.searchParams.set('discord', 'linked')
  return NextResponse.redirect(done)
}
