# Rattachement de compte (`/api/link`)

Le rattachement relie une **fiche destinataire** (créée par vos `emit`) au
**compte hub** du membre quand il se connecte. Cela transforme une fiche
flottante en préférences que le membre possède et contrôle.

Concept détaillé : [Destinataires & identités](/concepts/recipients-identity).

## Le flux

```text
1. Dans votre app, le membre clique « Gérer mes notifications ».
2. L'app génère un jeton signé et redirige vers :
      https://hub.quatools.fr/api/link?token=<JETON>
3. Le hub vérifie le jeton. Si pas de session hub → login (Discord OAuth),
   puis reprise du flux.
4. claimAppIdentity() ancre la personne à auth.users et fusionne toute fiche
   flottante portant la même identité clé.
5. Redirection vers /preferences?linked=1.
```

## Le jeton de rattachement

Le jeton est signé en **HMAC-SHA256** avec le **secret de signature de l'app**,
et porte une **courte durée de validité** (≈ 2 min) pour éviter le rejeu et
l'usurpation d'identité.

Le secret de signature dépend du type d'app :
- **app self-service** (créée dans l'espace développeur) : le **`signing_secret`**
  dédié, affiché dans l'encart d'intégration (distinct de la clé API) ;
- **app historique** (clé en environnement) : la **clé API** fait office de secret.

Charge utile typique :

| Champ | Description |
|---|---|
| `app` | **Slug** de l'app émettrice (ex. `baas-esport`) — **pas** le nom affiché ni l'UUID de l'URL `/developer/<uuid>`. |
| `app_user_id` | Id du membre côté app. |
| `org_id` | Organisation concernée. |
| `discord_id`, `email`, `name` | Coordonnées connues (optionnelles). |
| `exp` | Expiration courte. |

::: warning Quel secret pour signer ?
Signez avec le **`signing_secret`** de votre app self-service (**pas** la clé API,
qui sert au `Bearer` d'`emit`). Pour une app historique (clé en environnement),
c'est la clé API qui fait office de secret. Toujours **côté serveur**, jamais
côté client.
:::

### Forger le jeton (Node.js)

Le jeton est `base64url(payload).base64url(hmac)` :

```typescript
import { createHmac } from 'crypto'

/** secret = NOTIFICATION_SIGNING_SECRET (app self-service). */
function mintLinkToken(payload: Record<string, unknown>, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

// Rattachement membre — rediriger l'utilisateur vers le lien obtenu.
const token = mintLinkToken(
  {
    app: 'storm',
    app_user_id: 'membre-123',
    org_id: '<org_id>',
    email: 'jean@example.com',
    exp: Math.floor(Date.now() / 1000) + 120, // 2 min
  },
  process.env.NOTIFICATION_SIGNING_SECRET!,
)
// → https://hub.quatools.fr/api/link?token=${token}
```

Pour un **lien admin**, ajoutez `scope: "admin"` au payload et redirigez vers
`/api/link-admin` (voir ci-dessous).

## Paramètres de la requête

| Paramètre | Description |
|---|---|
| `token` | Le jeton signé. **Requis.** |

## Comportement

- **Jeton valide + session présente** → fiche réclamée/fusionnée, redirection
  vers `/preferences`.
- **Jeton valide + pas de session** → redirection vers le login avec `next`
  préservé, puis reprise.
- **Jeton invalide ou expiré** → erreur, aucune fiche modifiée.

## Lien admin (octroi de droits)

Le même mécanisme de jeton sert à **donner les droits d'administration** d'une
organisation hub (créée via [`/orgs`](/api/orgs)) à un utilisateur — utile pour
les applications tierces dont les organisations ne sont pas des clubs esport.

::: tip C'est ainsi qu'on obtient le tout PREMIER admin
Pas de poule-et-œuf : aucun admin n'existe encore, et c'est normal. Votre app
**forge elle-même** ce lien avec son **secret de signature** (qui fait autorité) ;
le **premier** à l'ouvrir devient **owner**. Vous n'avez besoin d'**aucun accès
préalable** au hub — le secret suffit.
:::

Le jeton porte alors `scope: "admin"` et l'`org_id` ciblé :

| Champ | Description |
|---|---|
| `app` | **Slug** de l'app (doit **posséder** l'org). |
| `app_user_id` | Id de l'admin côté app. |
| `scope` | `"admin"`. |
| `org_id` | L'organisation à administrer. |
| `name`, `email`, `discord_id` | Optionnels. |
| `exp` | Expiration courte. |

L'app redirige l'admin qu'elle vouche vers :

```text
https://hub.quatools.fr/api/link-admin?token=<JETON>
```

Le hub vérifie la signature, **que l'org appartient bien à l'app** qui signe
(anti-usurpation inter-app), exige une session hub (login si besoin), puis
enregistre l'utilisateur comme **admin de l'org**. Redirection vers
`/admin?org=<org_id>`, où il configure canaux et workflows comme pour un club.

::: tip Idempotent
Ré-ouvrir le lien ne crée pas de doublon : l'utilisateur reste simplement admin.
:::

::: info Rôles & équipe
Le **premier** admin à réclamer une org en devient **propriétaire** (`owner`) ;
les suivants sont **`admin`**. Le propriétaire peut ensuite **inviter, promouvoir
ou retirer** des membres depuis le hub (page **Équipe**) — vous n'avez rien à
implémenter côté app pour ça. Ces droits sont **propres au hub** (gérer les
notifications), distincts des droits de votre propre plateforme.
:::

## Page de rattachement (à venir)

Une **landing de rattachement** pédagogique en marque blanche est prévue pour
remplacer le login générique lorsqu'on arrive via un deep-link partenaire :
elle expliquera au membre que son partenaire s'associe au hub pour lui offrir la
**maîtrise de ses notifications** (« Vos notifications, votre vie, vos choix »).
