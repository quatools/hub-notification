-- ============================================================
-- Quatools Hub Notification — Installation PROD (schéma notifications)
-- À exécuter UNE FOIS dans l'éditeur SQL de ton Supabase de production.
-- Concatène les migrations 001 → 011 dans l'ordre.
-- Après : exposer le schéma 'notifications' dans Settings → API → Exposed schemas.
-- ============================================================


-- ===== 001_notifications_schema.sql =====
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


-- ===== 002_seed_baas_events.sql =====
-- ============================================
-- Seed: Événements BAAS Esport
-- À exécuter APRÈS 001_notifications_schema.sql
--
-- Note: Les templates ne sont plus seedés ici.
-- Ils sont créés par l'admin via l'UI quand il
-- configure ses workflows (routes).
-- Des templates par défaut sont proposés côté code.
-- ============================================

INSERT INTO notifications.events (app, slug, label, description, category, supported_channels, audiences, default_active, payload_schema)
VALUES
  ('baas-esport', 'baas.subscription.created', 'Nouvel abonnement',
   'Un membre vient de souscrire à un abonnement', 'billing',
   ARRAY['email', 'discord_webhook'], ARRAY['admin', 'member'], true,
   '{"member_name":"string","plan_name":"string","amount":"number","club_name":"string"}'::jsonb),

  ('baas-esport', 'baas.subscription.canceled', 'Abonnement annulé',
   'Un membre a annulé son abonnement', 'billing',
   ARRAY['email', 'discord_webhook'], ARRAY['admin', 'member'], true,
   '{"member_name":"string","plan_name":"string","club_name":"string","reason":"string"}'::jsonb),

  ('baas-esport', 'baas.payment.succeeded', 'Paiement réussi',
   'Un paiement a été encaissé avec succès', 'billing',
   ARRAY['email', 'discord_webhook'], ARRAY['admin', 'member'], false,
   '{"member_name":"string","amount":"number","plan_name":"string"}'::jsonb),

  ('baas-esport', 'baas.payment.failed', 'Paiement échoué',
   'Un paiement a échoué', 'billing',
   ARRAY['email', 'discord_webhook'], ARRAY['admin'], true,
   '{"member_name":"string","amount":"number","error_reason":"string"}'::jsonb),

  ('baas-esport', 'baas.member.joined', 'Nouveau membre',
   'Un nouveau membre a rejoint le club', 'member',
   ARRAY['discord_webhook'], ARRAY['admin'], true,
   '{"member_name":"string","email":"string","club_name":"string"}'::jsonb),

  ('baas-esport', 'baas.member.profile_updated', 'Profil mis à jour',
   'Un membre a mis à jour son profil', 'member',
   ARRAY['discord_webhook'], ARRAY['admin'], false,
   '{"member_name":"string","updated_fields":"string"}'::jsonb),

  ('baas-esport', 'baas.team.member_assigned', 'Membre assigné à une équipe',
   'Un membre a été assigné à une équipe', 'team',
   ARRAY['discord_webhook'], ARRAY['admin'], true,
   '{"member_name":"string","team_name":"string"}'::jsonb),

  ('baas-esport', 'baas.team.complete', 'Équipe au complet',
   'Une équipe a atteint son nombre maximum de membres', 'team',
   ARRAY['discord_webhook'], ARRAY['admin'], true,
   '{"team_name":"string","member_count":"number"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  supported_channels = EXCLUDED.supported_channels,
  audiences = EXCLUDED.audiences,
  default_active = EXCLUDED.default_active,
  payload_schema = EXCLUDED.payload_schema,
  is_active = true,
  deprecated_at = NULL;


-- ===== 003_seed_baas_preorder_events.sql =====
-- ============================================
-- Seed: Événements BAAS Esport — Préventes, commandes & impayés
-- À exécuter APRÈS 002_seed_baas_events.sql
--
-- Ces événements sont déjà émis par le BAAS (lib/preorders,
-- webhooks Stripe, handlers MCP) mais n'étaient pas déclarés
-- dans le catalogue : chaque emit retournait 404.
-- Les payload_schema reflètent les champs réellement envoyés.
-- ============================================

INSERT INTO notifications.events (app, slug, label, description, category, supported_channels, audiences, default_active, payload_schema)
VALUES
  -- --- PRÉVENTES (shop) ---
  ('baas-esport', 'baas.preorder.signup.created', 'Nouvelle inscription prévente',
   'Un fan s''est inscrit à une campagne de prévente (tous modes : total, empreinte, acompte, waitlist)', 'shop',
   ARRAY['email', 'discord_webhook'], ARRAY['admin'], true,
   '{"signup_id":"string","campaign_id":"string","product_name":"string","variant_name":"string","mode":"string","offer_name":"string","fan_email":"string","fan_name":"string","tracking_url":"string"}'::jsonb),

  ('baas-esport', 'baas.preorder.confirmed', 'Prévente confirmée',
   'Le paiement d''une prévente a été encaissé, la commande est confirmée', 'shop',
   ARRAY['email', 'discord_webhook'], ARRAY['admin'], true,
   '{"signup_id":"string","campaign_id":"string","product_name":"string","variant_name":"string","mode":"string","amount_charged_cents":"number","fan_email":"string","fan_name":"string","tracking_url":"string"}'::jsonb),

  ('baas-esport', 'baas.preorder.setup.saved', 'Empreinte bancaire enregistrée',
   'Un fan a enregistré son moyen de paiement (mode empreinte, débit à la confirmation)', 'shop',
   ARRAY['email', 'discord_webhook'], ARRAY['admin'], false,
   '{"signup_id":"string","campaign_id":"string","product_name":"string","variant_name":"string","mode":"string","offer_name":"string","total_to_charge_cents":"number","tracking_url":"string"}'::jsonb),

  ('baas-esport', 'baas.preorder.deposit.paid', 'Acompte payé',
   'Un fan a payé l''acompte d''une prévente (solde à prélever à la confirmation)', 'shop',
   ARRAY['email', 'discord_webhook'], ARRAY['admin'], true,
   '{"signup_id":"string","campaign_id":"string","product_name":"string","variant_name":"string","mode":"string","offer_name":"string","deposit_percentage":"number","deposit_amount_cents":"number","remaining_amount_cents":"number","tracking_url":"string"}'::jsonb),

  ('baas-esport', 'baas.preorder.final.failed', 'Échec du prélèvement final',
   'Le prélèvement du solde d''une prévente a échoué (empreinte ou acompte)', 'shop',
   ARRAY['email', 'discord_webhook'], ARRAY['admin'], true,
   '{"signup_id":"string","campaign_id":"string","amount_cents":"number","failure_reason":"string","fan_email":"string"}'::jsonb),

  ('baas-esport', 'baas.preorder.waitlist.opened', 'Liste d''attente ouverte',
   'Des fans en liste d''attente ont été invités à finaliser leur commande', 'shop',
   ARRAY['email', 'discord_webhook'], ARRAY['admin'], false,
   '{"signup_id":"string","campaign_id":"string","product_name":"string","offer_name":"string","fan_email":"string","fan_name":"string","checkout_url":"string","tracking_url":"string"}'::jsonb),

  ('baas-esport', 'baas.preorder.canceled.by_club', 'Prévente annulée par le club',
   'Le club a annulé une inscription de prévente (remboursement éventuel)', 'shop',
   ARRAY['email', 'discord_webhook'], ARRAY['admin'], false,
   '{"signup_id":"string","campaign_id":"string","order_id":"string","fan_email":"string","fan_name":"string","refund_amount_cents":"number"}'::jsonb),

  ('baas-esport', 'baas.preorder.canceled.by_fan', 'Prévente annulée par le fan',
   'Un fan a annulé son inscription de prévente', 'shop',
   ARRAY['email', 'discord_webhook'], ARRAY['admin'], true,
   '{"signup_id":"string","campaign_id":"string","refund_amount_cents":"number","was_refundable":"boolean"}'::jsonb),

  ('baas-esport', 'baas.preorder.refunded', 'Prévente remboursée',
   'Un remboursement de prévente a été effectué (initié par le club ou le fan)', 'shop',
   ARRAY['email', 'discord_webhook'], ARRAY['admin'], true,
   '{"signup_id":"string","order_id":"string","amount_cents":"number","initiated_by":"string","refund_id":"string","fan_email":"string"}'::jsonb),

  ('baas-esport', 'baas.order.refunded', 'Commande remboursée',
   'Une commande boutique (hors prévente) a été remboursée', 'shop',
   ARRAY['email', 'discord_webhook'], ARRAY['admin'], true,
   '{"order_id":"string","amount_cents":"number","refund_id":"string","initiated_by":"string","fan_email":"string"}'::jsonb),

  -- --- FACTURATION (billing) ---
  ('baas-esport', 'baas.payment.unpaid', 'Abonnement impayé',
   'Un abonnement est passé en impayé après épuisement des relances Stripe', 'billing',
   ARRAY['email', 'discord_webhook'], ARRAY['admin'], true,
   '{"member_name":"string","plan_name":"string","club_name":"string","reason":"string"}'::jsonb)

ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  supported_channels = EXCLUDED.supported_channels,
  audiences = EXCLUDED.audiences,
  default_active = EXCLUDED.default_active,
  payload_schema = EXCLUDED.payload_schema,
  is_active = true,
  deprecated_at = NULL,
  updated_at = now();


-- ===== 004_org_settings_sender_identity.sql =====
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


-- ===== 005_executions_is_test.sql =====
-- ============================================
-- Journalisation des envois de test.
-- Les tests (bouton "Tester" UI, tool MCP test_workflow) sont désormais
-- enregistrés dans workflow_executions avec is_test = true, pour le debug
-- et la traçabilité, sans polluer les stats de production (filtrer dessus).
-- ============================================

ALTER TABLE notifications.workflow_executions
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;


-- ===== 006_events_support_discord_dm.sql =====
-- ============================================
-- Canal MP Discord (bot Notify).
-- Tout événement qui supporte le webhook Discord supporte aussi le MP :
-- même contenu, autre destination.
-- ============================================

UPDATE notifications.events
SET supported_channels = array_append(supported_channels, 'discord_dm')
WHERE 'discord_webhook' = ANY(supported_channels)
  AND NOT ('discord_dm' = ANY(supported_channels));


-- ===== 007_discord_id_resolver.sql =====
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


-- ===== 008_recipients_identity.sql =====
-- ============================================
-- CDC v2 — Lot 1 : Destinataires & graphe d'identités
--
-- Couche "personne canonique" du hub, dans le MÊME Supabase partagé.
-- - recipients : la personne (destinataire et/ou admin), ancrée sur auth.users
--   quand elle s'est connectée (auth_user_id), sinon "flottante".
-- - recipient_identities : graphe d'identités. Clés = app:external_id et discord.
--   L'email est un INDICE (is_key=false), JAMAIS une clé de fusion.
--
-- Tout est additif : aucune colonne existante n'est supprimée ni renommée.
-- ============================================

-- 1. Personne canonique
CREATE TABLE IF NOT EXISTS notifications.recipients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name  TEXT,
  locale        TEXT DEFAULT 'fr',
  is_claimed    BOOLEAN NOT NULL DEFAULT false,   -- true dès qu'une personne s'est connectée
  auth_user_id  UUID UNIQUE,                      -- lien auth.users (nullable, NULLs multiples autorisés)
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_recipients_updated_at
  BEFORE UPDATE ON notifications.recipients
  FOR EACH ROW EXECUTE FUNCTION notifications.set_updated_at();

-- 2. Graphe d'identités
CREATE TABLE IF NOT EXISTS notifications.recipient_identities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES notifications.recipients(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('app', 'discord', 'email', 'phone')),
  app           TEXT,                  -- requis si kind='app' (ex: 'baas-esport')
  value         TEXT NOT NULL,         -- external_id / discord_id / email selon kind
  is_verified   BOOLEAN DEFAULT false,
  is_key        BOOLEAN NOT NULL DEFAULT true,  -- false pour email/phone (indice, jamais clé)
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipient_identities_recipient
  ON notifications.recipient_identities(recipient_id);

-- Lookups rapides par valeur (app/discord/email)
CREATE INDEX IF NOT EXISTS idx_recipient_identities_lookup
  ON notifications.recipient_identities(kind, app, value);

-- Unicité UNIQUEMENT pour les identités "clés" (app, discord) : une identité-clé
-- = une seule personne. Les emails (is_key=false) ne sont PAS contraints → deux
-- personnes peuvent partager un email-indice sans fusion forcée.
CREATE UNIQUE INDEX IF NOT EXISTS ux_recipient_identities_key
  ON notifications.recipient_identities(kind, COALESCE(app, ''), value)
  WHERE is_key = true;

-- 3. Rattachement additif des tables existantes (nullable, le temps de la transition)
ALTER TABLE notifications.channels
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES notifications.recipients(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_channels_recipient ON notifications.channels(recipient_id);

ALTER TABLE notifications.user_optouts
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES notifications.recipients(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_optouts_recipient ON notifications.user_optouts(recipient_id);

ALTER TABLE notifications.workflow_executions
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES notifications.recipients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_executions_recipient ON notifications.workflow_executions(recipient_id);

-- 4. RLS
ALTER TABLE notifications.recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.recipient_identities ENABLE ROW LEVEL SECURITY;

-- Une personne authentifiée voit son propre recipient + ses identités
CREATE POLICY "recipients_select_own"
  ON notifications.recipients FOR SELECT TO authenticated
  USING (auth.uid() = auth_user_id);

CREATE POLICY "recipient_identities_select_own"
  ON notifications.recipient_identities FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM notifications.recipients r
    WHERE r.id = recipient_identities.recipient_id AND r.auth_user_id = auth.uid()
  ));

-- 5. Permissions
GRANT SELECT ON notifications.recipients TO authenticated;
GRANT SELECT ON notifications.recipient_identities TO authenticated;
GRANT ALL ON notifications.recipients TO service_role;
GRANT ALL ON notifications.recipient_identities TO service_role;

-- ============================================
-- 6. BACKFILL : créer une personne pour chaque auth.users ayant utilisé le hub
-- ============================================

-- 6a. Personnes depuis les user_id présents dans les tables existantes
INSERT INTO notifications.recipients (auth_user_id, is_claimed)
SELECT DISTINCT uid, true
FROM (
  SELECT user_id AS uid FROM notifications.channels WHERE user_id IS NOT NULL
  UNION
  SELECT user_id FROM notifications.user_optouts WHERE user_id IS NOT NULL
  UNION
  SELECT user_id FROM notifications.workflow_executions WHERE user_id IS NOT NULL
) s
WHERE uid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM notifications.recipients r WHERE r.auth_user_id = s.uid);

-- 6b. Identité Discord (clé) pour chaque personne backfillée
INSERT INTO notifications.recipient_identities (recipient_id, kind, value, is_key, is_verified)
SELECT r.id, 'discord', notifications.discord_id_for_user(r.auth_user_id), true, true
FROM notifications.recipients r
WHERE r.auth_user_id IS NOT NULL
  AND notifications.discord_id_for_user(r.auth_user_id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notifications.recipient_identities ri
    WHERE ri.kind = 'discord'
      AND ri.value = notifications.discord_id_for_user(r.auth_user_id)
  );

-- 6c. Reporter recipient_id sur les tables existantes
UPDATE notifications.channels c
  SET recipient_id = r.id
  FROM notifications.recipients r
  WHERE r.auth_user_id = c.user_id AND c.recipient_id IS NULL;

UPDATE notifications.user_optouts o
  SET recipient_id = r.id
  FROM notifications.recipients r
  WHERE r.auth_user_id = o.user_id AND o.recipient_id IS NULL;

UPDATE notifications.workflow_executions e
  SET recipient_id = r.id
  FROM notifications.recipients r
  WHERE r.auth_user_id = e.user_id AND e.recipient_id IS NULL;


-- ===== 009_merge_recipients.sql =====
-- ============================================
-- CDC v2 — Fusion de fiches destinataires (rattachement).
-- Quand un membre relie son compte d'app à son compte hub, on fusionne la fiche
-- "flottante" (créée aux emits) dans sa personne canonique (ancrée auth.users).
-- Déplace identités / canaux / opt-outs / exécutions, puis supprime la fiche absorbée.
-- ============================================

CREATE OR REPLACE FUNCTION notifications.merge_recipients(keep_id uuid, drop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = notifications
AS $$
BEGIN
  IF keep_id = drop_id OR keep_id IS NULL OR drop_id IS NULL THEN
    RETURN;
  END IF;

  -- Identités : déplacer celles qui n'existent pas déjà sur keep, supprimer le reste
  UPDATE notifications.recipient_identities di
    SET recipient_id = keep_id
    WHERE di.recipient_id = drop_id
      AND NOT EXISTS (
        SELECT 1 FROM notifications.recipient_identities k
        WHERE k.recipient_id = keep_id
          AND k.kind = di.kind
          AND COALESCE(k.app, '') = COALESCE(di.app, '')
          AND k.value = di.value
      );
  DELETE FROM notifications.recipient_identities WHERE recipient_id = drop_id;

  -- Données rattachées
  UPDATE notifications.channels            SET recipient_id = keep_id WHERE recipient_id = drop_id;
  UPDATE notifications.user_optouts        SET recipient_id = keep_id WHERE recipient_id = drop_id;
  UPDATE notifications.workflow_executions SET recipient_id = keep_id WHERE recipient_id = drop_id;

  -- Supprimer la fiche absorbée
  DELETE FROM notifications.recipients WHERE id = drop_id;
END;
$$;

REVOKE ALL ON FUNCTION notifications.merge_recipients(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION notifications.merge_recipients(uuid, uuid) TO service_role;


-- ===== 010_execution_destination.sql =====
-- Adresse de livraison résolue par exécution (email / id Discord), pour que le
-- membre voie dans son historique SUR QUEL COMPTE chaque notification est partie.
ALTER TABLE notifications.workflow_executions
  ADD COLUMN IF NOT EXISTS destination text;

COMMENT ON COLUMN notifications.workflow_executions.destination IS
  'Adresse résolue de livraison (email ou id Discord du destinataire) au moment de l''envoi. Affichée dans l''historique membre.';


-- ===== 011_optout_unsubscribe.sql =====
-- Désabonnement 1-clic (List-Unsubscribe) : un membre peut se désabonner depuis
-- un email SANS session. L'opt-out devient donc clé par recipient_id (la personne
-- canonique), et user_id (auth.users) n'est plus obligatoire.
ALTER TABLE notifications.user_optouts ALTER COLUMN user_id DROP NOT NULL;

-- Unicité par destinataire (en plus de l'ancienne (user_id, workflow_id) conservée
-- pour compat). Empêche les doublons d'opt-out pour une même personne.
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_optouts_recipient_workflow
  ON notifications.user_optouts(recipient_id, workflow_id)
  WHERE recipient_id IS NOT NULL;

