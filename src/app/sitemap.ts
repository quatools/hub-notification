import type { MetadataRoute } from "next"

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://hub.quatools.fr"

/** Sitemap : uniquement les pages publiques (l'app est privée, derrière login). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/login`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE}/cgu`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/confidentialite`, changeFrequency: "yearly", priority: 0.3 },
  ]
}
