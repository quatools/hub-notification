# POST /api/notifications/register

Déclare (ou met à jour) les événements qu'une application sait émettre.
C'est un **upsert** par `slug` : ré-appeler avec un slug existant met
l'événement à jour.

::: tip Aucune migration, aucun déploiement du hub
Déclarer ou modifier des événements **et leurs variables** se fait **uniquement**
par cet appel `/register` — **jamais** par une migration SQL ou un déploiement
côté hub. Le `payload_schema` est un champ JSON souple et **purement documentaire** :
émettre une nouvelle variable la rend telle quelle (aucune validation), et la
re-déclarer ici la fait simplement apparaître à l'admin dans l'éditeur de message.
Les migrations SQL du dépôt ne concernent **que la structure interne du hub**,
jamais vos événements ou vos variables.
:::

## Quand l'appeler

- au démarrage de l'application, ou via un script de seed ;
- à chaque ajout ou modification d'événement.

## Requête

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

## Champs d'un événement

| Champ | Type | Requis | Description |
|---|---|---|---|
| `slug` | string | ✅ | Identifiant unique `app.categorie.action`. |
| `label` | string | ✅ | Nom affiché dans l'UI admin. |
| `description` | string | — | Description détaillée. |
| `category` | string | ✅ | Regroupement (`billing`, `member`, `team`, `system`). |
| `supported_channels` | string[] | ✅ | `email`, `discord_webhook`, `discord_dm`. |
| `audiences` | string[] | ✅ | `admin`, `member`. Voir [Audiences](/concepts/audiences). |
| `default_active` | boolean | — | Défaut `false`. |
| `payload_schema` | object | — | Variables `{ "clé": "type" }` (documentaire). |

## Réponse `200`

```json
{
  "registered": 1,
  "updated": 0,
  "new": 1
}
```

| Champ | Description |
|---|---|
| `registered` | Nombre total d'événements traités. |
| `new` | Nombre de nouveaux événements créés. |
| `updated` | Nombre d'événements mis à jour. |

## Erreurs

| Code | Cause |
|---|---|
| `401` | Clé API invalide ou manquante. |
| `400` | Body invalide (`app` ou `events` manquant). |

::: tip Voir aussi
[Concept : Événements](/concepts/events) pour la convention de nommage et le
rôle exact du `payload_schema`.
:::
