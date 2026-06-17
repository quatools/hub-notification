import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Client Supabase navigateur, créé paresseusement en singleton.
 * Sûr à appeler pendant le rendu : l'instanciation ne touche pas aux cookies
 * (lecture différée aux appels d'auth, côté client uniquement).
 */
export function createClient(): SupabaseClient {
  if (client) return client
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return client
}
