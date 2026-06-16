# Workflows

Un **workflow** est une **route** : il relie un *événement* à un *canal* et
porte le *message* à envoyer. C'est l'objet que l'admin manipule le plus.

```text
Événement  ──▶  Workflow  ──▶  Canal
baas.subscription.created       discord_dm (membre concerné)
                  │
                  └── message : « Bienvenue {{member_name}} 🎉 … »
```

Un même événement peut alimenter **plusieurs** workflows (un email *et* un DM
Discord, par exemple). Chaque workflow actif produit sa propre livraison et sa
propre exécution.

## Workflow = événement + canal + étape(s)

Le message et le format vivent dans une **étape** (`workflow_step`) :

| Champ de l'étape | Description |
|---|---|
| `subject` | Sujet (email surtout). Supporte `{{variable}}`. |
| `body` | Corps du message. Supporte `{{variable}}`. |
| `format` | `text`, `html` ou `markdown`. |

::: info Une seule étape aujourd'hui, plusieurs demain
Le modèle prévoit plusieurs étapes par workflow (`send`, `wait`, `condition`)
pour de futurs scénarios type automatisation. Aujourd'hui, un workflow a une
seule étape `send`.
:::

## Templates `{{variable}}`

Le corps et le sujet sont des templates : `{{member_name}}` est remplacé par
`payload.member_name` au moment de l'envoi. Les variables disponibles sont
celles du `payload_schema` de l'événement (affichées dans l'éditeur).

```text
Sujet : Paiement reçu — {{amount}} €
Corps : Merci {{member_name}}, ton paiement de {{amount}} € pour
        {{plan_name}} est confirmé.
```

### Email : fragment ou document complet

Pour un canal email avec `format: html` :

- un **fragment** HTML est automatiquement **enveloppé** dans une mise en page
  de marque ;
- un **document complet** (commençant par `<!DOCTYPE` / `<html>`) est envoyé
  **tel quel**, sans habillage — utile pour des templates HTML sur-mesure.

## Activation

`is_active` active ou coupe la route. À l'`emit`, seuls les workflows **actifs**
de l'organisation pour l'événement sont résolus.

## Tester un workflow

Avant de passer en production, un admin peut envoyer un **test** avec des
données d'exemple (et une adresse de surcharge optionnelle). Les exécutions de
test sont marquées `is_test = true` et n'apparaissent pas dans les statistiques
de production. Voir l'outil `test_workflow` du [MCP](/guides/mcp).
