# Modèle de données

Tout vit dans le schéma PostgreSQL **`notifications`** (Supabase), aux côtés de
`auth.users` (partagé avec les applications). RLS activé sur toutes les tables.

## Schéma relationnel

```text
auth.users
   │
   ├──< channels (user_id)            canaux perso/org
   ├──< workflows (created_by)        créateur du workflow
   ├──< user_optouts (user_id)        opt-out (legacy)
   └──1 recipients (auth_user_id)     fiche réclamée (1:1)

events ──< workflows ──< workflow_steps          (event → route → message)
              │   │
              │   └──< workflow_executions        (trace des envois)
              └──> channels (channel_id)          (destination de la route)

recipients ──< recipient_identities              (graphe d'identité)
     │       ──< user_optouts (recipient_id)      (opt-out par destinataire)
     │       ──< workflow_executions (recipient_id)
     └──< channels (recipient_id)                 (transitionnel)

org_settings (org_id)                              (marque blanche)
```

## Les tables

### Routage

| Table | Rôle | Colonnes clés |
|---|---|---|
| `events` | Catalogue déclaré par les apps | `app`, `slug` (unique), `category`, `supported_channels[]`, `audiences[]`, `payload_schema`, `is_active`, `deprecated_at` |
| `channels` | Destinations | `user_id`, `org_id` (null = perso), `type`, `config` (jsonb), `is_verified`, `is_active`, `recipient_id` |
| `workflows` | Routes (event + canal) par org | `org_id`, `event_id`, `channel_id`, `is_active`, `created_by` |
| `workflow_steps` | Message d'une route | `workflow_id`, `step_order`, `step_type`, `subject`, `body`, `format` |
| `workflow_executions` | Trace de chaque envoi | `event_slug`, `channel_id`, `user_id`, `recipient_id`, `org_id`, `status`, `payload`, `rendered_content`, `destination`, `error_message`, `is_test`, `sent_at` |

### Destinataires & identités (CDC v2)

| Table | Rôle | Colonnes clés |
|---|---|---|
| `recipients` | Personne canonique | `auth_user_id` (unique, nullable), `is_claimed`, `display_name`, `locale` |
| `recipient_identities` | Coordonnées d'une personne | `recipient_id`, `kind` (`app`/`discord`/`email`/`phone`), `app`, `value`, `is_key` |

::: tip Unicité des identités clés uniquement
Seules les identités **clés** (`is_key = true` : `app`, `discord`) ont une
contrainte d'unicité globale (`(kind, app, value) WHERE is_key`). Les emails et
téléphones (`is_key = false`) peuvent être partagés — ce sont des indices, pas
des clés de fusion. Voir [Destinataires & identités](/concepts/recipients-identity).
:::

### Préférences & marque blanche

| Table | Rôle | Colonnes clés |
|---|---|---|
| `user_optouts` | Refus d'un workflow | `user_id` (legacy), `recipient_id` (CDC v2), `workflow_id` |
| `org_settings` | Identité d'expéditeur par org | `org_id` (PK), `sender_name`, `reply_to`, `sender_domain`, `sender_local_part`, `domain_status`, `domain_dns_records` |

### Organisations & droits (hub)

| Table | Rôle | Colonnes clés |
|---|---|---|
| `organizations` | Organisations **possédées par le hub** (apps tierces) | `id` (= l'`org_id`), `app`, `external_id`, `name`, `slug`, `source` ; unique `(app, external_id)` |
| `org_admins` | Droits d'admin sur une org hub | `org_id`, `auth_user_id`, `role` ; unique `(org_id, auth_user_id)` |

::: info Union avec le BAAS, sans migration
Les droits et noms d'organisation sont résolus en **union** de deux sources :
les clubs du BAAS (`public.clubs` / `public.club_admins`) **et** ces tables hub.
Aucune donnée BAAS n'est déplacée : une app comme Storm a ses propres
organisations sans toucher au BAAS. Les `org_id` sont des UUID → aucune collision
entre les deux sources. Voir [`/orgs`](/api/orgs) et le
[lien admin](/api/link#lien-admin-octroi-de-droits).
:::

## Fonctions notables

| Fonction | Rôle |
|---|---|
| `discord_id_for_user(uuid)` | Résout le snowflake Discord depuis `auth.identities` (SECURITY DEFINER). |
| `merge_recipients(keep, drop)` | Fusionne deux fiches sans perte (identités, canaux, opt-out, exécutions). |
| `set_updated_at()` | Trigger d'horodatage sur toutes les tables. |

## RLS & accès en bref

Depuis le durcissement (migration `013`), **aucun rôle `anon`/`authenticated`
n'a d'accès direct** aux tables du schéma `notifications` : tout passe par le
**service role**, côté serveur, via les routes `/api/*`. Le client navigateur ne
sert qu'à l'**authentification** (schéma `auth`). Les policies RLS subsistent en
défense en profondeur. Les tables `organizations` et `org_admins` suivent la
même règle : service role uniquement.

::: tip Invariant
Le front n'accède **jamais** aux tables `notifications` en direct. Verrouiller
ces tables est donc sans impact fonctionnel — et coupe tout accès inter-tenant.
:::

## Migrations

Les migrations vivent dans `supabase/migrations/` (de `001` à `015`) : schéma
initial, seeds d'exemple, identité d'expéditeur, support DM Discord, résolveur
Discord, recipients/identités (CDC v2), fusion, destination d'exécution,
préférences membre, désabonnement, **durcissement RLS (`013`)** et
**organisations propres au hub (`015`)**.

::: warning Seeds d'exemple
Les migrations `002`/`003` *seedent* des événements `baas.*` (esport) à titre
d'exemple. Dans un autre contexte, déclarez vos propres événements via
[`/register`](/api/register) plutôt que de réutiliser ces seeds.
:::
