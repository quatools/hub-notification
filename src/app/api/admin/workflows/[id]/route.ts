import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuthForWorkflow } from '@/lib/auth/admin'
import { createServiceClient } from '@/lib/supabase/server'

// PUT /api/admin/workflows/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAdminAuthForWorkflow(id)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  let body: {
    is_active?: boolean
    step?: { subject?: string; body?: string; format?: string }
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Mettre à jour le workflow (is_active)
  if (body.is_active !== undefined) {
    const { error } = await supabase
      .schema('notifications')
      .from('workflows')
      .update({ is_active: body.is_active })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'Erreur lors de la mise à jour du workflow' }, { status: 500 })
    }
  }

  // Mettre à jour le step
  if (body.step) {
    const stepUpdates: Record<string, unknown> = {}
    if (body.step.subject !== undefined) stepUpdates.subject = body.step.subject
    if (body.step.body !== undefined) stepUpdates.body = body.step.body
    if (body.step.format !== undefined) stepUpdates.format = body.step.format

    if (Object.keys(stepUpdates).length > 0) {
      // Trouver le step du workflow (premier par step_order)
      const { data: steps } = await supabase
        .schema('notifications')
        .from('workflow_steps')
        .select('id')
        .eq('workflow_id', id)
        .order('step_order', { ascending: true })
        .limit(1)

      if (steps && steps.length > 0) {
        const { error } = await supabase
          .schema('notifications')
          .from('workflow_steps')
          .update(stepUpdates)
          .eq('id', steps[0].id)

        if (error) {
          return NextResponse.json({ error: 'Erreur lors de la mise à jour du step' }, { status: 500 })
        }
      }
    }
  }

  // Retourner le workflow mis à jour
  const { data: updated } = await supabase
    .schema('notifications')
    .from('workflows')
    .select(`
      *,
      workflow_steps (id, subject, body, format, step_order)
    `)
    .eq('id', id)
    .single()

  return NextResponse.json({ workflow: updated })
}

// DELETE /api/admin/workflows/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAdminAuthForWorkflow(id)
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .schema('notifications')
    .from('workflows')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
