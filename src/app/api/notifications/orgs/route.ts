/**
 * Déclaration d'une organisation par une app tierce (Storm…).
 *
 * Auth par clé API. L'app envoie son identifiant interne (external_id) + un nom ;
 * le hub crée/met à jour une organisation qu'il POSSÈDE et renvoie son `org_id`
 * (UUID hub). C'est cet org_id que l'app met ensuite dans ses `emit`.
 *
 * Idempotent par (app, external_id) : rappeler l'endpoint met à jour le nom sans
 * créer de doublon. L'org est cloisonnée à l'app de la clé (jamais le body).
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/auth/api-key'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ error: 'API key invalide' }, { status: 401 })
  }

  let body: { external_id?: string; name?: string; slug?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'Champ "name" requis (string)' }, { status: 400 })
  }

  const app = auth.app!
  const supabase = createServiceClient()

  // Upsert idempotent par (app, external_id)
  if (body.external_id) {
    const { data: existing } = await supabase
      .schema('notifications')
      .from('organizations')
      .select('id')
      .eq('app', app)
      .eq('external_id', body.external_id)
      .maybeSingle()

    if (existing) {
      await supabase
        .schema('notifications')
        .from('organizations')
        .update({ name: body.name, slug: body.slug ?? null })
        .eq('id', existing.id)
      return NextResponse.json({ org_id: existing.id, created: false })
    }
  }

  const { data, error } = await supabase
    .schema('notifications')
    .from('organizations')
    .insert({
      app,
      external_id: body.external_id ?? null,
      name: body.name,
      slug: body.slug ?? null,
      source: app,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Erreur création organisation:', error)
    return NextResponse.json({ error: 'Erreur lors de la création de l\'organisation' }, { status: 500 })
  }

  return NextResponse.json({ org_id: data.id, created: true }, { status: 201 })
}
