/**
 * Configure l'alerte opérateur (dogfood) pour l'app système « hub-notification ».
 * Fait 3 choses contre le hub PROD, avec TA clé + TON signing_secret :
 *   1) register l'événement hub.app.created
 *   2) déclare l'org « Quatools — Opérateur » (→ org_id)
 *   3) forge ton LIEN ADMIN (pour devenir owner de cette org) + imprime l'env VPS
 *
 * Les secrets ne transitent que sur ta machine (passés en variables d'env).
 *
 * Lancement (Git Bash) :
 *   HUB_KEY='<clé hub-notification>' HUB_SECRET='<signing_secret hub-notification>' \
 *     node scripts/setup-operator-alert.mjs
 */
import { createHmac } from 'node:crypto'

const HUB = process.env.HUB_URL || 'https://hub.quatools.fr'
const KEY = process.env.HUB_KEY
const SECRET = process.env.HUB_SECRET

if (!KEY || !SECRET) {
  console.error(
    "Renseigne d'abord la clé et le signing_secret de l'app hub-notification :\n\n" +
      "  HUB_KEY='<ta clé>' HUB_SECRET='<ton signing_secret>' node scripts/setup-operator-alert.mjs\n\n" +
      '(les deux se trouvent dans l\'Espace développeur → « Hub notification ».)'
  )
  process.exit(1)
}

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }

// 1) register hub.app.created
const reg = await fetch(`${HUB}/api/notifications/register`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    app: 'hub-notification',
    events: [
      {
        slug: 'hub.app.created',
        label: 'Nouvelle app créée',
        description: 'Un développeur a créé une application self-service — à valider',
        category: 'system',
        supported_channels: ['email', 'discord_webhook', 'discord_dm'],
        audiences: ['admin'],
        default_active: true,
        payload_schema: { app_name: 'string', slug: 'string', owner_email: 'string' },
      },
    ],
  }),
})
console.log(`1) register hub.app.created → ${reg.status}`)
if (!reg.ok) {
  console.error(await reg.text())
  process.exit(1)
}

// 2) déclarer l'org opérateur
const orgRes = await fetch(`${HUB}/api/notifications/orgs`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ external_id: 'operator-console', name: 'Quatools — Opérateur' }),
})
const org = await orgRes.json()
if (!orgRes.ok || !org.org_id) {
  console.error('2) /orgs a échoué :', orgRes.status, org)
  process.exit(1)
}
console.log(`2) org opérateur → ${org.org_id} (created: ${org.created})`)

// 3) forger le lien admin (scope admin, signé avec le signing_secret)
const payload = {
  app: 'hub-notification',
  app_user_id: 'operator',
  scope: 'admin',
  org_id: org.org_id,
  exp: Math.floor(Date.now() / 1000) + 1800, // 30 min
}
const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
const sig = createHmac('sha256', SECRET).update(body).digest('base64url')
const link = `${HUB}/api/link-admin?token=${body}.${sig}`

console.log('\n=== TON LIEN ADMIN (ouvre-le CONNECTÉ EN GOOGLE) ===')
console.log(link)
console.log("→ tu deviens propriétaire de l'org « Quatools — Opérateur ».")

console.log('\n=== À AJOUTER SUR LE VPS PROD (/root/hub-notification-prod/.env) ===')
console.log(`HUB_SELF_ORG_ID=${org.org_id}`)
console.log('HUB_SELF_API_KEY=<ta clé hub-notification>')
console.log('HUB_SELF_URL=https://hub.quatools.fr')
console.log('puis : systemctl restart hub-notification-prod')
