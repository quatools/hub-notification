# Déclarer une organisation (`/api/notifications/orgs`)

Par défaut, le hub emprunte la notion d'« organisation » au BAAS esport (les
clubs). Une **application tierce** dont les organisations ne sont **pas** des
clubs déclare ses propres organisations via cet endpoint : le hub crée une
organisation **qu'il possède** et renvoie son `org_id` (UUID), que l'app utilise
ensuite dans ses [`emit`](/api/emit).

::: info Quand l'utiliser
- **Vous êtes le BAAS esport** (ou partagez ses clubs) → inutile : votre `org_id`
  est l'id du club existant.
- **Vous êtes une app tierce** (ex. Storm) avec vos propres organisations →
  déclarez-les ici pour obtenir un `org_id` hub.
:::

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
