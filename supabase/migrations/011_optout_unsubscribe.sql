-- Désabonnement 1-clic (List-Unsubscribe) : un membre peut se désabonner depuis
-- un email SANS session. L'opt-out devient donc clé par recipient_id (la personne
-- canonique), et user_id (auth.users) n'est plus obligatoire.
ALTER TABLE notifications.user_optouts ALTER COLUMN user_id DROP NOT NULL;

-- Unicité par destinataire (en plus de l'ancienne (user_id, workflow_id) conservée
-- pour compat). Empêche les doublons d'opt-out pour une même personne.
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_optouts_recipient_workflow
  ON notifications.user_optouts(recipient_id, workflow_id)
  WHERE recipient_id IS NOT NULL;
