-- 013_lockdown_schema_grants.sql
-- SÉCURITÉ (P0) — Isolation multi-tenant.
--
-- Constat de l'audit : le schéma "notifications" est exposé via PostgREST et
-- plusieurs policies RLS étaient permissives (channels: org_id IS NOT NULL ;
-- workflows / workflow_steps / org_settings : USING(true)). Comme un GRANT SELECT
-- avait été donné au rôle "authenticated", n'importe quel membre connecté pouvait
-- interroger directement l'API REST et lire les données de TOUS les clubs
-- (URLs de webhook Discord, emails, identités d'expéditeur, etc.).
--
-- Or l'application n'accède JAMAIS à ces tables avec les rôles anon/authenticated :
-- tout l'accès aux données passe par le service_role (createServiceClient) côté
-- serveur. Le client navigateur ne sert qu'à l'authentification (schéma auth).
--
-- Correctif : retirer tout privilège direct anon/authenticated sur le schéma
-- notifications. service_role conserve ses droits → aucun impact fonctionnel,
-- et l'accès direct inter-tenant est définitivement coupé. Les policies RLS sont
-- conservées en défense en profondeur.

REVOKE ALL PRIVILEGES ON ALL TABLES    IN SCHEMA notifications FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA notifications FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA notifications FROM anon, authenticated;

-- Empêcher que de futures tables/migrations (créées par le rôle courant) ré-ouvrent
-- l'accès par défaut à anon/authenticated.
ALTER DEFAULT PRIVILEGES IN SCHEMA notifications REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA notifications REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA notifications REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- USAGE sur le schéma : laissé tel quel (sans droit sur les tables, il ne donne
-- accès à aucune donnée). On garde service_role pleinement opérationnel.
GRANT USAGE ON SCHEMA notifications TO service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA notifications TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA notifications TO service_role;
