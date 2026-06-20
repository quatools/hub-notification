# Canaux Email & marque blanche

L'email passe par un **SMTP générique** (Nodemailer), volontairement
provider-agnostique : Scaleway TEM, Brevo, OVH… Aucun fournisseur n'est imposé,
en particulier aucun fournisseur US — c'est un choix de souveraineté.

## Configuration d'un canal email

| Mode | Config | Destination |
|---|---|---|
| **Membre concerné** | `recipient: "member"` | L'email du membre fourni dans `recipients`. |
| **Adresse fixe** | `email: "contact@club.fr"` | Toujours la même adresse. |

::: tip Créable depuis l'interface
Dans `/admin` → *Canaux* → *Ajouter un canal* → *Email*, choisissez
**« Au membre concerné »** ou **« Adresse fixe »** — exactement comme pour le MP
Discord. Bonne pratique : créez d'abord un canal vers **votre propre adresse**
pour tester la réception réelle avant de router vers les membres.
:::

## SMTP côté hub

L'envoi s'appuie sur des variables d'environnement, communes à toutes les
organisations :

| Variable | Exemple | Rôle |
|---|---|---|
| `SMTP_HOST` | `smtp.tem.scaleway.com` | Serveur SMTP. |
| `SMTP_PORT` | `465` (TLS implicite) ou `587` (STARTTLS) | Port. |
| `SMTP_USER` / `SMTP_PASS` | … | Identifiants. |
| `SMTP_FROM` | `Quatools Notifications <notifications@quatools.fr>` | Expéditeur par défaut. |

## Fragment HTML vs document complet

Pour un workflow email en `format: html` :

- un **fragment** HTML est automatiquement **enveloppé** dans une mise en page de
  marque (en-tête, pied, couleurs) ;
- un **document complet** (`<!DOCTYPE html>…`) est envoyé **tel quel**, sans
  habillage — pour un contrôle total du rendu.

::: tip Terrain prêt pour la génération de templates par IA
Comme les documents HTML complets sont envoyés sans modification, on peut
brancher un générateur de templates HTML par IA directement dans l'éditeur de
workflow (chantier prévu).
:::

## Marque blanche : l'identité d'expéditeur

Chaque organisation envoie sous **sa** marque. Deux niveaux :

### Niveau 1 — nom & adresse de réponse

Configurable immédiatement (UI `/admin/settings` ou MCP) :

| Réglage | Effet |
|---|---|
| `sender_name` | Nom affiché de l'expéditeur. |
| `reply_to` | Adresse de réponse. |

### Niveau 2 — domaine d'envoi dédié

Pour envoyer **depuis le domaine de l'organisation** (`notifications@club.fr`),
le hub s'intègre à **Scaleway TEM** via son API :

```text
1. L'admin déclare son domaine d'envoi (POST /api/admin/settings/domain).
2. Le hub retourne les enregistrements DNS à poser : SPF, DKIM, DMARC, MX.
3. L'admin pose ces enregistrements chez son registrar.
4. Vérification (check) : quand le statut passe à « verified », le From bascule
   automatiquement sur le domaine de l'org.
```

Variables d'environnement côté hub :

| Variable | Rôle |
|---|---|
| `SCW_SECRET_KEY` | Clé secrète IAM Scaleway (API TEM). |
| `SCW_DEFAULT_PROJECT_ID` | Projet Scaleway. |
| `SCW_REGION` | Région (ex. `fr-par`). |

État du domaine (`domain_status`) : `unconfigured` → `pending` → `verified`
(ou `failed`). Voir l'[API Admin](/api/admin) et les outils MCP
`setup_sending_domain` / `check_sending_domain`.

::: info Bonne pratique réputation
Utilisez un **sous-domaine dédié** à l'envoi (ex. `hub.club.fr`) pour isoler la
réputation d'envoi du domaine principal, sans toucher aux MX existants.
:::
