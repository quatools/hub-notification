import type { RegisterRequest } from '@/lib/types/notifications'

/**
 * Définition des 8 événements BAAS Esport pour le MVP.
 * Utilisé par le script de seed et la registration automatique.
 */
export const BAAS_EVENTS: RegisterRequest = {
  app: 'baas-esport',
  events: [
    // --- BILLING ---
    {
      slug: 'baas.subscription.created',
      label: 'Nouvel abonnement',
      description: 'Un membre vient de souscrire à un abonnement',
      category: 'billing',
      supported_channels: ['email', 'discord_webhook'],
      audiences: ['admin', 'member'],
      default_active: true,
      payload_schema: {
        member_name: 'string',
        plan_name: 'string',
        amount: 'number',
        club_name: 'string',
      },
    },
    {
      slug: 'baas.subscription.canceled',
      label: 'Abonnement annulé',
      description: 'Un membre a annulé son abonnement',
      category: 'billing',
      supported_channels: ['email', 'discord_webhook'],
      audiences: ['admin', 'member'],
      default_active: true,
      payload_schema: {
        member_name: 'string',
        plan_name: 'string',
        club_name: 'string',
        reason: 'string',
      },
    },
    {
      slug: 'baas.payment.succeeded',
      label: 'Paiement réussi',
      description: 'Un paiement a été encaissé avec succès',
      category: 'billing',
      supported_channels: ['email', 'discord_webhook'],
      audiences: ['admin', 'member'],
      default_active: false,
      payload_schema: {
        member_name: 'string',
        amount: 'number',
        plan_name: 'string',
      },
    },
    {
      slug: 'baas.payment.failed',
      label: 'Paiement échoué',
      description: 'Un paiement a échoué',
      category: 'billing',
      supported_channels: ['email', 'discord_webhook'],
      audiences: ['admin'],
      default_active: true,
      payload_schema: {
        member_name: 'string',
        amount: 'number',
        error_reason: 'string',
      },
    },

    // --- MEMBER ---
    {
      slug: 'baas.member.joined',
      label: 'Nouveau membre',
      description: 'Un nouveau membre a rejoint le club',
      category: 'member',
      // email + discord_dm pour permettre un MAIL (ou MP) DE BIENVENUE adressé au
      // nouveau membre ; audience 'member' pour qu'il puisse gérer/refuser cette
      // notif. Émis par le BAAS à la 1re adhésion du membre au club.
      supported_channels: ['email', 'discord_webhook', 'discord_dm'],
      audiences: ['admin', 'member'],
      default_active: true,
      payload_schema: {
        member_name: 'string',
        email: 'string',
        club_name: 'string',
      },
    },
    {
      slug: 'baas.member.profile_updated',
      label: 'Profil mis à jour',
      description: 'Un membre a mis à jour son profil',
      category: 'member',
      supported_channels: ['discord_webhook'],
      audiences: ['admin'],
      default_active: false,
      payload_schema: {
        member_name: 'string',
        updated_fields: 'string',
      },
    },

    // --- TEAM ---
    {
      slug: 'baas.team.member_assigned',
      label: 'Membre assigné à une équipe',
      description: 'Un membre a été assigné à une équipe',
      category: 'team',
      supported_channels: ['discord_webhook'],
      audiences: ['admin'],
      default_active: true,
      payload_schema: {
        member_name: 'string',
        team_name: 'string',
      },
    },
    {
      slug: 'baas.team.complete',
      label: 'Équipe au complet',
      description: 'Une équipe a atteint son nombre maximum de membres',
      category: 'team',
      supported_channels: ['discord_webhook'],
      audiences: ['admin'],
      default_active: true,
      payload_schema: {
        team_name: 'string',
        member_count: 'number',
      },
    },
  ],
}
