-- ============================================
-- Résolution de l'ID Discord d'un membre.
-- Les membres se connectent via Discord (OAuth Supabase) : leur ID Discord
-- est dans auth.identities (provider='discord'). Le canal MP "membre concerné"
-- s'en sert pour envoyer un message privé sans qu'aucun ID soit saisi à la main.
--
-- SECURITY DEFINER : auth.identities n'est pas exposé à PostgREST ; cette
-- fonction encapsule un accès minimal (mapping user_id -> snowflake Discord).
-- ============================================

CREATE OR REPLACE FUNCTION notifications.discord_id_for_user(user_uuid uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT provider_id
  FROM auth.identities
  WHERE user_id = user_uuid
    AND provider = 'discord'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION notifications.discord_id_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION notifications.discord_id_for_user(uuid) TO service_role;
