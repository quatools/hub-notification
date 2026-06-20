-- 015_org_ownership.sql
-- DÉCOUPLAGE — Le hub possède ses propres organisations + droits admin.
--
-- Aujourd'hui le hub emprunte la notion d'organisation au BAAS
-- (public.clubs / public.club_admins). Pour accueillir des apps tierces (Storm…)
-- dont les organisations NE sont PAS des clubs esport, on donne au hub ses
-- propres tables. La lecture des droits se fait en UNION côté application :
--   admin  = club_admins (BAAS)  OU  org_admins (hub)
--   noms   = clubs (BAAS)        OU  organizations (hub)
-- Aucune donnée du BAAS n'est migrée → l'existant ne bouge pas. Tout est additif.
--
-- Sécurité : RLS + REVOKE, accès par service_role uniquement (cohérent avec 013).

-- 1. Organisations propres au hub. L'`id` (UUID) EST l'org_id utilisé par l'app
--    dans ses emit/workflows — le hub le génère et le renvoie à l'app.
CREATE TABLE IF NOT EXISTS notifications.organizations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app          TEXT NOT NULL,                 -- app propriétaire (clé de NOTIFICATION_API_KEYS)
  external_id  TEXT,                          -- id interne de l'app (idempotence de l'upsert)
  name         TEXT NOT NULL,
  slug         TEXT,
  source       TEXT NOT NULL DEFAULT 'app',   -- 'app' | 'baas' | …
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Upsert idempotent par (app, external_id)
CREATE UNIQUE INDEX IF NOT EXISTS ux_organizations_app_external
  ON notifications.organizations(app, external_id) WHERE external_id IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON notifications.organizations
  FOR EACH ROW EXECUTE FUNCTION notifications.set_updated_at();

-- 2. Droits admin propres au hub (ne contient QUE des orgs hub ; les droits sur
--    les clubs BAAS restent dans public.club_admins).
CREATE TABLE IF NOT EXISTS notifications.org_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES notifications.organizations(id) ON DELETE CASCADE,
  auth_user_id  UUID NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_org_admins_org_user
  ON notifications.org_admins(org_id, auth_user_id);
CREATE INDEX IF NOT EXISTS idx_org_admins_user
  ON notifications.org_admins(auth_user_id);

-- 3. Verrouillage (comme 013) : aucun accès direct anon/authenticated.
ALTER TABLE notifications.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.org_admins    ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON notifications.organizations FROM anon, authenticated;
REVOKE ALL ON notifications.org_admins    FROM anon, authenticated;
GRANT ALL ON notifications.organizations TO service_role;
GRANT ALL ON notifications.org_admins    TO service_role;
