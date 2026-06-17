import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/auth/admin'
import { createServiceClient } from '@/lib/supabase/server'
// GET /api/admin/workflows?org_id=xxx
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('org_id')
  const auth = await getAdminAuth(orgId)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Charger les workflows avec leurs relations
  const { data: workflows, error } = await supabase
    .schema('notifications')
    .from('workflows')
    .select(`
      id,
      org_id,
      event_id,
      channel_id,
      is_active,
      created_by,
      created_at,
      events:event_id (
        id,
        slug,
        label,
        description,
        category,
        supported_channels,
        audiences,
        payload_schema
      ),
      channels:channel_id (
        id,
        type,
        label
      ),
      workflow_steps (
        id,
        subject,
        body,
        format,
        step_order
      )
    `)
    .eq('org_id', auth.org_id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erreur chargement workflows:', error)
    return NextResponse.json({ error: 'Erreur lors du chargement des workflows' }, { status: 500 })
  }

  // Charger tous les events disponibles
  const { data: allEvents } = await supabase
    .schema('notifications')
    .from('events')
    .select('*')
    .eq('is_active', true)
    .is('deprecated_at', null)
    .order('category')
    .order('label')

  // Formater : grouper les workflows par événement
  const eventMap = new Map<string, { event: unknown; workflows: unknown[] }>()

  // D'abord ajouter tous les events disponibles
  if (allEvents) {
    for (const event of allEvents) {
      eventMap.set(event.id, { event, workflows: [] })
    }
  }

  // Puis ajouter les workflows à leurs events
  if (workflows) {
    for (const wf of workflows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const steps = wf.workflow_steps as any[]
      const step = steps && steps.length > 0
        ? steps.sort((a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order)[0]
        : null

      const formatted = {
        id: wf.id,
        org_id: wf.org_id,
        event_id: wf.event_id,
        channel_id: wf.channel_id,
        is_active: wf.is_active,
        created_by: wf.created_by,
        created_at: wf.created_at,
        event: wf.events,
        channel: wf.channels,
        step: step ? { id: step.id, subject: step.subject, body: step.body, format: step.format } : null,
      }

      const entry = eventMap.get(wf.event_id)
      if (entry) {
        entry.workflows.push(formatted)
      }
    }
  }

  const result = Array.from(eventMap.values())

  return NextResponse.json({ events_with_workflows: result })
}

// POST /api/admin/workflows
export async function POST(request: NextRequest) {
  let body: {
    org_id: string
    event_id: string
    channel_id: string
    step: { subject?: string; body: string; format: string }
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  if (!body.org_id || !body.event_id || !body.channel_id) {
    return NextResponse.json({ error: 'org_id, event_id et channel_id requis' }, { status: 400 })
  }
  if (!body.step || !body.step.body) {
    return NextResponse.json({ error: 'step.body requis' }, { status: 400 })
  }

  const auth = await getAdminAuth(body.org_id)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Sécurité (H4) : le canal doit appartenir à la même organisation, sinon un
  // admin pourrait router un workflow vers le canal privé d'un autre club.
  const { data: channel } = await supabase
    .schema('notifications')
    .from('channels')
    .select('id')
    .eq('id', body.channel_id)
    .eq('org_id', auth.org_id)
    .maybeSingle()
  if (!channel) {
    return NextResponse.json(
      { error: "Canal introuvable pour cette organisation" },
      { status: 404 }
    )
  }

  // Créer le workflow
  const { data: workflow, error: wfError } = await supabase
    .schema('notifications')
    .from('workflows')
    .insert({
      org_id: auth.org_id,
      event_id: body.event_id,
      channel_id: body.channel_id,
      created_by: auth.user_id,
    })
    .select()
    .single()

  if (wfError || !workflow) {
    console.error('Erreur création workflow:', wfError)
    return NextResponse.json({ error: 'Erreur lors de la création du workflow' }, { status: 500 })
  }

  // Créer le step
  const { data: step, error: stepError } = await supabase
    .schema('notifications')
    .from('workflow_steps')
    .insert({
      workflow_id: workflow.id,
      step_order: 1,
      step_type: 'send',
      subject: body.step.subject || null,
      body: body.step.body,
      format: body.step.format || 'text',
    })
    .select()
    .single()

  if (stepError) {
    // Rollback : supprimer le workflow
    await supabase.schema('notifications').from('workflows').delete().eq('id', workflow.id)
    console.error('Erreur création step:', stepError)
    return NextResponse.json({ error: 'Erreur lors de la création du step' }, { status: 500 })
  }

  return NextResponse.json({ workflow: { ...workflow, step } }, { status: 201 })
}
