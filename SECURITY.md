# Politique de sécurité

## Signaler une vulnérabilité

La sécurité de Hub Notification — et la confiance des membres dont il traite les
notifications — est une priorité. Si vous découvrez une faille, merci de la
signaler **de façon responsable**.

- **N'ouvrez pas d'issue publique** pour une faille de sécurité.
- Écrivez à **security@quatools.fr** (ou contactez directement les mainteneurs)
  avec :
  - une description de la vulnérabilité ;
  - les étapes pour la reproduire ;
  - l'impact potentiel ;
  - toute suggestion de correctif si vous en avez.

Nous accuserons réception sous **72 heures** et vous tiendrons informé de la
prise en charge et du correctif.

## Périmètre sensible

Quelques zones particulièrement sensibles, à manipuler avec soin :

| Zone | Pourquoi |
|---|---|
| **Clés API** (`NOTIFICATION_API_KEYS`) | Authentifient les apps émettrices serveur-à-serveur. |
| **Jetons de rattachement** (`/api/link`) | Signés HMAC, courte durée — un défaut permettrait l'usurpation d'identité d'un membre. |
| **OAuth 2.1 / MCP** (`MCP_OAUTH_SECRET`) | Contrôle l'accès admin au serveur MCP. |
| **Service role Supabase** | Contourne la RLS ; ne doit jamais fuiter côté client. |
| **`DISCORD_BOT_TOKEN`** | Contrôle le bot d'envoi de DM. |

## Bonnes pratiques pour les déploiements

- Ne committez **jamais** de secret (le `.gitignore` exclut `.env*`).
- Régénérez tout secret ayant pu être exposé (notamment `DISCORD_BOT_TOKEN`)
  **avant** une mise en production.
- Utilisez `MCP_OAUTH_SECRET` d'au moins 32 caractères aléatoires.
- Servez le hub exclusivement en HTTPS.

Merci d'aider à garder le projet et ses utilisateurs en sécurité. 🔒
