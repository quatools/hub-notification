-- 012_member_preferences.sql
-- Phase 3 — Préférences membre : « ne pas déranger », compte de réception par
-- défaut, et choix par événement (activation + compte de réception).
-- Tout est clé par recipient_id (la « personne »), cohérent avec l'opt-out et
-- le routage « au membre concerné ».

-- 1) Ne pas déranger + compte par défaut, au niveau du destinataire
ALTER TABLE notifications.recipients
  ADD COLUMN IF NOT EXISTS dnd_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_channel_id uuid
    REFERENCES notifications.channels(id) ON DELETE SET NULL;

-- 2) Préférence par événement : le membre choisit s'il veut l'événement et sur
--    quel de ses comptes le recevoir (channel_id NULL => compte par défaut).
CREATE TABLE IF NOT EXISTS notifications.recipient_event_prefs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES notifications.recipients(id) ON DELETE CASCADE,
  event_id     uuid NOT NULL REFERENCES notifications.events(id) ON DELETE CASCADE,
  channel_id   uuid REFERENCES notifications.channels(id) ON DELETE SET NULL,
  is_enabled   boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_recipient_event_prefs_recipient
  ON notifications.recipient_event_prefs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_recipient_event_prefs_event
  ON notifications.recipient_event_prefs(event_id);

DROP TRIGGER IF EXISTS set_updated_at ON notifications.recipient_event_prefs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON notifications.recipient_event_prefs
  FOR EACH ROW EXECUTE FUNCTION notifications.set_updated_at();

-- 3) RLS : chaque membre ne voit/écrit que ses propres préférences (via son recipient).
ALTER TABLE notifications.recipient_event_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own event prefs select" ON notifications.recipient_event_prefs;
CREATE POLICY "own event prefs select" ON notifications.recipient_event_prefs
  FOR SELECT TO authenticated
  USING (recipient_id IN (SELECT id FROM notifications.recipients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "own event prefs write" ON notifications.recipient_event_prefs;
CREATE POLICY "own event prefs write" ON notifications.recipient_event_prefs
  FOR ALL TO authenticated
  USING (recipient_id IN (SELECT id FROM notifications.recipients WHERE auth_user_id = auth.uid()))
  WITH CHECK (recipient_id IN (SELECT id FROM notifications.recipients WHERE auth_user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON notifications.recipient_event_prefs TO authenticated;
GRANT ALL ON notifications.recipient_event_prefs TO service_role;
