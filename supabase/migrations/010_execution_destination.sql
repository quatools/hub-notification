-- Adresse de livraison résolue par exécution (email / id Discord), pour que le
-- membre voie dans son historique SUR QUEL COMPTE chaque notification est partie.
ALTER TABLE notifications.workflow_executions
  ADD COLUMN IF NOT EXISTS destination text;

COMMENT ON COLUMN notifications.workflow_executions.destination IS
  'Adresse résolue de livraison (email ou id Discord du destinataire) au moment de l''envoi. Affichée dans l''historique membre.';
