import nodemailer, { type Transporter } from 'nodemailer'
import { renderTemplate } from '@/lib/notifications/templates'
import { wrapEmailLayout } from './email-layout'
import type { DispatchResult, DispatchParams } from './index'

/**
 * Envoi par SMTP générique (nodemailer) : provider-agnostique.
 * Fonctionne avec tout fournisseur SMTP (Scaleway TEM, Brevo, OVH, ...).
 * Config via env : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 */

let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null

  const port = Number(process.env.SMTP_PORT) || 587
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = TLS implicite, 587 = STARTTLS
    auth: { user, pass },
  })
  return transporter
}

const DEFAULT_FROM = 'Quatools Notifications <notifications@quatools.fr>'

/** Extrait l'adresse seule d'un From au format `Nom <adresse>` ou `adresse`. */
function extractAddress(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1] : from.trim()
}

/**
 * Construit le From en marque blanche :
 * - domaine d'org vérifié (niveau 2) : "Nom" <notifications@domaine-org>
 * - sinon nom d'org (niveau 1)       : "Nom" <adresse par défaut>
 * - sinon                            : SMTP_FROM tel quel
 */
function buildFrom(sender?: DispatchParams['sender']): string {
  const defaultFrom = process.env.SMTP_FROM || DEFAULT_FROM
  if (!sender) return defaultFrom

  const address = sender.fromEmail || extractAddress(defaultFrom)
  if (sender.name) {
    return `"${sender.name.replace(/"/g, "'")}" <${address}>`
  }
  return sender.fromEmail ? address : defaultFrom
}

export async function dispatchEmail(params: DispatchParams): Promise<DispatchResult> {
  const { config, event, payload, step, sender } = params

  const email = config.email as string
  if (!email) {
    return { success: false, error: 'email manquant dans la config du canal' }
  }

  const smtp = getTransporter()
  if (!smtp) {
    return { success: false, error: 'SMTP non configuré (SMTP_HOST, SMTP_USER, SMTP_PASS requis)' }
  }

  // Construire le sujet depuis le step
  const subject = step.subject
    ? renderTemplate(step.subject, payload)
    : event.label

  // Construire le corps depuis le step
  const bodyContent = step.body
    ? renderTemplate(step.body, payload)
    : `<p>${event.label}</p><p>${event.description || ''}</p>`

  // Un document HTML complet (rédigé par l'admin ou généré par IA) est envoyé
  // tel quel ; un fragment simple est habillé du layout brandé.
  const isFullDocument = /<!DOCTYPE|<html[\s>]/i.test(bodyContent)
  const html = isFullDocument
    ? bodyContent
    : wrapEmailLayout(bodyContent, event.label, {
        senderName: sender?.name,
        category: event.category,
      })

  try {
    await smtp.sendMail({
      from: buildFrom(sender),
      to: email,
      subject,
      html,
      ...(sender?.replyTo && { replyTo: sender.replyTo }),
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: `Erreur email: ${error instanceof Error ? error.message : 'Unknown'}` }
  }
}
