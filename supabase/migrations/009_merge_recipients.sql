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
