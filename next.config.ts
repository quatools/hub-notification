import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome pour le déploiement serveur : .next/standalone contient
  // le serveur + les seules dépendances nécessaires (pas de node_modules complet).
  output: "standalone",
};

export default nextConfig;
