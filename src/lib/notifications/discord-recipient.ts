import { createServiceClient } from '@/lib/supabase/server'

/**
 * Résout l'ID Discord (snowflake) d'un utilisateur à partir de son compte.
 * Les membres se connectent via Discord, leur ID est donc déjà connu —
 * aucun ID n'est saisi à la main pour un canal MP "membre concerné".
 * Retourne null si l'utilisateur n'a pas lié de compte Discord.
 */
export async function resolveDiscordUserId(userId: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .schema('notifications')
    .rpc('discord_id_for_user', { user_uuid: userId })

  if (error) {
    console.error('Erreur résolution ID Discord:', error)
    return null
  }
  return (data as string | null) || null
}
