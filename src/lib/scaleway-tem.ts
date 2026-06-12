/**
 * Client API Scaleway Transactional Email (TEM).
 * Utilisé pour la marque blanche niveau 2 : enregistrement et vérification
 * des domaines d'envoi des organisations.
 *
 * Env requis : SCW_SECRET_KEY, SCW_DEFAULT_PROJECT_ID (+ SCW_REGION, défaut fr-par).
 */

const SCW_API_BASE = 'https://api.scaleway.com/transactional-email/v1alpha1/regions'

export interface TemDnsRecord {
  name: string
  value: string
}

export interface TemDomainRecords {
  spf: TemDnsRecord
  dkim: TemDnsRecord
  dmarc: TemDnsRecord
  mx: TemDnsRecord
}

export interface TemDomain {
  id: string
  name: string
  /** Statut Scaleway : unchecked, pending, autoconfiguring, checked, invalid, locked, revoked */
  status: string
  last_error: string | null
  next_check_at: string | null
  records: TemDomainRecords
}

/** Mappe le statut Scaleway vers notre domain_status (org_settings). */
export function mapTemStatus(scwStatus: string): 'pending' | 'verified' | 'failed' {
  if (scwStatus === 'checked') return 'verified'
  if (['invalid', 'locked', 'revoked'].includes(scwStatus)) return 'failed'
  return 'pending' // unchecked, pending, autoconfiguring
}

function getConfig() {
  const secretKey = process.env.SCW_SECRET_KEY
  const projectId = process.env.SCW_DEFAULT_PROJECT_ID
  const region = process.env.SCW_REGION || 'fr-par'
  if (!secretKey || !projectId) {
    throw new Error('Scaleway TEM non configuré (SCW_SECRET_KEY, SCW_DEFAULT_PROJECT_ID requis)')
  }
  return { secretKey, projectId, region }
}

async function temFetch(path: string, init?: RequestInit): Promise<Response> {
  const { secretKey, region } = getConfig()
  return fetch(`${SCW_API_BASE}/${region}${path}`, {
    ...init,
    headers: {
      'X-Auth-Token': secretKey,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    signal: AbortSignal.timeout(15000),
  })
}

async function temError(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => null) as { message?: string } | null
  return new Error(body?.message || `${fallback} (HTTP ${res.status})`)
}

/** Enregistre un nouveau domaine d'envoi. */
export async function createTemDomain(domainName: string): Promise<TemDomain> {
  const { projectId } = getConfig()
  const res = await temFetch('/domains', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      domain_name: domainName,
      accept_tos: true,
    }),
  })
  if (!res.ok) throw await temError(res, "Échec de l'enregistrement du domaine")
  return res.json()
}

/** Récupère l'état d'un domaine (statut + enregistrements DNS attendus). */
export async function getTemDomain(domainId: string): Promise<TemDomain> {
  const res = await temFetch(`/domains/${domainId}`)
  if (!res.ok) throw await temError(res, 'Domaine introuvable chez Scaleway')
  return res.json()
}

/** Déclenche une re-vérification DNS du domaine. */
export async function checkTemDomain(domainId: string): Promise<TemDomain> {
  const res = await temFetch(`/domains/${domainId}/check`, { method: 'POST' })
  if (!res.ok) throw await temError(res, 'Échec du déclenchement de la vérification')
  return res.json()
}

/** Révoque un domaine (suppression). */
export async function revokeTemDomain(domainId: string): Promise<void> {
  const res = await temFetch(`/domains/${domainId}/revoke`, { method: 'POST' })
  if (!res.ok) throw await temError(res, 'Échec de la révocation du domaine')
}
