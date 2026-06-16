# Flux d'émission

Ce que fait exactement le hub entre l'appel `POST /api/notifications/emit` et la
livraison. Référence du contrat : [POST /emit](/api/emit).

## Vue d'ensemble

```text
emit ──▶ [1] Auth clé API
         [2] Validation (event, org_id, payload)
         [3] Résolution de l'événement (actif, non déprécié)
         [4] Résolution des destinataires (recipients[] → fiches canoniques)
         [5] Résolution des routes (workflows actifs de l'org pour l'event)
         [6] Identité d'expéditeur de l'org (marque blanche)
         [7] Construction des jobs de livraison
         [8] Filtre opt-out + création des exécutions (pending)
         ──▶ RÉPONSE HTTP { dispatched, channels, execution_ids }
         [9] Dispatch en arrière-plan (non attendu) → sent / failed
```

## Étape par étape

### 1–3. Auth, validation, événement
La clé API est validée et associée à un **nom d'app** (préfixe d'identité).
`event`, `org_id` et `payload` sont requis. L'événement doit être **actif** et
**non déprécié**, sinon `404`.

### 4. Résolution des destinataires
Chaque entrée de `recipients[]` est résolue en **fiche canonique** via
`resolveRecipient` : réutilisation si une identité clé correspond, sinon création
d'une fiche flottante. **Aucun envoi** ici — uniquement de l'identification.

### 5. Résolution des routes
`resolveRoutes` retourne tous les **workflows actifs** de l'org pour cet
événement, avec leur canal et leur message. Zéro route → réponse `dispatched: 0`.

### 6. Identité d'expéditeur
`getSenderIdentity(org_id)` charge le nom d'expéditeur, l'adresse de réponse et
le domaine d'envoi (marque blanche) appliqués aux livraisons.

### 7. Construction des jobs
Pour chaque route, selon `config.recipient` :

- **`member`** : un job **par destinataire** résolu, sur **son** identité
  (Discord/email). Si aucun destinataire → un job marqué pour **échec explicite**
  (le hub ne retombe jamais sur l'admin).
- **adresse fixe / webhook** : un seul job, destinataire = créateur du workflow.

La destination concrète (email, snowflake Discord) est figée dans le job pour
l'historique.

### 8. Opt-out & exécutions
Les opt-out des destinataires **membre** sont chargés ; les jobs refusés sont
écartés (les diffusions webhook ne sont pas concernées). Pour chaque job
restant, une **exécution** est créée en statut `pending` avec sa `destination`.

### Réponse immédiate
Le hub répond **dès les exécutions créées**, sans attendre l'envoi réel — ce qui
évite les timeouts côté appelant. `dispatched` = nombre d'exécutions créées.

### 9. Dispatch en arrière-plan
Le hub étant un serveur Node persistant, les promesses d'envoi continuent après
la réponse HTTP :

- un job avec `skipReason` (membre sans identité utilisable) → `failed` explicite ;
- sinon, le **dispatcher** du type de canal rend le template et envoie ;
- l'exécution passe à `sent` (avec `sent_at`) ou `failed` (avec `error_message`).

## Pourquoi ce découpage

| Choix | Raison |
|---|---|
| Réponse avant envoi | SMTP/Discord sont lents ; ne pas faire expirer le `fetch` appelant (mesuré ~1 s vs plusieurs s). |
| Résolution sans envoi (étape 4) | Rendre la notif **rattachable** au compte du membre même si rien n'est livré. |
| Échec explicite si pas de destinataire | Forcer l'app à corriger plutôt que livrer au mauvais endroit. |
| Exécution = source de vérité | Le statut final vit dans `workflow_executions`, pas dans la réponse HTTP. |
