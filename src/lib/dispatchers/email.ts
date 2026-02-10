import { Resend } from 'resend'
import { renderTemplate } from '@/lib/notifications/templates'
import { wrapEmailLayout } from './email-layout'
import type { DispatchResult, DispatchParams } from './index'

let resend: Resend | null = null

function getResendClient(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

export async function dispatchEmail(params: DispatchParams): Promise<DispatchResult> {
  const { config, event, payload, step } = params

  const email = config.email as string
  if (!email) {
    return { success: false, error: 'email manquant dans la config du canal' }
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
    const { error } = await getResendClient().emails.send({
      from: 'Quatools Notifications <notifications@quatools.fr>',
      to: email,
      subject,
      html,
    })

    if (error) {
      return { success: false, error: `Resend: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: `Erreur email: ${error instanceof Error ? error.message : 'Unknown'}` }
  }
}
