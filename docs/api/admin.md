# API Admin

Les routes `/api/admin/*` pilotent la configuration d'une organisation : canaux,
workflows, logs et identité d'expéditeur. Elles sont consommées par l'**UI
admin** du hub et par le **serveur MCP** ; vos applications n'ont normalement
pas à les appeler directement.

::: info Authentification
Session Supabase (cookie) **+** rôle admin actif de l'organisation. Toutes les
routes prennent `org_id` (query ou body) et renvoient `403` si l'utilisateur
n'est pas admin de cette org. Pour piloter ces actions en langage naturel, voir
[Configuration par l'IA (MCP)](/guides/mcp).
:::

## Événements

| Méthode & route | Rôle |
|---|---|
| `GET /api/admin/events?org_id=…` | Catalogue des événements actifs (avec nb. de workflows). |

## Canaux

| Méthode & route | Rôle |
|---|---|
| `GET /api/admin/channels?org_id=…` | Liste les canaux de l'org. |
| `POST /api/admin/channels` | Crée un canal (webhook, DM, email). |
| `PATCH /api/admin/channels/{id}` | Modifie label, destination, activation. |
| `DELETE /api/admin/channels/{id}` | Supprime (cascade sur les workflows). |

## Workflows

| Méthode & route | Rôle |
|---|---|
| `GET /api/admin/workflows?org_id=…` | Workflows groupés par événement. |
| `POST /api/admin/workflows` | Crée une route (événement + canal + message). |
| `PATCH /api/admin/workflows/{id}` | Modifie message (sujet/corps/format) ou activation. |
| `DELETE /api/admin/workflows/{id}` | Supprime la route. |
| `POST /api/admin/workflows/{id}/test` | Envoie un test (données d'exemple, `is_test = true`). |

## Logs

| Méthode & route | Rôle |
|---|---|
| `GET /api/admin/logs?org_id=…&status=…&limit=…` | Historique des exécutions (sent/failed, erreur, contenu). |

## Identité d'expéditeur (marque blanche)

| Méthode & route | Rôle |
|---|---|
| `GET /api/admin/settings?org_id=…` | Identité d'expéditeur et statut du domaine. |
| `PATCH /api/admin/settings` | Définit nom d'expéditeur et adresse de réponse. |
| `POST /api/admin/settings/domain` | Configure / vérifie un domaine d'envoi (SPF/DKIM/DMARC). |

Voir [Email & marque blanche](/guides/channels-email) pour le détail du domaine
d'envoi.
