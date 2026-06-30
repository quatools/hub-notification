import { defineConfig } from 'vitepress'

// Documentation publique du Hub Notification.
// Site autonome, déployable indépendamment de l'app (cible : docs.quatools.fr).
export default defineConfig({
  lang: 'fr-FR',
  title: 'Hub Notification',
  description:
    'Hub de notifications multi-tenant, marque blanche et souverain. Vos notifications, votre vie, vos choix.',
  // Servi en sous-répertoire du site studio pour consolider le SEO sur quatools.fr :
  //   quatools.fr/hub      → landing produit (site studio)
  //   quatools.fr/hub/docs → cette documentation
  base: '/hub/docs/',
  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    nav: [
      { text: 'Accueil', link: '/' },
      { text: 'Démarrage', link: '/quickstart' },
      { text: 'Concepts', link: '/concepts/overview' },
      { text: 'Référence API', link: '/api/emit' },
      { text: 'llms.txt', link: '/llms-full.txt', target: '_blank', rel: 'noopener' },
      { text: 'GitHub', link: 'https://github.com/quatools/hub-notification' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Présentation', link: '/' },
          { text: 'Démarrage rapide', link: '/quickstart' },
        ],
      },
      {
        text: 'Concepts',
        items: [
          { text: "Vue d'ensemble", link: '/concepts/overview' },
          { text: 'Événements', link: '/concepts/events' },
          { text: 'Canaux', link: '/concepts/channels' },
          { text: 'Workflows', link: '/concepts/workflows' },
          { text: 'Audiences', link: '/concepts/audiences' },
          { text: 'Destinataires & identités', link: '/concepts/recipients-identity' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Canaux Discord', link: '/guides/channels-discord' },
          { text: 'Canaux Email & marque blanche', link: '/guides/channels-email' },
          { text: 'Configuration par IA (MCP)', link: '/guides/mcp' },
          { text: 'Souveraineté du membre', link: '/guides/member-sovereignty' },
        ],
      },
      {
        text: 'Référence API',
        items: [
          { text: 'Vue d’ensemble & auth', link: '/api/overview' },
          { text: 'POST /register', link: '/api/register' },
          { text: 'POST /orgs', link: '/api/orgs' },
          { text: 'POST /emit', link: '/api/emit' },
          { text: 'API Admin', link: '/api/admin' },
          { text: 'API Membre', link: '/api/user' },
          { text: 'Rattachement (/link)', link: '/api/link' },
        ],
      },
      {
        text: 'Architecture',
        items: [
          { text: 'Modèle de données', link: '/architecture/data-model' },
          { text: "Flux d'émission", link: '/architecture/emit-flow' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/quatools/hub-notification' },
    ],

    footer: {
      message: 'Publié sous licence MIT.',
      copyright: '© Quatools — Vos notifications, votre vie, vos choix.',
    },

    search: { provider: 'local' },
  },
})
