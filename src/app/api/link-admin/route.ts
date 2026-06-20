/**
 * Octroi de droits d'administration sur une org du hub (apps tierces, Storm…).
 *
 * Symétrique du rattachement membre (/api/link), mais pour les ADMINS :
 *  1. L'app forge un link-token `scope:'admin'` + `org_id`, signé avec SA clé API,
 *     et y redirige l'admin qu'elle vouche.
 *  2. Le hub vérifie le token (signature clé d'app + expiration + portée admin).
 *  3. Exige une session hub (OAuth Supabase). Sinon login puis retour ici.
 *  4. Vérifie que l'org existe ET appartient à l'app qui signe (anti cross-app),
 *     puis enregistre l'utilisateur comme admin (idempotent).
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyLinkToken } from '@/lib/notifications/link-token'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { addOrgAdmin, orgHasOwner } from '@/lib/auth/org-team'
import { baseUrl } from '@/lib/oauth/base-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function htmlError(message: string, status = 400) {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Accès admin</title>
  <style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1f2937}
  .card{border:1px solid #e5e7eb;border-radius:12px;padding:2rem;background:#fff}h1{font-size:1.25rem}</style></head>
  <body><div class="card"><h1>⛔ Accès administrateur impossible</h1><p>${message}</p></div></body></html>`
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return htmlError('Lien d\'administration incomplet (token manquant).')

  const payload = await verifyLinkToken(token)
  if (!payload) return htmlError('Lien d\'administration invalide ou expiré. Relancez depuis votre application.')
  if (payload.scope !== 'admin' || !payload.org_id) {
    return htmlError('Lien d\'administration invalide (portée incorrecte).')
  }

  const base = baseUrl(request)

  // Session hub requise. Sinon, login puis retour ici.
  const user = await getAuthenticatedUser()
  if (!user) {
    const here = `${request.nextUrl.pathname}${request.nextUrl.search}`
    const loginUrl = new URL('/login', base)
    loginUrl.searchParams.set('next', here)
    return NextResponse.redirect(loginUrl)
  }

  const supabase = createServiceClient()

  // L'org doit exister ET appartenir à l'app qui signe le token.
  const { data: org } = await supabase
    .schema('notifications')
    .from('organizations')
    .select('id, app')
    .eq('id', payload.org_id)
    .maybeSingle()

  if (!org || org.app !== payload.app) {
    return htmlError('Organisation inconnue pour cette application.', 404)
  }

  // Premier admin de la structure → owner ; les suivants → admin.
  // (addOrgAdmin ne rétrograde jamais un membre existant.)
  try {
    const role = (await orgHasOwner(payload.org_id)) ? 'admin' : 'owner'
    await addOrgAdmin(payload.org_id, user.id, role)
  } catch (e) {
    return htmlError(`Erreur lors de l'attribution des droits : ${e instanceof Error ? e.message : 'inconnue'}`, 500)
  }

  return NextResponse.redirect(new URL(`/admin?org=${payload.org_id}`, base))
}
