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
