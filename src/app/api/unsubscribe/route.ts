/**
 * Désabonnement 1-clic depuis un email (List-Unsubscribe).
 *  - POST : RFC 8058 (List-Unsubscribe-Post=One-Click) — agit sans interaction,
 *    aucune page (le client mail appelle l'URL en arrière-plan).
 *  - GET  : applique l'opt-out PUIS affiche une page de confirmation EN MARQUE
 *    BLANCHE (voix du club) : confirmation + reroutage + feedback 1-tap optionnel.
 * Le jeton signé encode la personne (recipient) + le workflow → opt-out par
 * recipient_id, sans session requise. Le feedback (raison) est posté ensuite
 * vers /api/unsubscribe/feedback (data du club).
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubToken } from '@/lib/notifications/unsubscribe-token'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgsByIds } from '@/lib/auth/orgs'
import { baseUrl } from '@/lib/oauth/base-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HEX = /^#[0-9a-fA-F]{6}$/

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

interface OptoutInfo {
  ok: boolean
  eventLabel?: string
  orgName?: string
  brandColor?: string
}

async function applyOptout(token: string): Promise<OptoutInfo> {
  const payload = verifyUnsubToken(token)
  if (!payload) return { ok: false }

  const sb = createServiceClient().schema('notifications')

  // Idempotent (clé recipient_id + workflow_id) — ne pas écraser une raison déjà donnée.
  const { data: existing } = await sb
    .from('user_optouts')
    .select('id')
    .eq('recipient_id', payload.r)
    .eq('workflow_id', payload.w)
    .maybeSingle()
  if (!existing) {
    const { error } = await sb.from('user_optouts').insert({ recipient_id: payload.r, workflow_id: payload.w })
    if (error && (error as { code?: string }).code !== '23505') return { ok: false }
  }

  // Workflow → libellé de l'événement + org concernée.
  const { data: wf } = await sb
    .from('workflows')
    .select('org_id, events:event_id ( label )')
    .eq('id', payload.w)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventLabel = (wf as any)?.events?.label as string | undefined
  const orgId = (wf as { org_id?: string } | null)?.org_id

  let orgName: string | undefined
  let brandColor: string | undefined
  if (orgId) {
    const { data: settings } = await sb
      .from('org_settings')
      .select('sender_name, brand_color')
      .eq('org_id', orgId)
      .maybeSingle()
    brandColor = (settings?.brand_color as string | undefined) || undefined
    orgName = (settings?.sender_name as string | undefined) || undefined
    if (!orgName) {
      const refs = await getOrgsByIds([orgId])
      orgName = refs[0]?.club_name
    }
  }

  return { ok: true, eventLabel, orgName, brandColor }
}

function errorPage(base: string, message: string, status: number) {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Désabonnement</title>
  <style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1f2937;background:#F7F3EA}
  .card{border:1px solid #E2DBCB;border-radius:16px;padding:2rem;background:#fff;text-align:center}h1{font-size:1.2rem}
  a{color:#24405E}</style></head>
  <body><div class="card"><div style="font-size:2rem">🔕</div><h1>${esc(message)}</h1>
  <p><a href="${base}/preferences">Gérer mes notifications</a></p></div></body></html>`
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

function confirmPage(base: string, token: string, info: OptoutInfo): NextResponse {
  const brand = info.brandColor && HEX.test(info.brandColor) ? info.brandColor : '#24405E'
  const org = esc(info.orgName || 'votre club')
  const initial = esc((info.orgName || 'N').trim().charAt(0).toUpperCase())
  const notif = esc(info.eventLabel || 'cette notification')
  const prefs = `${base}/preferences`

  const html = `<!DOCTYPE html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Désabonnement — ${org}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,560&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  :root{
    --brand:${brand};
    --brand-soft:color-mix(in srgb, var(--brand) 7.5%, transparent);
    --brand-tint:color-mix(in srgb, var(--brand) 16%, transparent);
    --brand-deep:color-mix(in srgb, var(--brand) 82%, #000);
    --cream:#F7F3EA;--card:#FFFEFB;--line:#E2DBCB;--ink:#1E2430;--navy:#24405E;--muted:#8C8576;--faint:#A9A293;--green:#2F7D5B;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:var(--cream);-webkit-font-smoothing:antialiased;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px 18px;position:relative;overflow-x:hidden}
  body::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(120% 60% at 50% -10%, var(--brand-soft), transparent 60%)}
  .card{position:relative;z-index:1;width:100%;max-width:480px;background:var(--card);border:1px solid var(--line);border-radius:24px;box-shadow:0 18px 50px -24px rgba(36,40,52,.28),0 4px 12px -6px rgba(36,40,52,.10);padding:30px 30px 22px}
  @media(max-width:430px){.card{padding:26px 20px 20px}}
  .r{opacity:0;transform:translateY(10px);animation:rise .6s cubic-bezier(.2,.7,.2,1) forwards}
  .r1{animation-delay:.05s}.r2{animation-delay:.16s}.r3{animation-delay:.30s}.r4{animation-delay:.44s}.r5{animation-delay:.56s}.r6{animation-delay:.66s}
  @keyframes rise{to{opacity:1;transform:none}}
  @media(prefers-reduced-motion:reduce){.r{animation:none;opacity:1;transform:none}}
  .brand{display:flex;align-items:center;gap:11px;padding-bottom:18px;border-bottom:1px solid var(--line)}
  .logo{width:38px;height:38px;border-radius:50%;flex:0 0 auto;background:linear-gradient(150deg,var(--brand),var(--brand-deep));color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-weight:560;font-size:18px}
  .brand-name{font-weight:600;font-size:15px;letter-spacing:-.01em}
  .brand-kicker{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);margin-top:1px}
  .confirm{text-align:center;padding:26px 4px 22px}
  .bell{width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:var(--brand-soft);display:flex;align-items:center;justify-content:center}
  .bell svg{width:26px;height:26px;stroke:var(--brand);fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
  .confirm h1{font-family:'Fraunces',serif;font-weight:500;font-size:30px;line-height:1.05;letter-spacing:-.01em;color:var(--navy)}
  .confirm p{margin-top:9px;font-size:15px;color:var(--muted);line-height:1.5}
  .notif{color:var(--ink);font-weight:600}
  .reroute{margin-top:4px;background:var(--brand-soft);border:1px solid var(--brand-tint);border-radius:16px;padding:18px}
  .reroute .lead{font-size:14.5px;font-weight:600;color:var(--navy);letter-spacing:-.01em}
  .reroute .sub{font-size:12.5px;color:var(--muted);margin-top:3px;line-height:1.45}
  .reroute-actions{display:flex;gap:9px;margin-top:14px}
  @media(max-width:430px){.reroute-actions{flex-direction:column}}
  .btn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer;border-radius:11px;padding:11px 12px;text-decoration:none;transition:transform .15s,box-shadow .2s,filter .2s}
  .btn svg{width:16px;height:16px;flex:0 0 auto}
  .btn-primary{background:var(--brand);color:#fff;border:1px solid var(--brand)}
  .btn-primary:hover{filter:brightness(.92);transform:translateY(-1px)}
  .btn-ghost{background:#fff;color:var(--navy);border:1px solid var(--line)}
  .btn-ghost:hover{transform:translateY(-1px);border-color:var(--brand-tint)}
  .fb{margin-top:24px;text-align:center}
  .fb-label{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
  .chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:13px}
  .chip{font-family:inherit;font-size:12.5px;font-weight:500;color:var(--navy);cursor:pointer;background:#fff;border:1px solid var(--line);border-radius:999px;padding:7px 13px;transition:transform .14s,background .18s,color .18s,border-color .18s}
  .chip:hover{transform:translateY(-1px);border-color:var(--brand-tint)}
  .chip.selected{background:var(--brand);border-color:var(--brand);color:#fff}
  .chip.dim{opacity:.4;pointer-events:none}
  .fb-thanks{display:none;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:600;color:var(--green)}
  .fb-thanks svg{width:18px;height:18px;stroke:var(--green);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .fb.done .chips,.fb.done .fb-label{display:none}
  .fb.done .fb-thanks{display:flex;animation:rise .4s both}
  .manage{display:block;text-align:center;margin-top:24px;font-size:13.5px;font-weight:600;color:var(--navy);text-decoration:none;transition:color .15s}
  .manage:hover{color:var(--brand)}
  .manage .arrow{display:inline-block;transition:transform .18s}.manage:hover .arrow{transform:translateX(3px)}
  .foot{margin-top:20px;padding-top:14px;border-top:1px solid var(--line);text-align:center}
  .foot span{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#C3BCAD}
</style></head>
<body>
  <main class="card">
    <header class="brand r r1">
      <div class="logo">${initial}</div>
      <div><div class="brand-name">${org}</div><div class="brand-kicker">Vos notifications</div></div>
    </header>
    <section class="confirm r r2">
      <div class="bell" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8.7 3.6A6 6 0 0 1 18 8c0 2.2.5 3.9 1.3 5.1M17.7 17.7A2 2 0 0 1 16 18H5l1.4-1.7A8 8 0 0 0 8 11"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/><path d="M3 3l18 18"/></svg></div>
      <h1>C'est noté.</h1>
      <p>Tu ne recevras plus la notification<br><span class="notif">« ${notif} »</span> de ${org}.</p>
    </section>
    <section class="reroute r r3">
      <div class="lead">Tu voulais juste changer de canal&nbsp;?</div>
      <div class="sub">Garde l'info, autrement. Choisis où recevoir « ${notif} » — sans rien rater.</div>
      <div class="reroute-actions">
        <a class="btn btn-primary" href="${prefs}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.3 5.3A16 16 0 0 0 15.5 4l-.2.4a14.7 14.7 0 0 1 3.4 1.1 14 14 0 0 0-11.6 0A14.7 14.7 0 0 1 10.7 4l-.2-.4A16 16 0 0 0 6.7 5.3 16.5 16.5 0 0 0 4 16.5a16 16 0 0 0 4.9 2.5l.4-.6a10.5 10.5 0 0 1-1.6-.8l.4-.3a11.4 11.4 0 0 0 9.8 0l.4.3a10.5 10.5 0 0 1-1.6.8l.4.6A16 16 0 0 0 22 16.5a16.5 16.5 0 0 0-2.7-11.2ZM9.7 14.3c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.5.7 1.4 1.6c0 .9-.6 1.6-1.4 1.6Zm4.6 0c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.5.7 1.4 1.6c0 .9-.6 1.6-1.4 1.6Z"/></svg>Sur Discord</a>
        <a class="btn btn-ghost" href="${prefs}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6 8.5-6"/></svg>Autre adresse</a>
      </div>
    </section>
    <section class="fb r r4" id="fb">
      <div class="fb-label">Ça aiderait ${org} de savoir pourquoi · optionnel</div>
      <div class="chips" id="chips">
        <button class="chip" data-r="trop_souvent">Trop souvent</button>
        <button class="chip" data-r="pas_pertinent">Pas pertinent</button>
        <button class="chip" data-r="mauvais_moment">Mauvais moment</button>
        <button class="chip" data-r="autre_canal">Je préfère un autre canal</button>
        <button class="chip" data-r="autre">Autre</button>
      </div>
      <div class="fb-thanks"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>Merci, c'est noté 🙏</div>
    </section>
    <a class="manage r r5" href="${prefs}">Gérer toutes mes notifications <span class="arrow">→</span></a>
    <footer class="foot r r6"><span>Notifications gérées via Quatools</span></footer>
  </main>
<script>
  var TOKEN = ${JSON.stringify(token)}, BASE = ${JSON.stringify(base)};
  var fb = document.getElementById('fb');
  document.querySelectorAll('#chips .chip').forEach(function(chip){
    chip.addEventListener('click', function(){
      document.querySelectorAll('#chips .chip').forEach(function(c){ if(c!==chip) c.classList.add('dim'); });
      chip.classList.add('selected');
      fetch(BASE + '/api/unsubscribe/feedback', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ token: TOKEN, reason: chip.getAttribute('data-r') }),
        keepalive: true
      }).catch(function(){});
      setTimeout(function(){ fb.classList.add('done'); }, 480);
    });
  });
</script>
</body></html>`
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

// RFC 8058 — désabonnement en un clic (déclenché par le client mail, sans page).
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return new NextResponse('Bad Request', { status: 400 })
  const res = await applyOptout(token)
  return new NextResponse(res.ok ? 'OK' : 'Invalid token', { status: res.ok ? 200 : 400 })
}

export async function GET(request: NextRequest) {
  const base = baseUrl(request)
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return errorPage(base, 'Ce lien de désabonnement est incomplet.', 400)

  const res = await applyOptout(token)
  if (!res.ok) return errorPage(base, 'Ce lien de désabonnement est invalide ou a expiré.', 400)

  return confirmPage(base, token, res)
}
