# Contribuer à Hub Notification

Merci de l'intérêt que vous portez au projet ! Ce document décrit comment
proposer une contribution.

## Avant de commencer

Hub Notification est publié en **open source pour la transparence et la
réutilisation** (licence MIT). Il est conçu pour vivre dans l'infrastructure
Supabase partagée de la suite Quatools — il n'est pas (encore) un produit
self-hostable « clone & run ». Gardez ce contexte en tête : certaines parties
(autorisation admin via `public.club_admins`, seeds d'événements `baas.*`) sont
couplées à cette infrastructure.

## Signaler un bug ou proposer une idée

Ouvrez une **issue** en décrivant :

- ce que vous attendiez et ce qui se passe réellement ;
- les étapes pour reproduire ;
- la version / le commit concerné.

Pour une **faille de sécurité**, n'ouvrez **pas** d'issue publique : suivez
[SECURITY.md](./SECURITY.md).

## Proposer du code (Pull Request)

1. **Forkez** le dépôt et créez une branche depuis `master`
   (`feat/…`, `fix/…`, `docs/…`).
2. **Développez** en respectant le style existant (voir ci-dessous).
3. **Vérifiez** que le projet build et que le lint passe :
   ```bash
   npm run lint
   npm run build
   ```
4. **Ouvrez une PR** avec une description claire du *quoi* et du *pourquoi*.

### Convention de commits

Le projet suit **Conventional Commits** :

```text
feat:     nouvelle fonctionnalité
fix:      correction de bug
docs:     documentation
perf:     performance
refactor: refonte sans changement de comportement
chore:    outillage, dépendances
```

Préfixez par le périmètre si utile : `feat(membre): …`, `fix(emit): …`.

### Style de code

- **TypeScript** strict, composants React fonctionnels.
- Suivez les conventions du code environnant (nommage, densité de commentaires).
- Les commentaires expliquent le **pourquoi**, pas le **quoi**.
- Pas de secret en clair dans le code ni dans les commits.

## Documentation

La documentation publique vit dans [`docs/`](./docs) (VitePress). Toute évolution
d'API ou de comportement observable doit s'accompagner de la mise à jour de la
page correspondante.

## Questions

Ouvrez une issue avec le label `question`. Merci de votre contribution ! 🙏
