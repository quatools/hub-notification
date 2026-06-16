# POST /api/notifications/emit

Émet un événement. Le hub résout les workflows actifs, identifie les
destinataires, applique les opt-out, rend les templates et dispatche sur chaque
canal.

::: tip Réponse immédiate, envoi en arrière-plan
`emit` crée les exécutions puis **répond sans attendre** l'envoi réel
(SMTP/Discord peuvent être lents et faire expirer votre `fetch`). Le dispatch se
termine après la réponse HTTP. Le champ `dispatched` compte les exécutions
**créées**, pas les envois confirmés — consultez l'[historique](/api/user) ou
les logs admin pour le statut final.
:::

## Requête

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

## Champs

| Champ | Type | Requis | Description |
|---|---|---|---|
| `event` | string | ✅ | Slug de l'événement (doit être enregistré et actif). |
| `org_id` | string | ✅ | UUID de l'organisation. |
| `payload` | object | ✅ | Données de l'événement, injectées dans les templates `{{variable}}`. |
| `recipients` | object[] | — | Descripteurs des destinataires concernés (voir ci-dessous). Requis pour livrer « au membre concerné ». |
| `target_users` | string[] | — | *Legacy* : ids `auth.users` ciblés. Conservé pour rétrocompatibilité ; préférez `recipients`. |

### Descripteur de destinataire (`recipients[]`)

| Champ | Type | Description |
|---|---|---|
| `app_user_id` | string | Id du membre côté app (clé d'identité). |
| `email` | string | Email du membre (indice). |
| `discord_id` | string | Snowflake Discord du membre (clé d'identité). |
| `name` | string | Nom affiché. |

Le hub enregistre ces coordonnées sur une **fiche destinataire canonique**,
rattachable ensuite au compte du membre. Voir
[Destinataires & identités](/concepts/recipients-identity).

## Réponse `200`

```json
{
  "dispatched": 2,
  "channels": ["discord_dm", "email"],
  "execution_ids": ["uuid-exec-1", "uuid-exec-2"]
}
```

| Champ | Description |
|---|---|
| `dispatched` | Nombre d'exécutions créées (≈ envois lancés). |
| `channels` | Types de canaux concernés. |
| `execution_ids` | Ids des exécutions, pour le suivi/debug. |

Si aucun workflow actif n'existe pour l'événement/org, `dispatched` vaut `0`
(et la réponse reste `200`).

## Comportements importants

### Canal « membre concerné » sans destinataire → échec explicite

Si un workflow utilise un canal `recipient: "member"` mais que l'`emit` ne
fournit **aucun** `recipients`, le hub **ne retombe pas** sur l'admin :
l'exécution est créée puis marquée `failed` avec un message clair. Corrigez
votre `emit` en ajoutant le descripteur. Voir [Canaux](/concepts/channels).

### Opt-out par destinataire

Avant l'envoi, le hub écarte les livraisons « membre » pour lesquelles le
destinataire a posé un opt-out sur ce workflow. Les diffusions d'org (webhook)
ne sont pas concernées.

## Erreurs

| Code | Cause |
|---|---|
| `401` | Clé API invalide ou manquante. |
| `400` | `event`, `org_id` ou `payload` manquant/invalide. |
| `404` | Événement inconnu, inactif ou déprécié. |
| `500` | Erreur interne. |
