# Démarrage rapide

Ce guide intègre une application au hub en trois étapes : **déclarer** ses
événements, les **émettre**, et laisser un admin **configurer** un workflow
pour qu'ils soient réellement envoyés.

## Étape 1 — Récupérez votre clé d'intégration

Tout commence par la création de votre **application** dans le hub :

1. Connectez-vous au hub (**[hub.quatools.fr](https://hub.quatools.fr)**) — Discord, Google ou GitHub.
2. Cliquez sur **votre avatar** (en haut à droite) → **Espace développeur**.
3. **Nouvelle application** → un nom et un identifiant (ex. `storm`).
4. **Générez une clé** → copiez-la (elle n'est affichée **qu'une seule fois**), ainsi que le **secret de signature**.

Vous obtenez les variables à placer dans l'environnement de votre application :

```text
NOTIFICATION_HUB_URL=https://hub.quatools.fr
NOTIFICATION_API_KEY=<votre clé>
NOTIFICATION_SIGNING_SECRET=<votre secret de signature>
```

::: info Mode essai
Une application démarre en **essai** (un petit nombre d'envois, suffisant pour valider
l'intégration). Une fois votre intégration prête, l'opérateur la passe en « actif »
après une revue rapide de ce qu'elle envoie.
:::

## Déclarer son organisation

Une **organisation** est l'un de vos espaces (un club, une équipe, un tenant…) :
elle porte ses propres destinataires et sa configuration (canaux, workflows).
Déclarez chacune pour obtenir son `org_id` :

```http
POST /api/notifications/orgs
Authorization: Bearer <API_KEY>
Content-Type: application/json

{ "external_id": "votre-id-interne", "name": "Nom de l'organisation" }
```

Réponse : `{ "org_id": "…", "created": true }`. Stockez l'`org_id` (idempotent
par `external_id`), il sert pour tout le reste — `emit`, workflows, droits admin.
Créer l'org **ne donne de droits à personne** : à l'**étape 2** ci-dessous, vous
générez vous-même votre **premier lien admin** pour en devenir propriétaire.
Détails : [`/orgs`](/api/orgs).

## 1. Déclarer ses événements

Au démarrage de votre app (ou via un script de seed), déclarez les événements
que vous savez émettre. C'est un *upsert* : ré-appeler avec le même `slug` met
l'événement à jour.

```http
POST /api/notifications/register
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

```json
{
  "events": [
    {
      "slug": "baas.subscription.created",
      "label": "Nouvel abonnement",
      "description": "Un membre vient de souscrire à un abonnement",
      "category": "billing",
      "supported_channels": ["email", "discord_webhook", "discord_dm"],
      "audiences": ["admin", "member"],
      "default_active": true,
      "payload_schema": {
        "member_name": "string",
        "plan_name": "string",
        "amount": "number",
        "club_name": "string"
      }
    }
  ]
}
```

Détail des champs : voir [POST /register](/api/register).

## 2. Devenez admin de votre organisation

Créer l'org ne donne de droits à personne. Pour la configurer (canaux, workflows)
dans `/admin`, il faut être **admin** — et **c'est vous qui générez le lien**, la
première fois comme les suivantes.

::: tip Pas de poule-et-œuf : vous forgez le lien vous-même
Aucun admin préalable n'est requis. Votre app **signe elle-même** un jeton avec
son **secret de signature** (`NOTIFICATION_SIGNING_SECRET`) — le secret **fait
autorité**. Le **premier** à ouvrir le lien devient **propriétaire** (`owner`) de
l'org ; les suivants sont `admin`.
:::

```typescript
import { createHmac } from 'crypto'

function mintLinkToken(payload: Record<string, unknown>, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

const token = mintLinkToken(
  {
    app: 'votre-slug',        // le SLUG de votre app (qui possède l'org)
    app_user_id: 'votre-id',  // votre identifiant côté app
    scope: 'admin',
    org_id: '<org_id>',       // renvoyé par /orgs
    email: 'vous@exemple.fr',
    exp: Math.floor(Date.now() / 1000) + 120, // expiration courte (2 min)
  },
  process.env.NOTIFICATION_SIGNING_SECRET!,
)

// Ouvrez ce lien dans un navigateur (connecté au hub) → vous devenez owner/admin :
//   `${process.env.NOTIFICATION_HUB_URL}/api/link-admin?token=${token}`
```

Ensuite, depuis le hub (page **Équipe**), l'owner invite/promeut les autres
admins — rien à coder de plus. Détails et rôles :
[Lien admin](/api/link#lien-admin-octroi-de-droits).

## 3. Configurer un workflow (côté admin)

::: warning Sans workflow, rien n'est envoyé
Tant qu'aucun **workflow actif** n'existe pour l'événement et l'organisation,
`emit` répondra `dispatched: 0`. Un admin doit d'abord :

1. créer au moins un **canal** (webhook Discord, email, DM Discord) ;
2. créer un **workflow** reliant l'événement au canal, avec un message.
:::

Deux façons de configurer :

- **Interface admin** : `/admin?org_id=<org_id>` → *Canaux* puis *Workflows*.
- **En langage naturel** via le serveur MCP — voir [Configuration par l'IA](/guides/mcp).

Le message utilise une syntaxe `{{variable}}` remplie depuis le payload :

```text
Sujet : Bienvenue {{member_name}} 🎉
Corps : Ton abonnement {{plan_name}} ({{amount}} €) chez {{club_name}}
        est actif. Bienvenue dans l'équipe !
```

## 4. Émettre l'événement

Quand l'événement se produit dans votre app, appelez `emit`. Fournissez le
**descripteur du destinataire concerné** dans `recipients` : c'est ce qui permet
au hub de livrer « au membre concerné » et de rattacher la notification à sa
fiche.

```http
POST /api/notifications/emit
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

```json
{
  "event": "baas.subscription.created",
  "org_id": "uuid-de-l-organisation",
  "recipients": [
    {
      "app_user_id": "membre-123",
      "email": "jean@example.com",
      "discord_id": "123456789012345678",
      "name": "Jean Dupont"
    }
  ],
  "payload": {
    "member_name": "Jean Dupont",
    "plan_name": "Premium",
    "amount": 29.99,
    "club_name": "Team Esport Lyon"
  }
}
```

Réponse :

```json
{
  "dispatched": 2,
  "channels": ["discord_dm", "email"],
  "execution_ids": ["uuid-exec-1", "uuid-exec-2"]
}
```

::: tip La réponse part immédiatement
`emit` crée les exécutions puis répond **sans attendre** l'envoi réel
(SMTP/Discord peuvent être lents). Le dispatch se termine en arrière-plan.
N'attendez donc pas un statut « envoyé » dans la réponse — consultez
l'historique ou les logs pour cela.
:::

## 5. Helper TypeScript prêt à l'emploi

```typescript
const HUB_URL = process.env.NOTIFICATION_HUB_URL ?? 'https://hub.quatools.fr'
const API_KEY = process.env.NOTIFICATION_API_KEY!

interface RecipientDescriptor {
  app_user_id?: string
  email?: string
  discord_id?: string
  name?: string
}

export async function emitNotification(
  event: string,
  orgId: string,
  payload: Record<string, unknown>,
  recipients?: RecipientDescriptor[],
) {
  const res = await fetch(`${HUB_URL}/api/notifications/emit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ event, org_id: orgId, payload, recipients }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`emit ${event} → ${res.status}`)
  return res.json()
}
```

::: danger Ne jamais bloquer le flux principal
Une notification ne doit jamais faire échouer une transaction métier.
Encapsulez toujours l'appel dans un `try/catch` qui logge sans propager :

```typescript
try {
  await emitNotification('baas.subscription.created', orgId, payload, [recipient])
} catch (e) {
  console.error('[Notification] emit échoué (non bloquant):', e)
}
```
:::

## Étapes suivantes

- [Référence API complète](/api/overview)
- [Comprendre les destinataires et le rattachement de compte](/concepts/recipients-identity)
- [Configurer la marque blanche email](/guides/channels-email)
