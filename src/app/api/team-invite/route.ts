/**
 * Accepte une invitation d'équipe : /api/team-invite?token=‹signé hub›.
 * Vérifie le jeton (signé par le hub), exige une session, et ajoute l'utilisateur
 * à l'org avec le rôle indiqué (sans rétrograder un membre existant).
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyInviteToken } from '@/lib/notifications/invite-token'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { addOrgAdmin } from '@/lib/auth/org-team'
import { baseUrl } from '@/lib/oauth/base-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function htmlError(message: string, status = 400) {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Invitation</title>
  <style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1f2937}
  .card{border:1px solid #e5e7eb;border-radius:12px;padding:2rem;background:#fff}h1{font-size:1.25rem}</style></head>
  <body><div class="card"><h1>⛔ Invitation impossible</h1><p>${message}</p></div></body></html>`
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return htmlError("Lien d'invitation incomplet (token manquant).")

  const payload = verifyInviteToken(token)
  if (!payload) return htmlError('Invitation invalide ou expirée. Demandez un nouveau lien au propriétaire.')

  const base = baseUrl(request)
  const user = await getAuthenticatedUser()
  if (!user) {
    const here = `${request.nextUrl.pathname}${request.nextUrl.search}`
    const loginUrl = new URL('/login', base)
    loginUrl.searchParams.set('next', here)
    return NextResponse.redirect(loginUrl)
  }

  try {
    await addOrgAdmin(payload.org_id, user.id, payload.role)
  } catch (e) {
    return htmlError(`Erreur lors de l'ajout à l'équipe : ${e instanceof Error ? e.message : 'inconnue'}`, 500)
  }

  return NextResponse.redirect(new URL(`/admin?org=${payload.org_id}`, base))
}
