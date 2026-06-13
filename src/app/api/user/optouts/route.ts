import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveRecipient } from '@/lib/notifications/recipients'

// GET /api/user/optouts?org_id=xxx
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get('org_id')
  if (!orgId) {
    return NextResponse.json({ error: 'org_id requis' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Charger les workflows actifs de l'org dont les events ont audience "member"
  const { data: workflows, error } = await supabase
    .schema('notifications')
    .from('workflows')
    .select(`
      id,
      events:event_id (
        label,
        category,
        audiences
      ),
      channels:channel_id (
        type,
        label
      )
    `)
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (error) {
    return NextResponse.json({ error: 'Erreur lors du chargement' }, { status: 500 })
  }

  // Filtrer les workflows dont l'event a audience "member"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberWorkflows = (workflows || []).filter((wf: any) => {
    const event = wf.events
    return event && Array.isArray(event.audiences) && event.audiences.includes('member')
  })

  // Charger les opt-outs de l'utilisateur
  const workflowIds = memberWorkflows.map((wf) => wf.id)
  let optoutSet = new Set<string>()

  if (workflowIds.length > 0) {
    const { data: optouts } = await supabase
      .schema('notifications')
      .from('user_optouts')
      .select('workflow_id')
      .eq('user_id', user.id)
      .in('workflow_id', workflowIds)

    if (optouts) {
      optoutSet = new Set(optouts.map((o) => o.workflow_id))
    }
  }

  // Formater la réponse
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = memberWorkflows.map((wf: any) => ({
    workflow_id: wf.id,
    event_label: wf.events?.label || '',
    event_category: wf.events?.category || '',
    channel_type: wf.channels?.type || '',
    channel_label: wf.channels?.label || null,
    is_opted_out: optoutSet.has(wf.id),
  }))

  return NextResponse.json({ workflows: result })
}

// PUT /api/user/optouts
export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  let body: { workflow_id: string; opted_out: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  if (!body.workflow_id || typeof body.opted_out !== 'boolean') {
    return NextResponse.json({ error: 'workflow_id et opted_out requis' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Vérifier que le workflow existe et est actif
  const { data: workflow } = await supabase
    .schema('notifications')
    .from('workflows')
    .select('id')
    .eq('id', body.workflow_id)
    .eq('is_active', true)
    .single()

  if (!workflow) {
    return NextResponse.json({ error: 'Workflow introuvable' }, { status: 404 })
  }

  if (body.opted_out) {
    // Fiche destinataire canonique de l'utilisateur connecté : c'est par
    // recipient_id que le routage applique le refus (cohérent multi-apps).
    let recipientId: string | null = null
    try {
      recipientId = (await resolveRecipient({ authUserId: user.id })).recipientId
    } catch {
      recipientId = null
    }

    // Créer l'opt-out
    const { error } = await supabase
      .schema('notifications')
      .from('user_optouts')
      .upsert({
        user_id: user.id,
        workflow_id: body.workflow_id,
        recipient_id: recipientId,
      }, { onConflict: 'user_id,workflow_id' })

    if (error) {
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }
  } else {
    // Supprimer l'opt-out
    const { error } = await supabase
      .schema('notifications')
      .from('user_optouts')
      .delete()
      .eq('user_id', user.id)
      .eq('workflow_id', body.workflow_id)

    if (error) {
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
