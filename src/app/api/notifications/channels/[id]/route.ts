import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id } = await params

  let body: { label?: string; config?: Record<string, unknown>; is_active?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const supabase = await createClient()

  // Construire l'update
  const update: Record<string, unknown> = {}
  if (body.label !== undefined) update.label = body.label
  if (body.is_active !== undefined) update.is_active = body.is_active
  if (body.config !== undefined) {
    update.config = body.config
    // Re-vérifier si la config change (simplifié : on garde is_verified à true)
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  const { data: channel, error } = await supabase
    .schema('notifications')
    .from('channels')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Erreur PUT channels:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }

  return NextResponse.json({ channel })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createClient()

  // RLS + ON DELETE CASCADE gère la suppression des préférences liées
  const { error } = await supabase
    .schema('notifications')
    .from('channels')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erreur DELETE channels:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
