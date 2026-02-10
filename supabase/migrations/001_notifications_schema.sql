-- ============================================
-- Quatools Hub Notification - Schema SQL
-- Schéma: notifications
-- Version: 2.0 (workflow-based architecture)
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
-- Inchangé par rapport à v1
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
-- Canaux de notification (org-level ou perso)
-- org_id NOT NULL = canal d'organisation (géré par admin)
-- org_id IS NULL  = canal personnel (géré par le membre)
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
CREATE INDEX IF NOT EXISTS idx_channels_org_id ON notifications.channels(org_id);
CREATE INDEX IF NOT EXISTS idx_channels_user_org ON notifications.channels(user_id, org_id);

CREATE OR REPLACE TRIGGER trg_channels_updated_at
  BEFORE UPDATE ON notifications.channels
  FOR EACH ROW EXECUTE FUNCTION notifications.set_updated_at();

-- ============================================
-- TABLE: notifications.workflows
-- Routes de notification configurées par l'admin
-- Un workflow = événement + canal + activation
-- L'admin peut créer N workflows par événement
-- ============================================
CREATE TABLE IF NOT EXISTS notifications.workflows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL,
  event_id    UUID NOT NULL REFERENCES notifications.events(id) ON DELETE CASCADE,
  channel_id  UUID NOT NULL REFERENCES notifications.channels(id) ON DELETE CASCADE,
  is_active   BOOLEAN DEFAULT true,
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflows_org_event ON notifications.workflows(org_id, event_id);
CREATE INDEX IF NOT EXISTS idx_workflows_channel ON notifications.workflows(channel_id);
CREATE INDEX IF NOT EXISTS idx_workflows_org_active ON notifications.workflows(org_id) WHERE is_active = true;

CREATE OR REPLACE TRIGGER trg_workflows_updated_at
  BEFORE UPDATE ON notifications.workflows
  FOR EACH ROW EXECUTE FUNCTION notifications.set_updated_at();

-- ============================================
-- TABLE: notifications.workflow_steps
-- Étapes d'un workflow
-- Palier 1 : toujours 1 step de type "send"
-- Futur n8n : "wait", "condition", "branch", etc.
-- ============================================
CREATE TABLE IF NOT EXISTS notifications.workflow_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   UUID NOT NULL REFERENCES notifications.workflows(id) ON DELETE CASCADE,
  step_order    INT NOT NULL DEFAULT 1,
  step_type     TEXT NOT NULL DEFAULT 'send' CHECK (step_type IN ('send', 'wait', 'condition')),
  -- Config pour step "send"
  subject       TEXT,
  body          TEXT NOT NULL,
  format        TEXT DEFAULT 'text' CHECK (format IN ('text', 'html', 'markdown')),
  -- Config future (n8n)
  step_config   JSONB,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON notifications.workflow_steps(workflow_id);

CREATE OR REPLACE TRIGGER trg_workflow_steps_updated_at
  BEFORE UPDATE ON notifications.workflow_steps
  FOR EACH ROW EXECUTE FUNCTION notifications.set_updated_at();

-- ============================================
-- TABLE: notifications.user_optouts
-- Opt-out des membres sur des workflows spécifiques
-- ============================================
CREATE TABLE IF NOT EXISTS notifications.user_optouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES notifications.workflows(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, workflow_id)
);

CREATE INDEX IF NOT EXISTS idx_optouts_user ON notifications.user_optouts(user_id);

-- ============================================
-- TABLE: notifications.workflow_executions
-- Logs d'exécution des workflows
-- ============================================
CREATE TABLE IF NOT EXISTS notifications.workflow_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     UUID REFERENCES notifications.workflows(id) ON DELETE SET NULL,
  event_slug      TEXT NOT NULL,
  channel_id      UUID REFERENCES notifications.channels(id) ON DELETE SET NULL,
  user_id         UUID NOT NULL,
  org_id          UUID,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  current_step    INT DEFAULT 1,
  payload         JSONB,
  rendered_content JSONB,
  error_message   TEXT,
  attempts        INT DEFAULT 0,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_executions_org_created ON notifications.workflow_executions(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_user_created ON notifications.workflow_executions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_workflow ON notifications.workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON notifications.workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_event_slug ON notifications.workflow_executions(event_slug);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE notifications.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.user_optouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.workflow_executions ENABLE ROW LEVEL SECURITY;

-- --- EVENTS ---
-- Lecture pour tous les users authentifiés (catalogue public)
CREATE POLICY "events_select_authenticated"
  ON notifications.events FOR SELECT
  TO authenticated
  USING (true);

-- --- CHANNELS ---
-- Un user voit ses propres canaux + les canaux de son org
-- Note: la vérification d'appartenance à l'org se fait côté API (service_role)
-- Pour la RLS on permet de voir ses propres canaux et les canaux des orgs
CREATE POLICY "channels_select_own_or_org"
  ON notifications.channels FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR org_id IS NOT NULL  -- Les canaux d'org sont visibles par les membres (filtré côté API)
  );

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

-- --- WORKFLOWS ---
-- Lecture par tous les authentifiés (filtré par org côté API)
-- Écriture via service_role uniquement (les API admin utilisent service_role)
CREATE POLICY "workflows_select_authenticated"
  ON notifications.workflows FOR SELECT
  TO authenticated
  USING (true);

-- --- WORKFLOW_STEPS ---
-- Même logique que workflows
CREATE POLICY "workflow_steps_select_authenticated"
  ON notifications.workflow_steps FOR SELECT
  TO authenticated
  USING (true);

-- --- USER_OPTOUTS ---
-- CRUD par le propriétaire uniquement
CREATE POLICY "optouts_select_own"
  ON notifications.user_optouts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "optouts_insert_own"
  ON notifications.user_optouts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "optouts_delete_own"
  ON notifications.user_optouts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- --- WORKFLOW_EXECUTIONS ---
-- Un user voit ses propres logs
CREATE POLICY "executions_select_own"
  ON notifications.workflow_executions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- Permissions : exposer le schéma à PostgREST/Supabase
-- ============================================
GRANT USAGE ON SCHEMA notifications TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA notifications TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA notifications TO authenticated;
GRANT INSERT, UPDATE, DELETE ON notifications.channels TO authenticated;
GRANT INSERT, DELETE ON notifications.user_optouts TO authenticated;
