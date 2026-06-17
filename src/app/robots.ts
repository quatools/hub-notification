import type { MetadataRoute } from "next"

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://hub.quatools.fr"
const ALLOW = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true"

/**
 * robots.txt généré.
 * - Hors prod (NEXT_PUBLIC_ALLOW_INDEXING ≠ "true") : tout bloquer (dev/staging
 *   ne doivent jamais être indexés).
 * - En prod : autoriser les pages publiques, bloquer l'app privée et les API.
 */
export default function robots(): MetadataRoute.Robots {
  if (!ALLOW) {
    return { rules: { userAgent: "*", disallow: "/" } }
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/preferences", "/api/", "/auth/"],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
