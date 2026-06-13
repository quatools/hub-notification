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
