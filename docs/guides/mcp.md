# Configuration par l'IA (MCP)

Chaque organisation dispose d'un **serveur MCP** dédié. Un admin connecte
**Claude** (ou tout client compatible MCP) et configure ses notifications **en
langage naturel** : « crée un canal email, route l'événement abonnement vers ce
canal avec ce message, envoie-moi un test ».

## Qu'est-ce que le MCP ?

Le *Model Context Protocol* est un standard ouvert qui permet à un assistant IA
d'appeler des outils. Le hub expose un serveur MCP **par organisation** :

```text
https://notifications.quatools.fr/api/mcp/{orgId}
```

Le protocole est du **JSON-RPC 2.0** sur HTTP, sécurisé par **OAuth 2.1 + PKCE**.

## Se connecter

### Depuis claude.ai

Le serveur doit être joignable sur une **URL publique**. Dans Claude, ajoutez un
connecteur MCP pointant vers l'URL de votre organisation. Le flux OAuth vérifie
que vous êtes **admin actif** de l'org avant d'émettre un jeton d'accès.

La carte « Connexion MCP » de l'écran *Paramètres* du hub affiche l'URL exacte
de votre organisation et les étapes de connexion.

### Depuis Claude Code (dev)

```bash
claude mcp add --transport http hub-notif https://notifications.quatools.fr/api/mcp/<orgId>
```

## Les 15 outils disponibles

### Événements
- **`list_events`** — liste les événements actifs, leurs variables de template
  et le nombre de workflows actifs par événement.

### Canaux
- **`list_channels`** — canaux de l'org avec leur statut de vérification.
- **`create_channel`** — crée un webhook, un DM ou un email.
- **`update_channel`** — modifie label, destination, activation (re-vérifie si
  la destination change).
- **`delete_channel`** — supprime (⚠️ cascade sur les workflows).

### Workflows
- **`list_workflows`** — routes configurées (événement → canal + message), avec
  statut actif/inactif.
- **`create_workflow`** — relie un événement à un canal avec un message.
- **`update_workflow`** — modifie le message (sujet, corps, format) ou
  l'activation.
- **`delete_workflow`** — supprime une route.
- **`test_workflow`** — envoie un test avec des données d'exemple (et une
  adresse de surcharge optionnelle).

### Logs
- **`get_logs`** — historique des envois (statut `sent`/`failed`, erreurs,
  contenu).

### Marque blanche
- **`get_sender_identity`** — identité d'expéditeur (nom, adresse de réponse,
  domaine et son statut).
- **`set_sender_identity`** — définit le nom d'expéditeur et l'adresse de réponse.
- **`setup_sending_domain`** — déclare un domaine d'envoi, retourne les
  enregistrements DNS à poser.
- **`check_sending_domain`** — rafraîchit la vérification DNS et retourne le
  statut (`pending`, `verified`, `failed`).

## Sécurité

| Variable d'environnement | Rôle |
|---|---|
| `MCP_OAUTH_SECRET` | Secret de signature des jetons d'accès OAuth (≥ 32 caractères). |

Le jeton porte l'`userId` et l'`orgId` : un admin ne peut piloter **que** les
organisations dont il est admin. Voir aussi la [Référence API](/api/overview).

## Exemple de conversation

> **Admin :** « Crée un canal email "membre concerné" et route
> `baas.subscription.created` dessus, avec le message : Bienvenue
> {{member_name}}, ton abonnement {{plan_name}} est actif ! Puis envoie-moi un
> test. »
>
> **Claude** appelle `create_channel`, `create_workflow`, puis `test_workflow`
> et confirme l'envoi — sans que l'admin n'ouvre l'interface.
