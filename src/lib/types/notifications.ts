// ============================================
// Types TypeScript - Hub Notification
// ============================================

// --- Events ---
export interface NotificationEvent {
  id: string
  app: string
  slug: string
  label: string
  description: string | null
  category: string
  supported_channels: string[]
  audiences: string[]
  default_active: boolean
  payload_schema: Record<string, string> | null
  is_active: boolean
  deprecated_at: string | null
  created_at: string
  updated_at: string
}

// --- Channels ---
export type ChannelType = 'email' | 'discord_webhook' | 'discord_dm' | 'sms'

export interface NotificationChannel {
  id: string
  user_id: string
  org_id: string | null
  type: ChannelType
  label: string | null
  config: Record<string, unknown>
  is_verified: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DiscordWebhookConfig {
  webhook_url: string
}

export interface EmailConfig {
  email: string
}

// --- Preferences ---
export interface NotificationPreference {
  id: string
  user_id: string
  org_id: string | null
  event_id: string
  channel_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// --- Logs ---
export type LogStatus = 'pending' | 'sent' | 'failed'

export interface NotificationLog {
  id: string
  event_slug: string
  event_id: string | null
  channel_id: string | null
  user_id: string
  org_id: string | null
  status: LogStatus
  payload: Record<string, unknown> | null
  rendered_content: Record<string, unknown> | null
  error_message: string | null
  attempts: number
  sent_at: string | null
  created_at: string
}

// --- Templates ---
export interface NotificationTemplate {
  id: string
  event_id: string
  channel_type: string
  subject: string | null
  body: string
  format: 'text' | 'html' | 'markdown'
  created_at: string
  updated_at: string
}

// --- API Request/Response ---
export interface RegisterRequest {
  app: string
  events: Array<{
    slug: string
    label: string
    description?: string
    category: string
    supported_channels: string[]
    audiences: string[]
    default_active?: boolean
    payload_schema?: Record<string, string>
  }>
}

export interface RegisterResponse {
  registered: number
  updated: number
  new: number
}

export interface EmitRequest {
  event: string
  org_id: string
  target_users?: string[]
  payload: Record<string, unknown>
}

export interface EmitResponse {
  dispatched: number
  channels: string[]
  log_ids: string[]
}

// --- API Preferences (format pour le frontend) ---
export interface PreferenceChannelState {
  channel_id: string
  channel_type: ChannelType
  channel_label: string | null
  is_active: boolean
}

export interface PreferenceEventRow {
  event_id: string
  event_slug: string
  event_label: string
  event_category: string
  channels: PreferenceChannelState[]
}
