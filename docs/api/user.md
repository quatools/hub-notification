# API Membre

Les routes `/api/user/*` servent l'espace **préférences** du membre. Elles
s'authentifient par la **session** de l'utilisateur connecté. Un membre n'a pas
besoin d'être admin : son accès se déduit de son activité (les organisations qui
lui ont envoyé des notifications).

## Opt-out (mes notifications)

| Méthode & route | Rôle |
|---|---|
| `GET /api/user/optouts?org_id=…` | Workflows d'audience `member` pour cette org, avec l'état d'opt-out. |
| `PUT /api/user/optouts` | Active/désactive l'opt-out pour un workflow. |

L'opt-out est posé sur la **fiche destinataire** (`recipient_id`) du membre : il
ne reçoit plus les livraisons « membre concerné » de ce workflow. Les diffusions
d'org (webhooks) ne sont pas concernées. Voir [Audiences](/concepts/audiences).

## Canaux personnels (mes canaux de réception)

| Méthode & route | Rôle |
|---|---|
| `GET /api/user/channels?org_id=…` | Canaux personnels du membre. |
| `POST /api/user/channels` | Ajoute un canal personnel (email, DM Discord). |
| `PATCH /api/user/channels/{id}` | Modifie un canal personnel. |
| `DELETE /api/user/channels/{id}` | Supprime un canal personnel. |

Ces canaux ont `org_id = null` : ils appartiennent au membre, pas à
l'organisation.

## Historique (mes notifications reçues)

| Méthode & route | Rôle |
|---|---|
| `GET /api/user/history?org_id=…` | Exécutions adressées au membre, avec la **destination réelle**. |

L'historique affiche, pour chaque notification : l'événement, le statut, la date
et **où** elle a été livrée (« envoyé à votre email / votre Discord / un salon »)
— la transparence promise par le hub.

## Clubs / organisations accessibles

| Méthode & route | Rôle |
|---|---|
| `GET /api/auth/clubs` | Organisations où l'utilisateur est admin **et** celles déduites de son activité de membre. |

Cette route alimente le sélecteur d'organisation, aussi bien pour un admin que
pour un simple membre.
