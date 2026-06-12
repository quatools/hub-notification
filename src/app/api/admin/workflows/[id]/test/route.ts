import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuthForWorkflow } from '@/lib/auth/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { getDispatcher } from '@/lib/dispatchers'
import { getSenderIdentity } from '@/lib/notifications/sender'
import type { NotificationEvent } from '@/lib/types/notifications'

/**
 * Génère des données fictives à partir du payload_schema d'un event.
 */
function generateTestPayload(schema: Record<string, string> | null): Record<string, unknown> {
  if (!schema) return { test: true }

  const payload: Record<string, unknown> = {}
  for (const [key, type] of Object.entries(schema)) {
    switch (type) {
      case 'string':
        payload[key] = `Test ${key.replace(/_/g, ' ')}`
        break
      case 'number':
        payload[key] = 42
        break
      case 'boolean':
        payload[key] = true
        break
      default:
        payload[key] = `test_${key}`
    }
  }
  return payload
}

// POST /api/admin/workflows/:id/test
// Body optionnel : { payload?: Record<string, unknown>, override_email?: string }
// - payload : valeurs de test fournies par l'admin (sinon générées du schéma)
// - override_email : envoyer le test à cette adresse plutôt qu'au canal (email uniquement)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAdminAuthForWorkflow(id)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  let options: {
    payload?: Record<string, unknown>
    override_email?: string
    step?: { subject?: string | null; body?: string; format?: string }
  } = {}
  try {
    options = await request.json()
  } catch {
    // Pas de body : comportement par défaut
  }

  const supabase = createServiceClient()

  // Charger le workflow complet
  const { data: workflow, error } = await supabase
    .schema('notifications')
    .from('workflows')
    .select(`
      *,
      events:event_id (*),
      channels:channel_id (*),
      workflow_steps (subject, body, format, step_order)
    `)
    .eq('id', id)
    .single()

  if (error || !workflow) {
    return NextResponse.json({ error: 'Workflow introuvable' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event = workflow.events as any as NotificationEvent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channel = workflow.channels as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps = workflow.workflow_steps as any[]

  if (!channel || !steps || steps.length === 0) {
    return NextResponse.json({ error: 'Workflow incomplet (canal ou step manquant)' }, { status: 400 })
  }

  const step = steps.sort((a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order)[0]

  // Vérifier le canal
  if (!channel.is_active || !channel.is_verified) {
    return NextResponse.json({ error: 'Canal inactif ou non vérifié' }, { status: 400 })
  }

  // Payload de test : valeurs fournies par l'admin, complétées par les valeurs générées
  const generated = generateTestPayload(event.payload_schema)
  const testPayload = { ...generated, ...(options.payload || {}) }

  // Destination override (email uniquement)
  let config = channel.config
  if (options.override_email) {
    if (channel.type !== 'email') {
      return NextResponse.json(
        { error: "L'adresse de test ne s'applique qu'aux canaux email" },
        { status: 400 }
      )
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.override_email)) {
      return NextResponse.json({ error: 'Adresse email de test invalide' }, { status: 400 })
    }
    config = { ...channel.config, email: options.override_email }
  }

  // Dispatcher
  const dispatcher = getDispatcher(channel.type)
  if (!dispatcher) {
    return NextResponse.json({ error: `Dispatcher non trouvé pour le type: ${channel.type}` }, { status: 400 })
  }

  const sender = await getSenderIdentity(workflow.org_id)

  // L'admin peut tester le contenu en cours d'édition (non sauvegardé)
  const result = await dispatcher({
    config,
    event,
    payload: testPayload,
    step: {
      subject: options.step?.subject !== undefined ? options.step.subject : step.subject,
      body: options.step?.body || step.body,
      format: (options.step?.format || step.format) as 'text' | 'html' | 'markdown',
    },
    sender,
  })

  return NextResponse.json({
    success: result.success,
    error: result.error || null,
    test_payload: testPayload,
  })
}
