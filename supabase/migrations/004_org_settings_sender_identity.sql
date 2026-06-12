-- ============================================
-- Marque blanche : identité d'expéditeur par organisation
--
-- Niveau 1 (actif) : nom d'affichage + Reply-To.
--   Email  : From "Club Démo" <notifications@quatools.fr>, Reply-To contact@monclub.fr
--   Discord: username du webhook = nom de l'organisation
--
-- Niveau 2 (préparé, non exploité) : domaine d'envoi propre par org.
--   Quand domain_status = 'verified', le From devient
--   <sender_local_part>@<sender_domain> (ex: notifications@monclub.fr).
--   La vérification (Scaleway TEM API + DNS SPF/DKIM) sera implémentée plus tard.
-- ============================================

CREATE TABLE IF NOT EXISTS notifications.org_settings (
  org_id            UUID PRIMARY KEY,
  -- Niveau 1 : identité d'affichage
  sender_name       TEXT,                          -- "Club Démo"
  reply_to          TEXT,                          -- "contact@monclub.fr"
  -- Niveau 2 : domaine d'envoi dédié (futur)
  sender_domain     TEXT,                          -- "monclub.fr"
  sender_local_part TEXT DEFAULT 'notifications',  -- partie locale du From
  domain_status     TEXT NOT NULL DEFAULT 'unconfigured'
                    CHECK (domain_status IN ('unconfigured', 'pending', 'verified', 'failed')),
  domain_provider_id TEXT,                         -- id du domaine chez le provider (Scaleway TEM)
  domain_dns_records JSONB,                        -- enregistrements DNS à poser (cache pour l'UI)
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_org_settings_updated_at
  BEFORE UPDATE ON notifications.org_settings
  FOR EACH ROW EXECUTE FUNCTION notifications.set_updated_at();

ALTER TABLE notifications.org_settings ENABLE ROW LEVEL SECURITY;

-- Lecture pour les authentifiés (le filtrage org/admin se fait côté API service_role)
CREATE POLICY "org_settings_select_authenticated"
  ON notifications.org_settings FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON notifications.org_settings TO authenticated;
GRANT ALL ON notifications.org_settings TO service_role;
