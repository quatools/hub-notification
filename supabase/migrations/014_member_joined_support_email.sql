-- ============================================
-- baas.member.joined : autoriser le canal email + l'audience "member".
--
-- Jusqu'ici l'événement "Nouveau membre" n'autorisait que les canaux Discord
-- (audience admin). Pour permettre à un club de brancher un MAIL DE BIENVENUE
-- adressé au nouveau membre, on ajoute :
--   - 'email' aux canaux supportés (sinon la création d'un workflow email sur
--     cet événement est refusée — cf. validation supported_channels).
--   - 'member' aux audiences (pour que le membre puisse gérer / refuser cette
--     notification depuis son espace, cohérent avec baas.subscription.created).
--
-- Le déclencheur est émis par le BAAS (esport-platform) à la PREMIÈRE adhésion
-- d'un membre au club. Idempotent (réexécutable sans effet de bord).
-- ============================================

UPDATE notifications.events
SET supported_channels = array_append(supported_channels, 'email')
WHERE slug = 'baas.member.joined'
  AND app = 'baas-esport'
  AND NOT ('email' = ANY(supported_channels));

UPDATE notifications.events
SET audiences = array_append(audiences, 'member')
WHERE slug = 'baas.member.joined'
  AND app = 'baas-esport'
  AND NOT ('member' = ANY(audiences));
