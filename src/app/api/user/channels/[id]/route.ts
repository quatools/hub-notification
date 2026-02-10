import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

// DELETE /api/user/channels/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  // Vérifier que c'est bien un canal perso de l'utilisateur
  const { data: channel } = await supabase
    .schema('notifications')
    .from('channels')
    .select('user_id, org_id')
    .eq('id', id)
    .single()

  if (!channel || channel.user_id !== user.id || channel.org_id !== null) {
    return NextResponse.json({ error: 'Canal introuvable ou non autorisé' }, { status: 404 })
  }

  const { error } = await supabase
    .schema('notifications')
    .from('channels')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
