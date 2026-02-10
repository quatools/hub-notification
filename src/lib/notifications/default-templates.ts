/**
 * Templates par défaut proposés à l'admin quand il crée un workflow.
 * Clé = event_slug, valeur = templates par channel_type.
 */

interface DefaultTemplate {
  subject?: string
  body: string
  format: 'text' | 'html' | 'markdown'
}

export const DEFAULT_TEMPLATES: Record<string, Record<string, DefaultTemplate>> = {
  'baas.subscription.created': {
    discord_webhook: {
      body: '**{{member_name}}** vient de souscrire au plan **{{plan_name}}** ({{amount}}€) sur **{{club_name}}**.',
      format: 'markdown',
    },
    email: {
      subject: 'Nouvel abonnement - {{member_name}}',
      body: '<h2>Nouvel abonnement</h2><p><strong>{{member_name}}</strong> vient de souscrire au plan <strong>{{plan_name}}</strong> pour un montant de <strong>{{amount}}€</strong>.</p><p>Club : {{club_name}}</p>',
      format: 'html',
    },
  },
  'baas.subscription.canceled': {
    discord_webhook: {
      body: '**{{member_name}}** a annulé son abonnement **{{plan_name}}** sur **{{club_name}}**.\nRaison : {{reason}}',
      format: 'markdown',
    },
    email: {
      subject: 'Abonnement annulé - {{member_name}}',
      body: '<h2>Abonnement annulé</h2><p><strong>{{member_name}}</strong> a annulé son abonnement <strong>{{plan_name}}</strong>.</p><p>Club : {{club_name}}</p><p>Raison : {{reason}}</p>',
      format: 'html',
    },
  },
  'baas.payment.succeeded': {
    discord_webhook: {
      body: 'Paiement de **{{amount}}€** reçu de **{{member_name}}** ({{plan_name}}).',
      format: 'markdown',
    },
    email: {
      subject: 'Paiement reçu - {{amount}}€',
      body: '<h2>Paiement réussi</h2><p>Un paiement de <strong>{{amount}}€</strong> a été encaissé pour <strong>{{member_name}}</strong> (plan {{plan_name}}).</p>',
      format: 'html',
    },
  },
  'baas.payment.failed': {
    discord_webhook: {
      body: 'Paiement échoué pour **{{member_name}}** ({{amount}}€).\nErreur : {{error_reason}}',
      format: 'markdown',
    },
    email: {
      subject: 'Paiement échoué - {{member_name}}',
      body: '<h2>Paiement échoué</h2><p>Le paiement de <strong>{{amount}}€</strong> pour <strong>{{member_name}}</strong> a échoué.</p><p>Erreur : {{error_reason}}</p>',
      format: 'html',
    },
  },
  'baas.member.joined': {
    discord_webhook: {
      body: '**{{member_name}}** ({{email}}) a rejoint **{{club_name}}**.',
      format: 'markdown',
    },
  },
  'baas.member.profile_updated': {
    discord_webhook: {
      body: '**{{member_name}}** a mis à jour son profil : {{updated_fields}}.',
      format: 'markdown',
    },
  },
  'baas.team.member_assigned': {
    discord_webhook: {
      body: '**{{member_name}}** a été assigné à l\'équipe **{{team_name}}**.',
      format: 'markdown',
    },
  },
  'baas.team.complete': {
    discord_webhook: {
      body: 'L\'équipe **{{team_name}}** est au complet ({{member_count}} membres).',
      format: 'markdown',
    },
  },
}

/**
 * Retourne le template par défaut pour un slug + channel_type donné.
 */
export function getDefaultTemplate(
  eventSlug: string,
  channelType: string
): DefaultTemplate | null {
  return DEFAULT_TEMPLATES[eventSlug]?.[channelType] ?? null
}
