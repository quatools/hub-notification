-- 018_unsubscribe_feedback.sql
-- Feedback de désabonnement (data du CLIENT/club) + couleur de marque blanche.

-- Raison optionnelle attachée à un opt-out : pourquoi le membre s'est désabonné.
-- (Le membre la donne en 1 tap sur la page de confirmation ; jamais obligatoire.)
ALTER TABLE notifications.user_optouts
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS reason_at TIMESTAMPTZ;

-- Couleur d'accent de la marque blanche d'une org (page de désabonnement, etc.).
-- NULL → la page utilise un neutre élégant. Hex type '#4538CC'.
ALTER TABLE notifications.org_settings
  ADD COLUMN IF NOT EXISTS brand_color TEXT;
