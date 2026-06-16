# Documentation — Hub Notification

Site de documentation publique, propulsé par [VitePress](https://vitepress.dev).
Conçu comme un site **autonome**, destiné à être servi en **sous-répertoire** du
site studio pour consolider le SEO :

```text
quatools.fr/hub        → landing produit (site studio)
quatools.fr/hub/docs   → cette documentation
```

Le chemin de base est configuré dans `.vitepress/config.mts` (`base: '/hub/docs/'`).

## Lancer en local

```bash
cd docs
npm install
npm run dev        # http://localhost:5173/hub/docs/
```

## Construire

```bash
npm run build      # sortie statique dans .vitepress/dist
npm run preview    # prévisualiser le build
```

## Déployer

La sortie de `build` est **statique**. Deux options :

1. **Reverse-proxy** (Caddy/Nginx) : servir `.vitepress/dist` sous `/hub/docs`
   sur le même hôte que `quatools.fr`.
2. **Intégration build** : copier `.vitepress/dist` dans le dossier public du
   site studio, sous `hub/docs`.

::: Exemple Caddy
```caddy
quatools.fr {
  handle_path /hub/docs/* {
    root * /var/www/hub-docs/dist
    file_server
  }
}
```
:::

## Structure

```text
docs/
├── index.md                     Accueil (hero)
├── quickstart.md                Démarrage en 5 min
├── concepts/                    Modèle : events, channels, workflows,
│                                audiences, recipients & identités
├── guides/                      Discord, Email/marque blanche, MCP,
│                                souveraineté membre
├── api/                         Référence : overview, register, emit,
│                                admin, user, link
└── architecture/                Modèle de données, flux d'émission
```

## Sources

Cette documentation synthétise et remplace, pour le public :

- `INTEGRATION.md` (guide intégrateur) — recyclé dans `quickstart` + `api/`.
- `CAHIER_DES_CHARGES.md` et `CDC-V2-DESTINATAIRES-IDENTITE.md` (specs internes)
  — matière première, non publiées telles quelles.
