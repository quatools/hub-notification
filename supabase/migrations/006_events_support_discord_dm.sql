-- ============================================
-- Canal MP Discord (bot Notify).
-- Tout événement qui supporte le webhook Discord supporte aussi le MP :
-- même contenu, autre destination.
-- ============================================

UPDATE notifications.events
SET supported_channels = array_append(supported_channels, 'discord_dm')
WHERE 'discord_webhook' = ANY(supported_channels)
  AND NOT ('discord_dm' = ANY(supported_channels));
