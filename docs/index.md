---
layout: home

hero:
  name: Hub Notification
  text: Vos notifications, votre vie, vos choix.
  tagline: >-
    Le hub de notifications multi-tenant, en marque blanche et souverain.
    Une seule intégration pour Email, Discord et plus — configurable par l'IA,
    avec des préférences que le membre possède vraiment.
  actions:
    - theme: brand
      text: Démarrer en 5 minutes
      link: /quickstart
    - theme: alt
      text: Comprendre les concepts
      link: /concepts/overview
    - theme: alt
      text: Code source (MIT)
      link: https://github.com/quatools/hub-notification

features:
  - icon: 🪪
    title: Souveraineté du membre
    details: >-
      Chaque destinataire possède une fiche canonique et un graphe d'identité.
      Il active, refuse ou redirige ses notifications vers ses propres canaux,
      et garde un historique transparent de tout ce qui lui a été envoyé.
  - icon: 🤖
    title: Configuration par l'IA (MCP)
    details: >-
      Un serveur MCP par organisation. Un admin configure ses canaux, ses
      workflows et ses messages en langage naturel depuis Claude — sans toucher
      à l'interface.
  - icon: 🎨
    title: Marque blanche
    details: >-
      Chaque organisation envoie sous SA marque : nom d'expéditeur, domaine
      d'envoi vérifié (SPF/DKIM/DMARC), embeds Discord aux couleurs du club.
  - icon: 🇪🇺
    title: Souverain par défaut
    details: >-
      SMTP générique (Scaleway TEM, Brevo, OVH…), Discord, aucune dépendance
      à un fournisseur US imposé. Self-hostable, code ouvert et auditable.
  - icon: 🔌
    title: Une intégration, tous les canaux
    details: >-
      Vos apps émettent un événement ; le hub résout les workflows, applique
      les templates et dispatche sur chaque canal. L'app ne connaît jamais les
      canaux ni les préférences.
  - icon: 📖
    title: Open source
    details: >-
      Publié sous licence MIT. Auditez exactement comment vos notifications
      sont traitées — la transparence fait partie du produit.
---

## En une phrase

**Hub Notification** centralise toutes les notifications de vos applications
(abonnements, paiements, inscriptions, rappels…) derrière une seule API. Vos
apps déclarent leurs **événements** et les **émettent** ; les administrateurs
câblent des **workflows** (événement → canal → message) ; les **membres**
gardent la main sur ce qu'ils reçoivent et où.

```text
   Votre app                Hub Notification              Destinataire
      │                            │                            │
      │── register (events) ──────▶│                            │
      │                            │  (admin configure          │
      │                            │   canaux + workflows)      │
      │── emit (événement) ───────▶│                            │
      │                            │── Email ──────────────────▶│
      │◀── { dispatched: N } ──────│── Discord ────────────────▶│
      │                            │── … ──────────────────────▶│
```

## Par où commencer

- **Vous intégrez une app ?** → [Démarrage rapide](/quickstart) puis
  [Référence API](/api/overview).
- **Vous voulez comprendre le modèle ?** → [Vue d'ensemble](/concepts/overview).
- **Vous configurez une organisation ?** → [Configuration par l'IA (MCP)](/guides/mcp)
  ou les guides [Discord](/guides/channels-discord) et [Email](/guides/channels-email).
