# Événements

Un **événement** décrit un *type* de notification qu'une application sait
produire — par exemple « un membre a souscrit un abonnement ». Il ne contient
aucune donnée concrète : c'est un contrat (slug, libellé, canaux supportés,
variables attendues). Les données concrètes arrivent au moment de l'`emit`,
dans le `payload`.

## Anatomie d'un événement

| Champ | Type | Requis | Description |
|---|---|---|---|
| `slug` | string | ✅ | Identifiant unique, format `app.categorie.action`. |
| `label` | string | ✅ | Nom affiché dans l'UI admin. |
| `description` | string | — | Description sous le libellé. |
| `category` | string | ✅ | Regroupement UI : `billing`, `member`, `team`, `system`… |
| `supported_channels` | string[] | ✅ | Canaux possibles : `email`, `discord_webhook`, `discord_dm`. |
| `audiences` | string[] | ✅ | Qui peut recevoir : `admin`, `member`. Voir [Audiences](/concepts/audiences). |
| `default_active` | boolean | — | Défaut `false`. |
| `payload_schema` | object | — | Variables disponibles (`{ "clé": "type" }`), affichées à l'admin dans l'éditeur de message. |

## Convention de nommage des slugs

```text
<app>.<category>.<action>

baas.subscription.created
baas.payment.failed
cours.session.reminder
facturation.invoice.generated
```

Un slug est **global** au hub et **unique**. Le préfixe d'app évite les
collisions entre applications.

## Catégories

| Catégorie | Usage |
|---|---|
| `billing` | Abonnements, paiements, factures |
| `member` | Inscriptions, profils, départs |
| `team` | Assignations, composition d'équipe |
| `system` | Alertes techniques, maintenance |

Les catégories sont libres : elles servent au regroupement visuel et à la
couleur des embeds Discord.

## Le `payload_schema` n'est pas une validation

Le `payload_schema` est **documentaire** : il indique à l'admin quelles
variables `{{…}}` il peut utiliser dans ses messages. Le hub ne rejette pas un
`emit` dont le payload diffère du schéma — une variable absente est simplement
rendue vide. Gardez donc le schéma à jour pour l'expérience admin, mais
considérez le payload réel comme la source de vérité.

## Cycle de vie

- **Enregistrement** : `POST /register` (upsert par `slug`).
- **Dépréciation** : un événement avec `deprecated_at` non nul ou `is_active = false`
  est rejeté à l'`emit` (404).

Voir [POST /register](/api/register) pour le détail de l'appel.
