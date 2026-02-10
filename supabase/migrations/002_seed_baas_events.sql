-- ============================================
-- Seed: Événements BAAS Esport + Templates par défaut
-- À exécuter APRÈS 001_notifications_schema.sql
-- ============================================

-- 1. Insérer les 8 événements BAAS
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

-- 2. Templates Discord par défaut
INSERT INTO notifications.templates (event_id, channel_type, body, format)
SELECT e.id, 'discord_webhook', t.body, 'markdown'
FROM (VALUES
  ('baas.subscription.created', '**{{member_name}}** vient de souscrire au plan **{{plan_name}}** ({{amount}}€) sur **{{club_name}}**.'),
  ('baas.subscription.canceled', '**{{member_name}}** a annulé son abonnement **{{plan_name}}** sur **{{club_name}}**.\nRaison : {{reason}}'),
  ('baas.payment.succeeded', 'Paiement de **{{amount}}€** reçu de **{{member_name}}** ({{plan_name}}).'),
  ('baas.payment.failed', 'Paiement échoué pour **{{member_name}}** ({{amount}}€).\nErreur : {{error_reason}}'),
  ('baas.member.joined', '**{{member_name}}** ({{email}}) a rejoint **{{club_name}}**.'),
  ('baas.member.profile_updated', '**{{member_name}}** a mis à jour son profil : {{updated_fields}}.'),
  ('baas.team.member_assigned', '**{{member_name}}** a été assigné à l''équipe **{{team_name}}**.'),
  ('baas.team.complete', 'L''équipe **{{team_name}}** est au complet ({{member_count}} membres).')
) AS t(slug, body)
JOIN notifications.events e ON e.slug = t.slug
ON CONFLICT (event_id, channel_type) DO UPDATE SET
  body = EXCLUDED.body,
  format = EXCLUDED.format;

-- 3. Templates Email par défaut (seulement pour les events qui supportent l'email)
INSERT INTO notifications.templates (event_id, channel_type, subject, body, format)
SELECT e.id, 'email', t.subject, t.body, 'html'
FROM (VALUES
  ('baas.subscription.created',
   'Nouvel abonnement - {{member_name}}',
   '<h2>Nouvel abonnement</h2><p><strong>{{member_name}}</strong> vient de souscrire au plan <strong>{{plan_name}}</strong> pour un montant de <strong>{{amount}}€</strong>.</p><p>Club : {{club_name}}</p>'),
  ('baas.subscription.canceled',
   'Abonnement annulé - {{member_name}}',
   '<h2>Abonnement annulé</h2><p><strong>{{member_name}}</strong> a annulé son abonnement <strong>{{plan_name}}</strong>.</p><p>Club : {{club_name}}</p><p>Raison : {{reason}}</p>'),
  ('baas.payment.succeeded',
   'Paiement reçu - {{amount}}€',
   '<h2>Paiement réussi</h2><p>Un paiement de <strong>{{amount}}€</strong> a été encaissé pour <strong>{{member_name}}</strong> (plan {{plan_name}}).</p>'),
  ('baas.payment.failed',
   'Paiement échoué - {{member_name}}',
   '<h2>Paiement échoué</h2><p>Le paiement de <strong>{{amount}}€</strong> pour <strong>{{member_name}}</strong> a échoué.</p><p>Erreur : {{error_reason}}</p>')
) AS t(slug, subject, body)
JOIN notifications.events e ON e.slug = t.slug
ON CONFLICT (event_id, channel_type) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  format = EXCLUDED.format;
