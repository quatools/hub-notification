# Démarrage rapide

Ce guide intègre une application au hub en trois étapes : **déclarer** ses
événements, les **émettre**, et laisser un admin **configurer** un workflow
pour qu'ils soient réellement envoyés.

::: info Prérequis
- Une **clé API** fournie par le hub (entrée dans `NOTIFICATION_API_KEYS`).
- L'**`org_id`** (UUID de l'organisation) au nom de laquelle vous émettez.
- L'**URL de base** du hub (ex. `https://hub.quatools.fr`).
:::

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
  "app": "baas-esport",
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

## 2. Configurer un workflow (côté admin)

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

## 3. Émettre l'événement

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

## 4. Helper TypeScript prêt à l'emploi

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
