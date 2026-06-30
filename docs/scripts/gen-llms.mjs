/**
 * Génère docs/public/llms-full.txt : toute la doc concaténée en un seul fichier
 * texte, lisible par les agents IA et curl (la version VitePress est une SPA).
 * Servi par VitePress à `/hub/docs/llms-full.txt` (= lien de l'espace dev).
 *
 * Lancer : `node scripts/gen-llms.mjs` depuis docs/, ou via `npm run gen:llms`.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..')

// Ordre = la sidebar VitePress (config.mts).
const ORDER = [
  'index.md',
  'quickstart.md',
  'concepts/overview.md',
  'concepts/events.md',
  'concepts/channels.md',
  'concepts/workflows.md',
  'concepts/audiences.md',
  'concepts/recipients-identity.md',
  'guides/channels-discord.md',
  'guides/channels-email.md',
  'guides/mcp.md',
  'guides/member-sovereignty.md',
  'api/overview.md',
  'api/register.md',
  'api/orgs.md',
  'api/emit.md',
  'api/admin.md',
  'api/user.md',
  'api/link.md',
  'architecture/data-model.md',
  'architecture/emit-flow.md',
]

function clean(md) {
  return md
    .replace(/^---\n[\s\S]*?\n---\n/, '') // frontmatter
    .replace(/^:::\s*(tip|info|warning|danger|details)\s*(.*)$/gim, (_, _t, title) =>
      title && title.trim() ? `> **${title.trim()}**` : '>'
    )
    .replace(/^:::\s*$/gim, '') // fences fermantes
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const header = `# Hub Notification — Documentation complète (llms-full.txt)

> Documentation complète du Hub de notification Quatools, concaténée en un seul
> fichier texte pour les agents IA, curl et l'indexation. La doc interactive
> (SPA VitePress) n'est pas lisible par un fetch ; ce fichier l'est.
>
> Source : https://www.quatools.fr/hub/docs · Dépôt : https://github.com/quatools/hub-notification
`

let out = header
let included = 0
for (const rel of ORDER) {
  const p = join(DOCS, rel)
  if (!existsSync(p)) {
    console.warn('skip (absent):', rel)
    continue
  }
  out += `\n\n---\n\n# Fichier : ${rel}\n\n` + clean(readFileSync(p, 'utf8')) + '\n'
  included++
}

const pubDir = join(DOCS, 'public')
if (!existsSync(pubDir)) mkdirSync(pubDir, { recursive: true })
writeFileSync(join(pubDir, 'llms-full.txt'), out, 'utf8')
console.log(`llms-full.txt généré : ${included} pages, ${out.length} caractères`)
