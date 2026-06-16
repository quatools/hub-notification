# Canaux Discord

Le hub propose deux canaux Discord : le **webhook** (publication dans un salon)
et le **DM** (message privé via un bot partagé).

## Webhook Discord (`discord_webhook`)

Publie un **embed** dans un salon. Idéal pour les notifications de gestion
(audience `admin`) : « nouveau paiement », « équipe au complet », etc.

### Configuration

| Champ de config | Description |
|---|---|
| `webhook_url` | URL du webhook Discord du salon. |

Pour obtenir l'URL : *Paramètres du salon → Intégrations → Webhooks → Nouveau
webhook → Copier l'URL*.

### Rendu

L'embed est coloré selon la **catégorie** de l'événement et habillé du nom
d'expéditeur de l'organisation (marque blanche niveau 1). Le hub gère les
limites de débit et les délais d'attente Discord.

## DM Discord (`discord_dm`)

Envoie un **message privé** via le bot partagé « Notify ». Convient à
l'audience `member` (« ton abonnement est actif ») comme à une adresse fixe
(capitaine, admin).

### Deux modes

| Mode | Config | Destination |
|---|---|---|
| **Membre concerné** | `recipient: "member"` | Le Discord du membre fourni dans `recipients` à l'`emit`. |
| **Adresse fixe** | `discord_user_id: "…"` | Toujours le même utilisateur. |

::: tip Les IDs Discord sont déjà connus
Quand les membres se connectent à vos apps via Discord, leur identité Discord
est déjà en base. Le mode « membre concerné » résout l'ID **à l'envoi** —
**aucun ID n'est saisi manuellement** par l'admin.
:::

### Contraintes

- Le bot et le membre doivent partager **au moins un serveur** Discord.
- Si le membre a **bloqué les DM**, l'envoi échoue proprement (code Discord
  `50007`) et l'exécution est marquée `failed`.
- Mode « membre concerné » sans `recipients` → échec explicite (le hub ne
  retombe jamais sur l'admin).

### Marque blanche Discord

- **Niveau 1 (actuel)** : bot neutre, embeds aux couleurs du club, surnom
  configurable par serveur.
- **Niveau 2 (prévu)** : *bring-your-own-bot* — un token de bot par organisation,
  sur le même principe que le domaine d'envoi email.

## Configuration & variables d'environnement

Le bot requiert, côté hub :

| Variable | Rôle |
|---|---|
| `DISCORD_BOT_TOKEN` | Token du bot (sensible). |
| `NEXT_PUBLIC_DISCORD_APP_ID` | Id de l'application Discord (pour la carte d'invitation). |

Voir aussi [Concept : Canaux](/concepts/channels).
