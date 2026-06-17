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

Le jeton est signé en **HMAC-SHA256** avec la **clé API de l'app** comme secret,
et porte une **courte durée de validité** (≈ 2 min) pour éviter le rejeu et
l'usurpation d'identité.

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

## Page de rattachement (à venir)

Une **landing de rattachement** pédagogique en marque blanche est prévue pour
remplacer le login générique lorsqu'on arrive via un deep-link partenaire :
elle expliquera au membre que son partenaire s'associe au hub pour lui offrir la
**maîtrise de ses notifications** (« Vos notifications, votre vie, vos choix »).
