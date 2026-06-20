/**
 * Gestion self-service des applications et de leurs clés API.
 * Une app appartient à l'utilisateur qui l'a créée (owner_user_id) ; toute la
 * logique vérifie cette propriété. Les clés sont stockées HASHÉES.
 */
import { createHash, randomBytes } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

const MAX_APPS_PER_USER = 5
const SLUG_RE = /^[a-z][a-z0-9-]{1,38}$/

export interface AppRow {
  id: string
  slug: string
  name: string
  status: 'trial' | 'active' | 'blocked'
  send_count: number
  trial_limit: number
  signing_secret: string
  created_at: string
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

/** Slugs réservés = ceux déjà câblés en env (baas-esport…). */
function reservedSlugs(): Set<string> {
  try {
    return new Set(Object.keys(JSON.parse(process.env.NOTIFICATION_API_KEYS || '{}')))
  } catch {
    return new Set<string>()
  }
}

export async function listApps(userId: string) {
  const sb = createServiceClient()
  const { data } = await sb
    .schema('notifications')
    .from('apps')
    .select('id, slug, name, status, send_count, trial_limit, created_at')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: true })
  return data || []
}

export async function getOwnedApp(userId: string, appId: string): Promise<AppRow | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .schema('notifications')
    .from('apps')
    .select('*')
    .eq('id', appId)
    .eq('owner_user_id', userId)
    .maybeSingle()
  return (data as AppRow | null) || null
}

export async function createApp(
  userId: string,
  name: string,
  slug: string
): Promise<{ app?: AppRow; error?: string }> {
  if (!name || !name.trim()) return { error: 'Nom requis' }
  if (!SLUG_RE.test(slug)) {
    return { error: 'Identifiant invalide (minuscules, chiffres, tirets ; commence par une lettre ; 2-39 caractères)' }
  }
  if (reservedSlugs().has(slug)) return { error: 'Cet identifiant est réservé' }

  const sb = createServiceClient()
  const { count } = await sb
    .schema('notifications')
    .from('apps')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', userId)
  if ((count || 0) >= MAX_APPS_PER_USER) {
    return { error: `Limite de ${MAX_APPS_PER_USER} applications par compte atteinte` }
  }

  const signing_secret = randomBytes(32).toString('hex')
  const { data, error } = await sb
    .schema('notifications')
    .from('apps')
    .insert({ name: name.trim(), slug, owner_user_id: userId, signing_secret })
    .select('*')
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') return { error: 'Cet identifiant est déjà pris' }
    console.error('Erreur création app:', error)
    return { error: "Erreur lors de la création de l'application" }
  }
  return { app: data as AppRow }
}

export async function deleteApp(userId: string, appId: string): Promise<boolean> {
  const app = await getOwnedApp(userId, appId)
  if (!app) return false
  const sb = createServiceClient()
  await sb.schema('notifications').from('apps').delete().eq('id', appId)
  return true
}

/** Génère une clé API : renvoie le secret EN CLAIR une seule fois (stocke le hash). */
export async function generateKey(
  userId: string,
  appId: string,
  label?: string
): Promise<{ secret?: string; error?: string }> {
  const app = await getOwnedApp(userId, appId)
  if (!app) return { error: 'Application introuvable' }

  const secret = `${app.slug}_${randomBytes(24).toString('hex')}`
  const prefix = secret.slice(0, 14) + '…'
  const sb = createServiceClient()
  const { error } = await sb
    .schema('notifications')
    .from('api_keys')
    .insert({
      app_id: appId,
      key_hash: sha256(secret),
      key_prefix: prefix,
      label: label || null,
      created_by: userId,
    })
  if (error) {
    console.error('Erreur génération clé:', error)
    return { error: 'Erreur lors de la génération de la clé' }
  }
  return { secret }
}

export async function listKeys(appId: string) {
  const sb = createServiceClient()
  const { data } = await sb
    .schema('notifications')
    .from('api_keys')
    .select('id, key_prefix, label, last_used_at, revoked_at, created_at')
    .eq('app_id', appId)
    .order('created_at', { ascending: false })
  return data || []
}

export async function revokeKey(appId: string, keyId: string) {
  const sb = createServiceClient()
  await sb
    .schema('notifications')
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('app_id', appId)
}
