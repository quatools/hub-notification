# Destinataires & identités

C'est la couche qui donne au **membre** une existence propre dans le hub,
indépendante de l'app qui a déclenché l'événement. Elle répond à trois besoins
que `auth.users` seul ne couvre pas :

1. notifier quelqu'un **avant** qu'il ait un compte sur le hub ;
2. reconnaître que **la même personne** existe dans **plusieurs apps** ;
3. permettre au membre de **posséder** ses préférences (refuser, rediriger).

## Deux objets

### La fiche destinataire (`recipient`)

Une **personne canonique**. Elle peut exister sans compte (fiche *flottante*)
puis être *réclamée* quand la personne se connecte au hub.

| Champ | Rôle |
|---|---|
| `id` | Identifiant canonique de la personne. |
| `auth_user_id` | Lien vers le compte hub (`auth.users`), ou `null` si flottante. |
| `is_claimed` | `true` une fois la fiche rattachée à un compte. |
| `display_name`, `locale` | Affichage. |

### Le graphe d'identité (`recipient_identity`)

Les **coordonnées** rattachées à une personne. Chaque identité a un `kind` :

| `kind` | Exemple de valeur | Clé de fusion ? |
|---|---|---|
| `app` | `baas-esport` + `membre-123` | ✅ oui (`is_key = true`) |
| `discord` | `123456789012345678` | ✅ oui |
| `email` | `jean@example.com` | ❌ non — **indice** |
| `phone` | `+33…` | ❌ non — indice |

::: tip L'email est un indice, jamais une clé
Plusieurs personnes peuvent partager une adresse (famille, alias générique). Le
hub **n'utilise jamais l'email pour fusionner** deux fiches. Seules les
identités *clés* (`app:external_id`, `discord`) sont uniques globalement et
servent à reconnaître une personne. Ce choix évite les fusions abusives.
:::

## Comment une fiche naît : la résolution

À chaque `emit`, le hub résout chaque descripteur du tableau `recipients` :

```json
{ "app_user_id": "membre-123", "email": "jean@x.fr", "discord_id": "1234…", "name": "Jean" }
```

- s'il existe déjà une personne avec l'identité clé `baas-esport:membre-123`
  (ou ce `discord_id`), elle est **réutilisée** ;
- sinon, une **fiche flottante** est créée et les identités y sont attachées
  (app & Discord en clés, email en indice).

Aucun envoi n'a lieu pendant la résolution : on ne fait qu'identifier/rattacher.

## Le rattachement de compte (account linking)

Quand le membre se connecte au hub depuis votre app, sa fiche flottante est
**fusionnée** dans son compte hub :

```text
1. Dans votre app, le membre clique « Gérer mes notifications ».
2. L'app le redirige vers  /api/link?token=…  (jeton signé HMAC, courte durée).
3. Le hub vérifie le jeton, exige une session (login si besoin).
4. claimAppIdentity() : la personne est ancrée à auth.users ; toute fiche
   flottante portant la même identité clé est fusionnée (merge_recipients).
5. Redirection vers /preferences — le membre voit et gère ses notifications.
```

La fusion déplace **sans perte** les identités, canaux, opt-out et historique de
la fiche absorbée vers la fiche canonique.

Voir [Souveraineté du membre](/guides/member-sovereignty) pour l'expérience
côté membre, et [Rattachement (/link)](/api/link) pour le contrat technique du
jeton.

## Pourquoi ce modèle (héritage DataWallet)

Ce graphe d'identité « personnes canoniques + identités, email-indice » est
inspiré du modèle DataWallet de Quatools. Son intérêt :

- **multi-app** : Storm, BAAS, Facturation… pointent vers la même personne ;
- **sans friction** : un membre reçoit ses notifications dès le premier
  événement, même sans compte ;
- **souverain** : une fois rattaché, le membre maîtrise ses préférences sur
  toutes les apps à la fois.
