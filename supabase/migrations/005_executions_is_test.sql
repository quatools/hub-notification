-- ============================================
-- Journalisation des envois de test.
-- Les tests (bouton "Tester" UI, tool MCP test_workflow) sont désormais
-- enregistrés dans workflow_executions avec is_test = true, pour le debug
-- et la traçabilité, sans polluer les stats de production (filtrer dessus).
-- ============================================

ALTER TABLE notifications.workflow_executions
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
