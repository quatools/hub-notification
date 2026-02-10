import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/auth/api-key'
import { createServiceClient } from '@/lib/supabase/server'
import type { RegisterRequest, RegisterResponse } from '@/lib/types/notifications'

export async function POST(request: NextRequest) {
  // 1. Auth par API key
  const auth = validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ error: 'API key invalide' }, { status: 401 })
  }

  // 2. Parser le body
  let body: RegisterRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  // 3. Validation
  if (!body.app || typeof body.app !== 'string') {
    return NextResponse.json({ error: 'Champ "app" requis (string)' }, { status: 400 })
  }
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ error: 'Champ "events" requis (array non vide)' }, { status: 400 })
  }

  for (const event of body.events) {
    if (!event.slug || !event.label || !event.category) {
      return NextResponse.json(
        { error: `Event invalide: slug, label et category sont requis. Reçu: ${JSON.stringify(event)}` },
        { status: 400 }
      )
    }
    if (!Array.isArray(event.supported_channels) || event.supported_channels.length === 0) {
      return NextResponse.json(
        { error: `Event "${event.slug}": supported_channels requis (array non vide)` },
        { status: 400 }
      )
    }
    if (!Array.isArray(event.audiences) || event.audiences.length === 0) {
      return NextResponse.json(
        { error: `Event "${event.slug}": audiences requis (array non vide)` },
        { status: 400 }
      )
    }
  }

  // 4. Upsert des events
  const supabase = createServiceClient()

  let newCount = 0
  let updatedCount = 0

  try {
    for (const event of body.events) {
      // Vérifier si l'event existe déjà
      const { data: existing } = await supabase
        .schema('notifications')
        .from('events')
        .select('id')
        .eq('slug', event.slug)
        .single()

      if (existing) {
        // UPDATE
        const { error } = await supabase
          .schema('notifications')
          .from('events')
          .update({
            app: body.app,
            label: event.label,
            description: event.description || null,
            category: event.category,
            supported_channels: event.supported_channels,
            audiences: event.audiences,
            default_active: event.default_active ?? false,
            payload_schema: event.payload_schema || null,
            is_active: true,
            deprecated_at: null,
          })
          .eq('slug', event.slug)

        if (error) throw error
        updatedCount++
      } else {
        // INSERT
        const { error } = await supabase
          .schema('notifications')
          .from('events')
          .insert({
            app: body.app,
            slug: event.slug,
            label: event.label,
            description: event.description || null,
            category: event.category,
            supported_channels: event.supported_channels,
            audiences: event.audiences,
            default_active: event.default_active ?? false,
            payload_schema: event.payload_schema || null,
          })

        if (error) throw error
        newCount++
      }
    }

    const response: RegisterResponse = {
      registered: body.events.length,
      updated: updatedCount,
      new: newCount,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Erreur register:', error)
    return NextResponse.json(
      { error: 'Erreur interne lors de l\'enregistrement des événements' },
      { status: 500 }
    )
  }
}
