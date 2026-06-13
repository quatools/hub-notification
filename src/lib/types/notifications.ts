// ============================================
// Types TypeScript - Hub Notification
// Version 2.0 (workflow-based architecture)
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

// --- Workflows ---
export interface Workflow {
  id: string
  org_id: string
  event_id: string
  channel_id: string
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export type StepType = 'send' | 'wait' | 'condition'

export interface WorkflowStep {
  id: string
  workflow_id: string
  step_order: number
  step_type: StepType
  subject: string | null
  body: string
  format: 'text' | 'html' | 'markdown'
  step_config: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// --- User Optouts ---
export interface UserOptout {
  id: string
  user_id: string
  workflow_id: string
  created_at: string
}

// --- Workflow Executions (Logs) ---
export type ExecutionStatus = 'pending' | 'sent' | 'failed'

export interface WorkflowExecution {
  id: string
  workflow_id: string | null
  event_slug: string
  channel_id: string | null
  user_id: string
  org_id: string | null
  status: ExecutionStatus
  current_step: number
  payload: Record<string, unknown> | null
  rendered_content: Record<string, unknown> | null
  error_message: string | null
  attempts: number
  sent_at: string | null
  created_at: string
}

// --- API Request/Response (serveur-à-serveur) ---
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

// Descripteur de destinataire (CDC v2) : l'app fournit les coordonnées du membre
// concerné. Le hub les enregistre sur une fiche destinataire (rattachable ensuite).
export interface EmitRecipientDescriptor {
  app_user_id?: string   // id du membre côté app
  email?: string
  discord_id?: string
  name?: string
}

export interface EmitRequest {
  event: string
  org_id: string
  target_users?: string[]                 // legacy (auth.users ids) — rétrocompat
  recipients?: EmitRecipientDescriptor[]  // CDC v2 — descripteurs
  payload: Record<string, unknown>
}

export interface EmitResponse {
  dispatched: number
  channels: string[]
  execution_ids: string[]
}

// --- API Admin (format pour le frontend admin) ---

// Workflow avec ses relations (pour l'UI admin)
export interface WorkflowWithDetails {
  id: string
  org_id: string
  event_id: string
  channel_id: string
  is_active: boolean
  created_by: string
  created_at: string
  // Relations jointes
  event: {
    slug: string
    label: string
    description: string | null
    category: string
    supported_channels: string[]
    audiences: string[]
    payload_schema: Record<string, string> | null
  }
  channel: {
    type: ChannelType
    label: string | null
  }
  step: {
    id: string
    subject: string | null
    body: string
    format: 'text' | 'html' | 'markdown'
  }
}

// Événement avec ses workflows groupés (pour la page workflows admin)
export interface EventWithWorkflows {
  event: NotificationEvent
  workflows: WorkflowWithDetails[]
}

// --- API User (format pour le frontend membre) ---
export interface UserWorkflowOptout {
  workflow_id: string
  event_label: string
  event_category: string
  channel_type: ChannelType
  channel_label: string | null
  is_opted_out: boolean
}
