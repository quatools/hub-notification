import { createServiceClient } from '@/lib/supabase/server'

export interface SenderIdentity {
  /** Nom d'affichage de l'expéditeur ("Club Démo") */
  name: string | null
  /** Adresse de réponse souhaitée par l'organisation */
  replyTo: string | null
  /**
   * Adresse From dédiée (niveau 2). Renseignée uniquement si l'org a un
   * domaine d'envoi vérifié — sinon null et on retombe sur SMTP_FROM.
   */
  fromEmail: string | null
}

const EMPTY_SENDER: SenderIdentity = { name: null, replyTo: null, fromEmail: null }

/**
 * Résout l'identité d'expéditeur d'une organisation (marque blanche).
 * Retourne une identité vide si l'org n'a rien configuré.
 */
export async function getSenderIdentity(orgId: string): Promise<SenderIdentity> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .schema('notifications')
    .from('org_settings')
    .select('sender_name, reply_to, sender_domain, sender_local_part, domain_status')
    .eq('org_id', orgId)
    .single()

  if (!data) return EMPTY_SENDER

  return {
    name: data.sender_name || null,
    replyTo: data.reply_to || null,
    fromEmail:
      data.domain_status === 'verified' && data.sender_domain
        ? `${data.sender_local_part || 'notifications'}@${data.sender_domain}`
        : null,
  }
}
