<div align="center">

# Hub Notification

**Le hub de notifications multi-tenant, en marque blanche et souverain.**

*Vos notifications, votre vie, vos choix.*

[Documentation](https://quatools.fr/hub/docs) · [Démarrage rapide](https://quatools.fr/hub/docs/quickstart) · [Concepts](https://quatools.fr/hub/docs/concepts/overview)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E)](https://supabase.com)

</div>

---

Hub Notification centralise toutes les notifications de vos applications
(abonnements, paiements, inscriptions, rappels…) derrière **une seule API**. Vos
apps déclarent leurs **événements** et les **émettent** ; les administrateurs
câblent des **workflows** (événement → canal → message) ; les **membres** gardent
la main sur ce qu'ils reçoivent et où.

```text
   Votre app                Hub Notification              Destinataire
      │── register ─────────────▶│                            │
      │                          │  (admin configure          │
      │                          │   canaux + workflows)      │
      │── emit ─────────────────▶│── Email ──────────────────▶│
      │◀── { dispatched: N } ────│── Discord ────────────────▶│
```

## Pourquoi ce hub

- 🪪 **Souveraineté du membre** — chaque destinataire a une fiche canonique et un
  graphe d'identité. Il active, refuse ou redirige ses notifications, et garde un
  historique transparent de ce qui lui a été envoyé.
- 🤖 **Configuration par l'IA (MCP)** — un serveur MCP par organisation : un admin
  configure ses workflows en langage naturel depuis Claude.
- 🎨 **Marque blanche** — chaque organisation envoie sous SA marque (nom
  d'expéditeur, domaine vérifié SPF/DKIM/DMARC, embeds Discord à ses couleurs).
- 🇪🇺 **Souverain par défaut** — SMTP générique (Scaleway TEM, Brevo, OVH…),
  Discord natif, aucun fournisseur US imposé.
- 📖 **Open source (MIT)** — auditez exactement comment vos notifications sont
  traitées. La transparence fait partie du produit.

## Canaux supportés

| Canal | Description |
|---|---|
| **Email** | SMTP générique, From en marque blanche, domaine d'envoi dédié. |
| **Discord (webhook)** | Embed dans un salon, coloré par catégorie. |
| **Discord (DM)** | Message privé via bot, mode « membre concerné » ou adresse fixe. |

## Stack

Next.js 16 (App Router) · React 19 · Supabase (PostgreSQL, schéma `notifications`,
Auth) · Nodemailer (SMTP) · API REST Discord · OAuth 2.1 + PKCE (serveur MCP).

## Démarrage (développement)

```bash
# 1. Dépendances
npm install

# 2. Variables d'environnement
cp .env.example .env.local
# puis renseigner Supabase, SMTP, clés API, Discord, MCP (voir .env.example)

# 3. Base de données (schéma `notifications`)
#    Appliquer les migrations de supabase/migrations/ sur votre instance Supabase.

# 4. Lancer
npm run dev        # http://localhost:3000
```

Intégrer une application : voir le
[Démarrage rapide](https://quatools.fr/hub/docs/quickstart).

## Documentation

La documentation complète vit dans [`docs/`](./docs) (site VitePress) et est
publiée sur **[quatools.fr/hub/docs](https://quatools.fr/hub/docs)** :

- **Concepts** — événements, canaux, workflows, audiences, destinataires & identités
- **Guides** — Discord, Email & marque blanche, configuration par IA (MCP),
  souveraineté du membre
- **Référence API** — `register`, `emit`, admin, membre, rattachement
- **Architecture** — modèle de données, flux d'émission

## Architecture & portée

> [!NOTE]
> Le hub est conçu pour vivre **dans** l'infrastructure Supabase partagée de la
> suite Quatools (schéma `notifications` aux côtés des autres apps, `auth.users`
> commun) ; il s'appuie aujourd'hui sur la table `public.club_admins` pour
> l'autorisation des administrateurs. Ce n'est donc pas un binaire isolé
> « clone & run ». Le code reste néanmoins **entièrement auditable et réutilisable**
> — c'est l'objectif de cette publication open source.

## Contribuer

Les contributions sont les bienvenues — voir [CONTRIBUTING.md](./CONTRIBUTING.md).
Pour signaler une faille de sécurité, voir [SECURITY.md](./SECURITY.md).

## Licence

[MIT](./LICENSE) © Quatools — *Vos notifications, votre vie, vos choix.*
