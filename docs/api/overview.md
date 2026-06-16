# Référence API — vue d'ensemble

Le hub expose trois familles d'API :

| Famille | Authentification | Pour qui |
|---|---|---|
| **Serveur-à-serveur** (`/api/notifications/*`) | Clé API (Bearer) | Vos applications |
| **Admin** (`/api/admin/*`) | Session + rôle admin de l'org | L'UI admin (et le MCP) |
| **Membre** (`/api/user/*`) | Session utilisateur | L'espace préférences |

Plus deux briques transverses : le **rattachement** (`/api/link`) et l'**OAuth
2.1** du serveur MCP (`/api/oauth/*`, `/api/mcp/{orgId}`).

## URL de base

```text
Production : https://notifications.quatools.fr
```

## Authentification serveur-à-serveur

Les API utilisées par vos applications (`register`, `emit`) s'authentifient par
**clé API** dans l'en-tête `Authorization` :

```http
Authorization: Bearer <VOTRE_API_KEY>
```

La clé doit correspondre à une entrée de la variable d'environnement
`NOTIFICATION_API_KEYS` du hub, au format JSON `{"nom-app": "secret"}`. Le nom
d'app associé à la clé est utilisé comme préfixe d'identité dans le
[graphe d'identité](/concepts/recipients-identity).

## Authentification admin & membre

Les API `/api/admin/*` et `/api/user/*` s'appuient sur la **session Supabase**
(cookie). Les routes admin vérifient en plus que l'utilisateur est **admin
actif** de l'organisation ciblée. Elles sont surtout consommées par l'UI du hub
et par le serveur MCP — vos applications n'ont normalement pas à les appeler.

## Codes d'erreur communs

| Code | Signification |
|---|---|
| `400` | Body invalide (champ requis manquant). |
| `401` | Clé API ou session invalide / manquante. |
| `403` | Authentifié mais pas admin de l'organisation. |
| `404` | Ressource inconnue (événement inactif, etc.). |
| `500` | Erreur interne. |

## Pages de référence

- [POST /register](/api/register) — déclarer ses événements
- [POST /emit](/api/emit) — émettre une notification
- [API Admin](/api/admin) — canaux, workflows, logs, marque blanche
- [API Membre](/api/user) — opt-out, canaux perso, historique
- [Rattachement (/link)](/api/link) — jeton de rattachement de compte
