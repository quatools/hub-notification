/**
 * Définitions des tools MCP du hub notification.
 * L'org_id est injecté depuis l'URL de la ressource — jamais demandé au modèle.
 */

export interface McpTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export const hubTools: McpTool[] = [
  // ---- Événements ----
  {
    name: 'list_events',
    description:
      "Liste le catalogue des événements que les applications Quatools peuvent déclencher, avec leurs variables de template ({{variable}}), canaux supportés et le nombre de workflows configurés. À appeler en premier pour savoir ce qui est configurable.",
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filtrer par catégorie : billing, member, team, shop, system',
        },
      },
    },
  },

  // ---- Canaux ----
  {
    name: 'list_channels',
    description: "Liste les canaux de notification de l'organisation (webhooks Discord, emails) avec leur statut de vérification.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_channel',
    description:
      "Crée un canal de notification. Pour Discord : fournir webhook_url (https://discord.com/api/webhooks/...), vérifié automatiquement. Pour email : fournir email.",
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['discord_webhook', 'email'], description: 'Type de canal' },
        label: { type: 'string', description: 'Nom du canal (ex: "#annonces", "Email staff")' },
        webhook_url: { type: 'string', description: 'URL du webhook Discord (type discord_webhook)' },
        email: { type: 'string', description: 'Adresse email (type email)' },
      },
      required: ['type'],
    },
  },
  {
    name: 'update_channel',
    description: 'Modifie un canal (label, destination, activation). La destination est re-vérifiée si elle change.',
    inputSchema: {
      type: 'object',
      properties: {
        channel_id: { type: 'string', description: 'ID du canal' },
        label: { type: 'string' },
        webhook_url: { type: 'string', description: 'Nouvelle URL webhook (canal Discord)' },
        email: { type: 'string', description: 'Nouvelle adresse (canal email)' },
        is_active: { type: 'boolean' },
      },
      required: ['channel_id'],
    },
  },
  {
    name: 'delete_channel',
    description: 'Supprime un canal. ATTENTION : les workflows qui l\'utilisent sont supprimés en cascade.',
    inputSchema: {
      type: 'object',
      properties: {
        channel_id: { type: 'string', description: 'ID du canal à supprimer' },
      },
      required: ['channel_id'],
    },
  },

  // ---- Workflows ----
  {
    name: 'list_workflows',
    description: 'Liste les workflows (routes de notification) configurés : événement → canal + message, avec leur statut actif/inactif.',
    inputSchema: {
      type: 'object',
      properties: {
        event_slug: { type: 'string', description: 'Filtrer par événement (ex: baas.subscription.created)' },
      },
    },
  },
  {
    name: 'create_workflow',
    description:
      "Crée un workflow : quand l'événement survient, envoie le message sur le canal. Le body utilise les variables {{variable}} de l'événement (voir list_events). Format markdown pour Discord, html pour email. Pour un email : un fragment HTML simple reçoit l'habillage automatique aux couleurs de l'organisation ; un document complet (<!DOCTYPE html>...) est envoyé tel quel pour un contrôle total du design.",
    inputSchema: {
      type: 'object',
      properties: {
        event_slug: { type: 'string', description: "Slug de l'événement (ex: baas.preorder.confirmed)" },
        channel_id: { type: 'string', description: 'ID du canal de destination' },
        subject: { type: 'string', description: 'Sujet (email uniquement), variables {{}} acceptées' },
        body: { type: 'string', description: 'Corps du message avec variables {{variable}}' },
        format: { type: 'string', enum: ['text', 'markdown', 'html'], description: 'Défaut : markdown pour Discord, html pour email' },
      },
      required: ['event_slug', 'channel_id', 'body'],
    },
  },
  {
    name: 'update_workflow',
    description: "Modifie le message d'un workflow (sujet, corps, format) ou son activation.",
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: { type: 'string', description: 'ID du workflow' },
        subject: { type: 'string' },
        body: { type: 'string' },
        format: { type: 'string', enum: ['text', 'markdown', 'html'] },
        is_active: { type: 'boolean' },
      },
      required: ['workflow_id'],
    },
  },
  {
    name: 'delete_workflow',
    description: 'Supprime un workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: { type: 'string', description: 'ID du workflow à supprimer' },
      },
      required: ['workflow_id'],
    },
  },
  {
    name: 'test_workflow',
    description:
      "Envoie une notification de test pour un workflow, avec des données d'exemple (générées ou fournies). Pour un canal email, override_email permet d'envoyer vers une adresse de test plutôt que la vraie destination.",
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: { type: 'string', description: 'ID du workflow à tester' },
        payload: {
          type: 'object',
          description: 'Valeurs de test pour les variables (ex: {"member_name": "Jean Test"})',
        },
        override_email: { type: 'string', description: "Adresse de test (canaux email uniquement)" },
      },
      required: ['workflow_id'],
    },
  },

  // ---- Historique ----
  {
    name: 'get_logs',
    description: "Historique des notifications envoyées (statut sent/failed, erreurs, contenu).",
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['sent', 'failed', 'pending'], description: 'Filtrer par statut' },
        event_slug: { type: 'string', description: 'Filtrer par événement' },
        limit: { type: 'number', description: 'Nombre max de résultats (défaut 20, max 100)' },
      },
    },
  },

  // ---- Marque blanche ----
  {
    name: 'get_sender_identity',
    description: "Identité d'expéditeur de l'organisation (marque blanche) : nom d'envoi, adresse de réponse, domaine d'envoi personnalisé et son statut.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'set_sender_identity',
    description:
      "Configure l'identité marque blanche : sender_name devient le nom d'envoi des emails ET l'auteur des messages Discord ; reply_to reçoit les réponses aux emails.",
    inputSchema: {
      type: 'object',
      properties: {
        sender_name: { type: 'string', description: "Nom d'expéditeur (ex: 'Club Démo'), 80 caractères max" },
        reply_to: { type: 'string', description: 'Adresse de réponse (ex: contact@monclub.fr)' },
      },
    },
  },
  {
    name: 'setup_sending_domain',
    description:
      "Enregistre un domaine d'envoi personnalisé pour que les emails partent de notifications@<domaine>. Retourne les enregistrements DNS (SPF, DKIM, DMARC, MX) que l'organisation doit poser chez son hébergeur, puis utiliser check_sending_domain.",
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Domaine (ex: monclub.fr)' },
        local_part: { type: 'string', description: "Partie locale du From (défaut: 'notifications')" },
      },
      required: ['domain'],
    },
  },
  {
    name: 'check_sending_domain',
    description: "Déclenche/rafraîchit la vérification DNS du domaine d'envoi et retourne son statut (pending, verified, failed) avec les enregistrements attendus.",
    inputSchema: { type: 'object', properties: {} },
  },
]
