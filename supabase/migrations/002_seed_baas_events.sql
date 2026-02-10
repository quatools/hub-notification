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
