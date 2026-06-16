# Vue d'ensemble

Hub Notification est un **hub de notifications multi-tenant**. Il découple
*qui produit un événement* (vos applications) de *comment et à qui il est
notifié* (canaux, messages, préférences). Vos apps n'ont qu'une chose à faire :
**déclarer** leurs événements puis les **émettre**. Tout le reste — routage,
templates, marque blanche, opt-out, historique — vit dans le hub.

## Le modèle en quatre objets

| Objet | Qui le crée | Rôle |
|---|---|---|
| **Événement** (`event`) | l'application (via `register`) | Décrit un type de notification : un slug, un libellé, les canaux supportés, les audiences, le schéma de payload. |
| **Canal** (`channel`) | l'admin (ou le membre) | Une destination concrète : un webhook Discord, une boîte mail, un DM Discord. |
| **Workflow** | l'admin | Une route : *événement → canal + message*. Sans workflow actif, rien n'est envoyé. |
| **Exécution** (`execution`) | le hub | La trace d'un envoi : statut, destination, contenu rendu, erreur éventuelle. |

À cela s'ajoute la couche **destinataires & identités** (CDC v2) qui donne au
*membre* une existence propre dans le hub — voir
[Destinataires & identités](/concepts/recipients-identity).

## Le cycle de vie complet

```text
1. REGISTER   L'app déclare ses événements au démarrage.
              POST /api/notifications/register

2. CONFIGURE  Un admin crée des canaux et des workflows (UI, ou en langage
              naturel via le serveur MCP).

3. EMIT       L'app émet un événement avec un payload + les destinataires.
              POST /api/notifications/emit

4. RESOLVE    Le hub trouve les workflows actifs, résout les destinataires
              canoniques, vérifie les opt-out.

5. DISPATCH   Le hub applique le template, envoie sur chaque canal, et logge
              une exécution. La réponse HTTP part immédiatement ; l'envoi se
              poursuit en arrière-plan.
```

## Ce qui rend le hub différent

### 1. Le membre possède ses préférences

Dans la plupart des systèmes, les préférences de notification appartiennent à
l'application. Ici, chaque destinataire a une **fiche canonique** et un **graphe
d'identité** (app, Discord, email…). Il peut **refuser** une notification,
**rediriger** vers ses propres canaux et consulter l'**historique** de ce qui
lui a été envoyé — indépendamment de l'app qui a déclenché l'événement.

### 2. Configurable par l'IA

Chaque organisation dispose d'un **serveur MCP** dédié (`/api/mcp/{orgId}`).
Un admin connecte Claude et configure ses canaux, workflows et messages **en
langage naturel**. Voir [Configuration par l'IA (MCP)](/guides/mcp).

### 3. Marque blanche

Chaque organisation envoie sous **sa propre identité** : nom d'expéditeur,
adresse de réponse, **domaine d'envoi vérifié** (SPF/DKIM/DMARC via Scaleway
TEM), et embeds Discord à ses couleurs. Voir
[Email & marque blanche](/guides/channels-email).

### 4. Souverain et ouvert

Email via **SMTP générique** (Scaleway TEM, Brevo, OVH… — aucun fournisseur US
imposé), Discord natif, et code publié sous **licence MIT** : la transparence
fait partie de l'offre.

## Stack technique

- **Next.js 16** (App Router) + React 19
- **Supabase** (PostgreSQL, schéma `notifications`, Auth) — base partagée
- **Nodemailer** (SMTP générique) pour l'email
- **API REST Discord** (webhooks + bot) pour Discord
- **OAuth 2.1 + PKCE** pour sécuriser le serveur MCP
- **jose** (JWT), templates `{{variable}}` maison

::: tip Note d'architecture
Le hub est conçu pour vivre **dans** l'infrastructure Supabase partagée de la
suite Quatools (schéma `notifications` aux côtés des autres apps, `auth.users`
commun). Il n'est pas pensé comme un binaire isolé « clone & run » : les
applications qui l'émettent partagent la même base d'identité. Le code reste
néanmoins entièrement auditable et réutilisable.
:::
