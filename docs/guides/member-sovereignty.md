# Souveraineté du membre

> **Vos notifications, votre vie, vos choix.**

La promesse du hub : la personne notifiée **possède** ses préférences. Pas
l'application qui déclenche l'événement, pas l'organisation — la personne. Ce
guide décrit l'expérience côté membre et les garanties techniques derrière.

## Ce que le membre peut faire

| Action | Où | Effet |
|---|---|---|
| **Voir** ce qu'il reçoit | *Mes notifications* | Liste des notifications d'audience `member`, groupées par événement. |
| **Refuser** une notification | *Mes notifications* (toggle) | Opt-out par canal et par événement. |
| **Rediriger** vers ses canaux | *Mes canaux de réception* | Ajout d'emails / DM Discord personnels. |
| **Consulter l'historique** | *Historique* | Chaque notif reçue, son statut, sa date et **où** elle a été livrée. |

## Accessible même sans être admin

L'espace préférences (`/preferences`) est accessible à **tout membre**, pas
seulement aux admins. Les organisations qui s'affichent pour un membre sont
**déduites de son activité** (les notifications qu'il a reçues) — un simple
joueur voit donc ses préférences sans aucun rôle d'administration.

## La transparence de l'historique

L'historique ne dit pas seulement « envoyé » : il dit **où**. « Envoyé à votre
email », « Envoyé à votre Discord », « Publié dans un salon ». Le membre sait
exactement quelle de ses coordonnées a reçu quoi — y compris quand une
notification a été **redirigée**.

## Les garanties techniques

Cette souveraineté repose sur la couche
[destinataires & identités](/concepts/recipients-identity) :

1. **Une fiche par personne**, indépendante de l'app émettrice.
2. **Opt-out par destinataire** (`recipient_id`), pas par compte applicatif :
   un refus vaut pour la personne, sur toutes les apps qui la notifient.
3. **Un canal « membre concerné » ne retombe jamais sur un tiers** : sans
   destinataire explicite, le hub échoue plutôt que de livrer au mauvais
   endroit.
4. **Rattachement réversible et sans perte** : quand le membre réclame sa fiche,
   identités, canaux, opt-out et historique sont fusionnés proprement.

## Le rattachement de compte

Pour passer d'une fiche flottante (créée par les `emit`) à des préférences
contrôlées, le membre **rattache son compte** :

```text
App partenaire → /api/link?token=… → login hub → claimAppIdentity → /preferences
```

Détail technique : [Rattachement (/link)](/api/link).

## Sur la feuille de route

- **Désabonnement 1-clic** + en-tête `List-Unsubscribe` sur les emails.
- **Login par lien magique** (en plus de Discord OAuth).
- **Reroute effectif** : brancher les canaux personnels du membre dans le
  routage (remplacer ou ajouter à la destination par défaut).
- **Landing de rattachement** pédagogique en marque blanche pour les arrivées
  via deep-link partenaire.
