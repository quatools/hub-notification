-- ============================================================
-- PROD — Crée la coquille de l'app "baas-esport" rattachée à ton compte Google.
-- À exécuter dans l'éditeur SQL du Supabase cloud (projet BAAS prod).
--
-- PRÉREQUIS : t'être connecté AU MOINS UNE FOIS sur https://hub.quatools.fr
--             avec ton compte Google (alexandre.quatools@gmail.com) — sinon le
--             compte n'existe pas encore en prod et l'insert ne fait rien.
--
-- Le signing_secret est généré ICI (gen_random_bytes) → il ne transite jamais
-- ailleurs ; tu le liras ensuite dans ton espace développeur.
-- status 'active' = pas de plafond d'essai (app de prod, pas un nouvel inconnu).
-- Idempotent : ON CONFLICT (slug) DO NOTHING.
-- ============================================================

INSERT INTO notifications.apps (slug, name, owner_user_id, status, signing_secret)
SELECT 'baas-esport',
       'Plateforme Esport',
       (SELECT id FROM auth.users WHERE email = 'alexandre.quatools@gmail.com'),
       'active',
       encode(gen_random_bytes(32), 'hex')
WHERE EXISTS (SELECT 1 FROM auth.users WHERE email = 'alexandre.quatools@gmail.com')
ON CONFLICT (slug) DO NOTHING;

-- Vérif : l'app existe et le bon propriétaire est rattaché.
-- (Si AUCUNE ligne ne s'affiche → connecte-toi d'abord sur hub.quatools.fr en Google,
--  puis relance ce script.)
SELECT a.slug, a.name, a.status, u.email AS proprietaire
FROM notifications.apps a
LEFT JOIN auth.users u ON u.id = a.owner_user_id
WHERE a.slug = 'baas-esport';
