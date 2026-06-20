-- 017_org_roles.sql
-- Rôles dans notifications.org_admins : 'owner' | 'admin'.
-- Le champ `role` existe déjà (migration 015, défaut 'admin'). On borne ses
-- valeurs. L'owner gère l'équipe (inviter/retirer/transférer) ; l'admin configure
-- seulement les notifications. Invariant ≥1 owner : appliqué côté application.

-- org_id peut référencer un CLUB (public.clubs, BAAS) OU une org hub
-- (notifications.organizations) → on retire la FK trop restrictive vers
-- organizations (org_id devient un identifiant logique d'org, comme ailleurs).
ALTER TABLE notifications.org_admins
  DROP CONSTRAINT IF EXISTS org_admins_org_id_fkey;

ALTER TABLE notifications.org_admins
  ADD CONSTRAINT org_admins_role_check CHECK (role IN ('owner', 'admin'));
