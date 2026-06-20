-- 016_apps_and_keys.sql
-- SELF-SERVICE — Applications & clés API gérées en base.
--
-- Aujourd'hui les clés vivent dans NOTIFICATION_API_KEYS (env), provisionnées
-- à la main par l'opérateur. Pour qu'un développeur tiers (ex. Storm/Laurent)
-- s'intègre SANS l'opérateur, le hub modélise l'« application » et ses clés.
--
-- Garde-fou anti-abus : une app démarre en 'trial' avec un plafond d'envois
-- (send_count/trial_limit) ; l'opérateur la passe 'active' après revue, ou la
-- 'blocked'. Les clés env existantes (baas-esport) restent valides (fallback).
--
-- Deux secrets par app :
--   - clé API  : auth Bearer, stockée HASHÉE (table api_keys.key_hash).
--   - signing_secret : HMAC des link-tokens (lien membre/admin), que le hub
--     doit pouvoir vérifier → stocké tel quel ici (schéma verrouillé service_role).
--
-- Verrouillage RLS + REVOKE comme 013/015 : accès service_role uniquement.

CREATE TABLE IF NOT EXISTS notifications.apps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,            -- identifiant d'app (events.app, cloisonnement)
  name           TEXT NOT NULL,
  owner_user_id  UUID NOT NULL,                   -- auth.users : créateur/propriétaire
  status         TEXT NOT NULL DEFAULT 'trial',   -- 'trial' | 'active' | 'blocked'
  send_count     INTEGER NOT NULL DEFAULT 0,      -- envois réels effectués
  trial_limit    INTEGER NOT NULL DEFAULT 20,     -- plafond d'essai avant revue
  signing_secret TEXT NOT NULL,                   -- secret HMAC des link-tokens
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_apps_owner ON notifications.apps(owner_user_id);

CREATE OR REPLACE TRIGGER trg_apps_updated_at
  BEFORE UPDATE ON notifications.apps
  FOR EACH ROW EXECUTE FUNCTION notifications.set_updated_at();

CREATE TABLE IF NOT EXISTS notifications.api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id       UUID NOT NULL REFERENCES notifications.apps(id) ON DELETE CASCADE,
  key_hash     TEXT NOT NULL UNIQUE,              -- sha256(secret) ; jamais le secret en clair
  key_prefix   TEXT NOT NULL,                     -- ex "storm_a1b2…" pour l'affichage
  label        TEXT,
  created_by   UUID,
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_app  ON notifications.api_keys(app_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON notifications.api_keys(key_hash);

ALTER TABLE notifications.apps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.api_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON notifications.apps     FROM anon, authenticated;
REVOKE ALL ON notifications.api_keys FROM anon, authenticated;
GRANT ALL ON notifications.apps     TO service_role;
GRANT ALL ON notifications.api_keys TO service_role;
