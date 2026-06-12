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

export async function dispatchEmail(params: DispatchParams): Promise<DispatchResult> {
  const { config, event, payload, step } = params

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

  const html = wrapEmailLayout(bodyContent, event.label)

  try {
    await smtp.sendMail({
      from: process.env.SMTP_FROM || 'Quatools Notifications <notifications@quatools.fr>',
      to: email,
      subject,
      html,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: `Erreur email: ${error instanceof Error ? error.message : 'Unknown'}` }
  }
}
