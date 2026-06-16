# Audiences

L'**audience** d'un événement répond à la question : *à qui cette notification
est-elle légitimement destinée ?* Elle est déclarée à l'enregistrement
(`audiences: ["admin", "member"]`) et conditionne deux choses : ce qu'un membre
peut voir/refuser, et le sens d'un canal « membre concerné ».

## Les deux audiences

| Audience | Signification |
|---|---|
| `admin` | Destinée aux gestionnaires de l'organisation (ex. « un paiement a échoué », « équipe au complet »). |
| `member` | Destinée à la personne concernée par l'événement (ex. « ton abonnement est actif », « ta place est confirmée »). |

Un événement peut avoir **les deux** : le même fait (`subscription.created`)
peut notifier l'admin *et* le membre, via deux workflows distincts.

## Conséquences concrètes

### Côté membre : opt-out

Un membre ne voit, dans son espace de préférences, que les workflows dont
l'événement inclut l'audience **`member`**. Ce sont les seules notifications
qu'il peut **refuser** (opt-out). Une notification d'audience `admin` (un
webhook de salon, par exemple) est une **diffusion de gestion** : elle n'est pas
soumise à l'opt-out du membre.

### Côté routage : « membre concerné »

Un canal `recipient: "member"` n'a de sens que pour un événement d'audience
`member` : il livre à la personne concernée, résolue depuis le descripteur
`recipients` de l'`emit`. Voir [Canaux](/concepts/channels) et
[Destinataires & identités](/concepts/recipients-identity).

## Règle mentale

> **`admin`** = « l'organisation doit le savoir » → diffusion, pas d'opt-out membre.
>
> **`member`** = « cette personne doit le savoir » → livraison personnelle,
> opt-out et reroute possibles.
