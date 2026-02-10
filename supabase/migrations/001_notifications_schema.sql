-- ============================================
-- Quatools Hub Notification - Schema SQL
-- Schéma: notifications
-- ============================================

-- 1. Créer le schéma
CREATE SCHEMA IF NOT EXISTS notifications;

-- 2. Fonction utilitaire updated_at
CREATE OR REPLACE FUNCTION notifications.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TABLE: notifications.events
-- Catalogue des événements déclarés par les apps
-- ============================================
CREATE TABLE IF NOT EXISTS notifications.events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app             TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  label           TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL,
  supported_channels TEXT[] NOT NULL,
  audiences       TEXT[] NOT NULL,
  default_active  BOOLEAN DEFAULT false,
  payload_schema  JSONB,
  is_active       BOOLEAN DEFAULT true,
  deprecated_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_app ON notifications.events(app);
CREATE INDEX IF NOT EXISTS idx_events_category ON notifications.events(category);
CREATE INDEX IF NOT EXISTS idx_events_slug ON notifications.events(slug);

CREATE OR REPLACE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON notifications.events
  FOR EACH ROW EXECUTE FUNCTION notifications.set_updated_at();

-- ============================================
-- TABLE: notifications.channels
-- Canaux de notification configurés par les users
-- ============================================
CREATE TABLE IF NOT EXISTS notifications.channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID,
  type        TEXT NOT NULL CHECK (type IN ('email', 'discord_webhook', 'discord_dm', 'sms')),
  label       TEXT,
  config      JSONB NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channels_user_id ON notifications.channels(user_id);
CREATE INDEX IF NOT EXISTS idx_channels_user_org ON notifications.channels(user_id, org_id);

CREATE OR REPLACE TRIGGER trg_channels_updated_at
  BEFORE UPDATE ON notifications.channels
  FOR EACH ROW EXECUTE FUNCTION notifications.set_updated_at();

-- ============================================
-- TABLE: notifications.preferences
-- Table de routage user × event × channel
-- ============================================
CREATE TABLE IF NOT EXISTS notifications.preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID,
  event_id    UUID NOT NULL REFERENCES notifications.events(id) ON DELETE CASCADE,
  channel_id  UUID NOT NULL REFERENCES notifications.channels(id) ON DELETE CASCADE,
  is_active   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, org_id, event_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_preferences_user_org ON notifications.preferences(user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_preferences_event ON notifications.preferences(event_id);

CREATE OR REPLACE TRIGGER trg_preferences_updated_at
  BEFORE UPDATE ON notifications.preferences
  FOR EACH ROW EXECUTE FUNCTION notifications.set_updated_at();

-- ============================================
-- TABLE: notifications.logs
-- Historique des notifications envoyées
-- ============================================
CREATE TABLE IF NOT EXISTS notifications.logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_slug        TEXT NOT NULL,
  event_id          UUID REFERENCES notifications.events(id) ON DELETE SET NULL,
  channel_id        UUID REFERENCES notifications.channels(id) ON DELETE SET NULL,
  user_id           UUID NOT NULL,
  org_id            UUID,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  payload           JSONB,
  rendered_content  JSONB,
  error_message     TEXT,
  attempts          INT DEFAULT 0,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_user_created ON notifications.logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_status ON notifications.logs(status);
CREATE INDEX IF NOT EXISTS idx_logs_event_slug ON notifications.logs(event_slug);

-- ============================================
-- TABLE: notifications.templates
-- Templates de messages par event × channel_type
-- ============================================
CREATE TABLE IF NOT EXISTS notifications.templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES notifications.events(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  subject      TEXT,
  body         TEXT NOT NULL,
  format       TEXT DEFAULT 'text' CHECK (format IN ('text', 'html', 'markdown')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, channel_type)
);

CREATE OR REPLACE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON notifications.templates
  FOR EACH ROW EXECUTE FUNCTION notifications.set_updated_at();

-- ============================================
-- RLS (Row Level Security)
-- ============================================

-- Activer RLS sur toutes les tables
ALTER TABLE notifications.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.templates ENABLE ROW LEVEL SECURITY;

-- --- EVENTS ---
-- Lecture pour les users authentifiés (catalogue public)
CREATE POLICY "events_select_authenticated"
  ON notifications.events FOR SELECT
  TO authenticated
  USING (true);

-- --- CHANNELS ---
CREATE POLICY "channels_select_own"
  ON notifications.channels FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "channels_insert_own"
  ON notifications.channels FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "channels_update_own"
  ON notifications.channels FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "channels_delete_own"
  ON notifications.channels FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- --- PREFERENCES ---
CREATE POLICY "preferences_select_own"
  ON notifications.preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "preferences_insert_own"
  ON notifications.preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "preferences_update_own"
  ON notifications.preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "preferences_delete_own"
  ON notifications.preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- --- LOGS ---
CREATE POLICY "logs_select_own"
  ON notifications.logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- --- TEMPLATES ---
CREATE POLICY "templates_select_authenticated"
  ON notifications.templates FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- Permissions : exposer le schéma à PostgREST/Supabase
-- ============================================
GRANT USAGE ON SCHEMA notifications TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA notifications TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA notifications TO authenticated;
GRANT INSERT, UPDATE, DELETE ON notifications.channels TO authenticated;
GRANT INSERT, UPDATE, DELETE ON notifications.preferences TO authenticated;
