import { createServiceClient } from '@/lib/supabase/server'

/**
 * Résolution du destinataire canonique (CDC v2).
 * Une "personne" du hub, ancrée sur auth.users quand elle s'est connectée,
 * sinon "flottante". L'email est un INDICE (jamais une clé de fusion).
 */

export interface RecipientDescriptor {
  authUserId?: string | null   // session hub (auth.users.id)
  app?: string | null          // ex: 'baas-esport'
  appUserId?: string | null    // id du membre côté app
  discordId?: string | null
  email?: string | null
  name?: string | null
}

export interface ResolvedRecipient {
  recipientId: string
  created: boolean
}

function schema() {
  return createServiceClient().schema('notifications')
}

/** Recipient portant une identité-clé (app|discord) donnée, sinon null. */
async function findByKeyIdentity(
  kind: 'app' | 'discord',
  app: string | null,
  value: string
): Promise<string | null> {
  let q = schema()
    .from('recipient_identities')
    .select('recipient_id')
    .eq('kind', kind)
    .eq('value', value)
    .eq('is_key', true)
    .limit(1)
  q = app === null ? q.is('app', null) : q.eq('app', app)
  const { data } = await q.maybeSingle()
  return (data as { recipient_id?: string } | null)?.recipient_id ?? null
}

/** Rattache une identité à une personne (idempotent). */
async function ensureIdentity(
  recipientId: string,
  kind: 'app' | 'discord' | 'email' | 'phone',
  app: string | null,
  value: string,
  isKey: boolean
): Promise<void> {
  const { data: existing } = await schema()
    .from('recipient_identities')
    .select('id')
    .eq('recipient_id', recipientId)
    .eq('kind', kind)
    .eq('value', value)
    .maybeSingle()
  if (existing) return

  const { error } = await schema()
    .from('recipient_identities')
    .insert({ recipient_id: recipientId, kind, app, value, is_key: isKey })
  // 23505 = identité-clé déjà prise par une autre personne (course) → on ignore
  if (error && (error as { code?: string }).code !== '23505') {
    console.error('ensureIdentity:', error)
  }
}

/**
 * Résout (ou crée) le destinataire d'un descripteur.
 * Ordre de résolution : auth_user_id → app:appUserId → discordId → création flottante.
 * Les identités fournies sont rattachées (idempotent). L'email est posé en indice.
 */
export async function resolveRecipient(d: RecipientDescriptor): Promise<ResolvedRecipient> {
  const app = d.app?.toString().trim() || null
  const appUserId = d.appUserId?.toString().trim() || null
  const discordId = d.discordId?.toString().trim() || null
  const email = d.email?.toString().trim().toLowerCase() || null
  const authUserId = d.authUserId?.toString().trim() || null
  const name = d.name?.toString().trim() || null

  let recipientId: string | null = null
  let created = false

  // 1. par auth_user_id (session hub)
  if (!recipientId && authUserId) {
    const { data } = await schema()
      .from('recipients')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()
    recipientId = (data as { id?: string } | null)?.id ?? null
  }
  // 2. par identité app (clé)
  if (!recipientId && app && appUserId) {
    recipientId = await findByKeyIdentity('app', app, appUserId)
  }
  // 3. par identité discord (clé forte = pont login ↔ destinataire)
  if (!recipientId && discordId) {
    recipientId = await findByKeyIdentity('discord', null, discordId)
  }

  // 4. création flottante
  if (!recipientId) {
    const { data, error } = await schema()
      .from('recipients')
      .insert({ display_name: name, auth_user_id: authUserId })
      .select('id')
      .single()
    if (error || !data) {
      throw new Error(`resolveRecipient: création impossible (${error?.message || 'inconnue'})`)
    }
    recipientId = (data as { id: string }).id
    created = true
  } else if (name) {
    await schema().from('recipients').update({ display_name: name }).eq('id', recipientId)
  }

  // Rattacher les identités fournies (idempotent). Email = indice (is_key=false).
  if (app && appUserId) await ensureIdentity(recipientId, 'app', app, appUserId, true)
  if (discordId) await ensureIdentity(recipientId, 'discord', null, discordId, true)
  if (email) await ensureIdentity(recipientId, 'email', null, email, false)

  return { recipientId, created }
}

/**
 * Rattache une identité d'app à la personne hub authentifiée (claim).
 * - garantit la personne ancrée sur auth.users (la crée au besoin, is_claimed) ;
 * - si une (ou des) fiche(s) flottante(s) portent déjà l'identité app/discord,
 *   elle(s) est/sont FUSIONNÉE(S) dans la personne (les notifs remontent) ;
 * - rattache les identités fournies.
 * Retourne le recipient_id canonique.
 */
export async function claimAppIdentity(
  authUserId: string,
  name: string | null,
  ident: { app: string; appUserId: string; email?: string | null; discordId?: string | null }
): Promise<string> {
  const sb = schema()

  // 1. Personne ancrée auth.users (créée si besoin)
  const { data: existing } = await sb
    .from('recipients')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  let keepId = (existing as { id?: string } | null)?.id ?? null
  if (!keepId) {
    const { data, error } = await sb
      .from('recipients')
      .insert({ auth_user_id: authUserId, is_claimed: true, display_name: name })
      .select('id')
      .single()
    if (error || !data) throw new Error(`claimAppIdentity: création personne impossible (${error?.message})`)
    keepId = (data as { id: string }).id
  } else {
    await sb
      .from('recipients')
      .update({ is_claimed: true, ...(name ? { display_name: name } : {}) })
      .eq('id', keepId)
  }

  // 2. Fiches flottantes portant l'identité app / discord → à fusionner
  const toMerge = new Set<string>()
  const byApp = await findByKeyIdentity('app', ident.app, ident.appUserId)
  if (byApp && byApp !== keepId) toMerge.add(byApp)
  if (ident.discordId) {
    const byDiscord = await findByKeyIdentity('discord', null, ident.discordId)
    if (byDiscord && byDiscord !== keepId) toMerge.add(byDiscord)
  }
  for (const dropId of toMerge) {
    const { error } = await createServiceClient()
      .schema('notifications')
      .rpc('merge_recipients', { keep_id: keepId, drop_id: dropId })
    if (error) console.error('claimAppIdentity merge:', error)
  }

  // 3. Rattacher les identités fournies à la personne canonique
  await ensureIdentity(keepId, 'app', ident.app, ident.appUserId, true)
  if (ident.discordId) await ensureIdentity(keepId, 'discord', null, ident.discordId, true)
  if (ident.email) await ensureIdentity(keepId, 'email', null, ident.email.toLowerCase(), false)

  return keepId
}
