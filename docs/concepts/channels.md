# Canaux

Un **canal** (`channel`) est une destination concrète où une notification peut
être livrée. Un canal a un **type**, une **config** (qui dépend du type), et
appartient soit à une **organisation** (`org_id` renseigné, partagé entre
workflows) soit à un **membre** (`org_id = null`, canal personnel).

## Types de canaux

| Type | Config principale | Pour qui | Détail |
|---|---|---|---|
| `email` | `email`, ou `recipient: "member"` | admin & membre | SMTP générique. From en marque blanche. |
| `discord_webhook` | `webhook_url` | admin | Publie un embed dans un salon Discord. |
| `discord_dm` | `discord_user_id`, ou `recipient: "member"` | admin & membre | Message privé via le bot. |
| `sms` | — | — | Réservé, non implémenté. |

Voir les guides [Discord](/guides/channels-discord) et
[Email & marque blanche](/guides/channels-email).

## Adresse fixe vs « membre concerné »

C'est la distinction la plus importante d'un canal. La clé `recipient` de la
config détermine **à qui** le canal livre :

- **Adresse fixe** (`recipient` absent, ou `email`/`discord_user_id` renseigné) :
  le canal pointe toujours vers la **même** destination. Typiquement un webhook
  de salon d'org, ou le DM/email d'un capitaine. Le destinataire enregistré est
  le **créateur du workflow** (l'admin).

- **Membre concerné** (`recipient: "member"`) : la destination est **résolue à
  l'envoi** depuis le descripteur `recipients` de l'`emit`. Une livraison est
  produite **par destinataire concerné**, sur **son** email ou **son** Discord,
  et l'exécution est rattachée à **sa** fiche.

::: warning Un canal « membre concerné » ne retombe jamais sur l'admin
Si un workflow utilise un canal `recipient: "member"` mais que l'`emit`
n'a fourni **aucun** descripteur `recipients`, le hub **n'invente pas** de
destination : l'exécution est marquée `failed` avec un message explicite. C'est
volontaire — cela force l'app appelante à corriger son `emit` plutôt que
d'envoyer par erreur la notification d'un membre à l'admin.
:::

## Vérification

Un canal a un drapeau `is_verified` : la destination a été testée (webhook qui
répond 200, email de test délivré, utilisateur Discord existant…). Un canal non
vérifié peut quand même être utilisé, mais l'UI le signale.

## Activation

`is_active` permet de couper un canal sans le supprimer. Supprimer un canal
supprime **en cascade** les workflows qui l'utilisent.
