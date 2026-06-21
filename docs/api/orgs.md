# Déclarer une organisation (`/api/notifications/orgs`)

Une **organisation** est l'espace auquel se rattachent vos destinataires et votre
configuration (canaux, workflows) — un club, une équipe, un tenant… Déclarez
chacune des vôtres via cet endpoint : le hub crée une organisation **qu'il
possède** et renvoie son `org_id` (UUID), que vous utilisez ensuite dans vos
[`emit`](/api/emit). C'est **idempotent** par `external_id` (voir [plus bas](#idempotence)).

## Requête

```http
POST /api/notifications/orgs
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

```json
{
  "external_id": "votre-id-interne",
  "name": "Nom affiché de l'organisation",
  "slug": "slug-optionnel"
}
```

| Champ | Requis | Description |
|---|---|---|
| `name` | ✅ | Nom affiché (UTF-8). |
| `external_id` | — | Votre identifiant interne. **Recommandé** : rend l'appel idempotent. |
| `slug` | — | Slug d'affichage optionnel. |

## Réponse

```json
{ "org_id": "8f3c…-uuid", "created": true }
```

| Champ | Description |
|---|---|
| `org_id` | **L'UUID à utiliser dans vos `emit`.** Stockez-le côté app. |
| `created` | `true` si créée, `false` si elle existait déjà (mise à jour du nom/slug). |

## Idempotence

Avec `external_id`, ré-appeler l'endpoint **met à jour** le nom/slug sans créer
de doublon et renvoie le **même `org_id`** (`created: false`). Vous pouvez donc
appeler `/orgs` à chaque démarrage de votre app sans risque.

::: warning Cloisonnement par app
Une organisation appartient à l'**app de la clé API** (jamais au body). Une app
ne peut ni voir ni modifier les organisations d'une autre.
:::

## Et ensuite ? Donner accès à un administrateur

Créer l'organisation ne donne de droits à personne. Pour qu'un humain puisse la
configurer (canaux, workflows) dans `/admin`, l'app le **vouche** via un
[lien admin](/api/link#lien-admin-octroi-de-droits).

## Parcours complet d'une app tierce

1. [`/register`](/api/register) — déclarer ses événements.
2. **`/orgs`** — déclarer une organisation → obtenir `org_id`.
3. [Lien admin](/api/link#lien-admin-octroi-de-droits) — donner les droits à un admin humain.
4. [`/emit`](/api/emit) — émettre avec cet `org_id`.
