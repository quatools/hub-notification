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
| `app` | Nom de l'app émettrice (préfixe d'identité). |
| `app_user_id` | Id du membre côté app. |
| `org_id` | Organisation concernée. |
| `discord_id`, `email`, `name` | Coordonnées connues (optionnelles). |
| `exp` | Expiration courte. |

::: tip Génération côté app
Générez le jeton **côté serveur** de votre app (jamais côté client), avec la
même clé API que celle utilisée pour `emit`. Le hub recalcule la signature avec
cette clé pour authentifier la demande.
:::

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

Le jeton porte alors `scope: "admin"` et l'`org_id` ciblé :

| Champ | Description |
|---|---|
| `app` | Nom de l'app (doit **posséder** l'org). |
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

## Page de rattachement (à venir)

Une **landing de rattachement** pédagogique en marque blanche est prévue pour
remplacer le login générique lorsqu'on arrive via un deep-link partenaire :
elle expliquera au membre que son partenaire s'associe au hub pour lui offrir la
**maîtrise de ses notifications** (« Vos notifications, votre vie, vos choix »).
