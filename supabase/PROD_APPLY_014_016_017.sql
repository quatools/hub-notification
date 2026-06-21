-- ============================================================
-- MISE EN PROD — migrations 014 + 016 + 017
-- À exécuter dans l'éditeur SQL du Supabase cloud (projet BAAS prod).
-- Idempotent : réexécutable sans effet de bord.
-- ============================================================

-- ---------- 014 : baas.member.joined → canal email + audience "member" ----------
UPDATE notifications.events
SET supported_channels = array_append(supported_channels, 'email')
WHERE slug = 'baas.member.joined' AND app = 'baas-esport'
  AND NOT ('email' = ANY(supported_channels));

UPDATE notifications.events
SET audiences = array_append(audiences, 'member')
WHERE slug = 'baas.member.joined' AND app = 'baas-esport'
  AND NOT ('member' = ANY(audiences));

-- ---------- 016 : applications & clés API (self-service) ----------
CREATE TABLE IF NOT EXISTS notifications.apps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  owner_user_id  UUID NOT NULL,
  status         TEXT NOT NULL DEFAULT 'trial',
  send_count     INTEGER NOT NULL DEFAULT 0,
  trial_limit    INTEGER NOT NULL DEFAULT 20,
  signing_secret TEXT NOT NULL,
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
  key_hash     TEXT NOT NULL UNIQUE,
  key_prefix   TEXT NOT NULL,
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

-- ---------- 017 : rôles owner/admin sur org_admins ----------
-- org_id peut être un club (public.clubs) OU une org hub → on retire la FK.
ALTER TABLE notifications.org_admins
  DROP CONSTRAINT IF EXISTS org_admins_org_id_fkey;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_admins_role_check') THEN
    ALTER TABLE notifications.org_admins
      ADD CONSTRAINT org_admins_role_check CHECK (role IN ('owner', 'admin'));
  END IF;
END $$;

-- ---------- Vérifications ----------
SELECT 'apps' AS table, count(*) FROM notifications.apps
UNION ALL SELECT 'api_keys', count(*) FROM notifications.api_keys;
SELECT conname FROM pg_constraint WHERE conname = 'org_admins_role_check';
