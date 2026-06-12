import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/auth/admin'
import { createServiceClient } from '@/lib/supabase/server'
import {
  createTemDomain,
  getTemDomain,
  checkTemDomain,
  revokeTemDomain,
  mapTemStatus,
  type TemDomain,
} from '@/lib/scaleway-tem'

const DOMAIN_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/

interface DomainResponse {
  sender_domain: string | null
  sender_local_part: string
  domain_status: string
  dns_records: TemDomain['records'] | null
  last_error: string | null
}

/** Synchronise org_settings depuis l'état Scaleway et construit la réponse API. */
async function syncAndRespond(orgId: string, tem: TemDomain, localPart: string): Promise<DomainResponse> {
  const supabase = createServiceClient()
  const status = mapTemStatus(tem.status)

  await supabase
    .schema('notifications')
    .from('org_settings')
    .upsert(
      {
        org_id: orgId,
        sender_domain: tem.name,
        sender_local_part: localPart,
        domain_status: status,
        domain_provider_id: tem.id,
        domain_dns_records: tem.records,
      },
      { onConflict: 'org_id' }
    )

  return {
    sender_domain: tem.name,
    sender_local_part: localPart,
    domain_status: status,
    dns_records: tem.records,
    last_error: tem.last_error,
  }
}

async function getOrgSettings(orgId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .schema('notifications')
    .from('org_settings')
    .select('sender_domain, sender_local_part, domain_status, domain_provider_id, domain_dns_records')
    .eq('org_id', orgId)
    .single()
  return data
}

// GET /api/admin/settings/domain?org_id=xxx — état courant, resynchronisé depuis Scaleway
export async function GET(request: NextRequest) {
  const auth = await getAdminAuth(request.nextUrl.searchParams.get('org_id'))
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const settings = await getOrgSettings(auth.org_id)
  if (!settings?.domain_provider_id) {
    return NextResponse.json({
      domain: {
        sender_domain: null,
        sender_local_part: settings?.sender_local_part || 'notifications',
        domain_status: 'unconfigured',
        dns_records: null,
        last_error: null,
      } satisfies DomainResponse,
    })
  }

  try {
    const tem = await getTemDomain(settings.domain_provider_id)
    const domain = await syncAndRespond(auth.org_id, tem, settings.sender_local_part || 'notifications')
    return NextResponse.json({ domain })
  } catch (error) {
    console.error('Erreur sync domaine TEM:', error)
    // Retourner l'état en cache plutôt qu'une erreur dure
    return NextResponse.json({
      domain: {
        sender_domain: settings.sender_domain,
        sender_local_part: settings.sender_local_part || 'notifications',
        domain_status: settings.domain_status || 'pending',
        dns_records: settings.domain_dns_records,
        last_error: 'Synchronisation Scaleway impossible (état en cache)',
      } satisfies DomainResponse,
    })
  }
}

// POST /api/admin/settings/domain — enregistrer un domaine d'envoi
export async function POST(request: NextRequest) {
  let body: { org_id?: string; domain?: string; local_part?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const auth = await getAdminAuth(body.org_id || null)
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const domain = body.domain?.trim().toLowerCase() || ''
  if (!DOMAIN_REGEX.test(domain)) {
    return NextResponse.json({ error: 'Nom de domaine invalide (ex: monclub.fr)' }, { status: 400 })
  }

  const localPart = (body.local_part?.trim().toLowerCase() || 'notifications')
  if (!/^[a-z0-9._-]{1,64}$/.test(localPart)) {
    return NextResponse.json({ error: "Partie locale invalide (ex: notifications)" }, { status: 400 })
  }

  const existing = await getOrgSettings(auth.org_id)
  if (existing?.domain_provider_id) {
    return NextResponse.json(
      { error: 'Un domaine est déjà configuré. Supprimez-le avant d\'en ajouter un autre.' },
      { status: 409 }
    )
  }

  try {
    const tem = await createTemDomain(domain)
    const domainResponse = await syncAndRespond(auth.org_id, tem, localPart)
    return NextResponse.json({ domain: domainResponse }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Échec de l'enregistrement du domaine" },
      { status: 502 }
    )
  }
}

// PATCH /api/admin/settings/domain — déclencher une re-vérification DNS
export async function PATCH(request: NextRequest) {
  let body: { org_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const auth = await getAdminAuth(body.org_id || null)
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const settings = await getOrgSettings(auth.org_id)
  if (!settings?.domain_provider_id) {
    return NextResponse.json({ error: 'Aucun domaine configuré' }, { status: 404 })
  }

  try {
    await checkTemDomain(settings.domain_provider_id)
    // La vérification est asynchrone côté Scaleway : on relit l'état
    const tem = await getTemDomain(settings.domain_provider_id)
    const domain = await syncAndRespond(auth.org_id, tem, settings.sender_local_part || 'notifications')
    return NextResponse.json({ domain })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Échec de la vérification' },
      { status: 502 }
    )
  }
}

// DELETE /api/admin/settings/domain?org_id=xxx — révoquer le domaine
export async function DELETE(request: NextRequest) {
  const auth = await getAdminAuth(request.nextUrl.searchParams.get('org_id'))
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const settings = await getOrgSettings(auth.org_id)
  if (!settings?.domain_provider_id) {
    return NextResponse.json({ error: 'Aucun domaine configuré' }, { status: 404 })
  }

  try {
    await revokeTemDomain(settings.domain_provider_id)
  } catch (error) {
    // Si le domaine n'existe plus chez Scaleway, on nettoie quand même
    console.error('Erreur révocation TEM (nettoyage local quand même):', error)
  }

  const supabase = createServiceClient()
  await supabase
    .schema('notifications')
    .from('org_settings')
    .update({
      sender_domain: null,
      domain_status: 'unconfigured',
      domain_provider_id: null,
      domain_dns_records: null,
    })
    .eq('org_id', auth.org_id)

  return NextResponse.json({ success: true })
}
