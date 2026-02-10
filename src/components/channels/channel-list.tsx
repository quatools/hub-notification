"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Mail, MessageSquare, Phone, Plus, Pencil, Trash2 } from "lucide-react"
import { ChannelDialog } from "./channel-dialog"
import { DeleteChannelDialog } from "./delete-channel-dialog"
import type { NotificationChannel } from "@/lib/types/notifications"

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  discord_webhook: MessageSquare,
  discord_dm: MessageSquare,
  sms: Phone,
}

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  email: "Email",
  discord_webhook: "Discord Webhook",
  discord_dm: "Discord DM",
  sms: "SMS",
}

function getChannelInfo(channel: NotificationChannel): string {
  if (channel.type === "email") return (channel.config as { email?: string }).email || ""
  if (channel.type === "discord_webhook") return "Webhook configuré"
  return ""
}

export function ChannelList() {
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null)
  const [deletingChannel, setDeletingChannel] = useState<NotificationChannel | null>(null)

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/channels")
      if (!res.ok) throw new Error("Erreur chargement")
      const data = await res.json()
      setChannels(data.channels)
    } catch {
      toast.error("Impossible de charger les canaux")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  const handleToggle = async (channel: NotificationChannel) => {
    const newActive = !channel.is_active
    // Update optimiste
    setChannels((prev) =>
      prev.map((c) => (c.id === channel.id ? { ...c, is_active: newActive } : c))
    )

    try {
      const res = await fetch(`/api/notifications/channels/${channel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      })
      if (!res.ok) throw new Error()
      toast.success(newActive ? "Canal activé" : "Canal désactivé")
    } catch {
      // Rollback
      setChannels((prev) =>
        prev.map((c) => (c.id === channel.id ? { ...c, is_active: !newActive } : c))
      )
      toast.error("Erreur lors de la mise à jour")
    }
  }

  const handleDelete = async (channel: NotificationChannel) => {
    try {
      const res = await fetch(`/api/notifications/channels/${channel.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error()
      setChannels((prev) => prev.filter((c) => c.id !== channel.id))
      toast.success("Canal supprimé")
    } catch {
      toast.error("Erreur lors de la suppression")
    } finally {
      setDeletingChannel(null)
    }
  }

  const handleSaved = () => {
    setDialogOpen(false)
    setEditingChannel(null)
    fetchChannels()
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {channels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Aucun canal configuré. Ajoutez votre premier canal pour recevoir des notifications.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un canal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {channels.map((channel) => {
            const Icon = CHANNEL_ICONS[channel.type] || Mail
            return (
              <Card key={channel.id}>
                <CardContent className="flex items-center gap-4 py-4">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {channel.label || CHANNEL_TYPE_LABELS[channel.type]}
                      </span>
                      {channel.is_verified ? (
                        <Badge variant="default" className="text-xs">Vérifié</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Non vérifié</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {getChannelInfo(channel)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={channel.is_active}
                      onCheckedChange={() => handleToggle(channel)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingChannel(channel)
                        setDialogOpen(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingChannel(channel)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un canal
          </Button>
        </>
      )}

      <ChannelDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingChannel(null)
        }}
        channel={editingChannel}
        onSaved={handleSaved}
      />

      <DeleteChannelDialog
        channel={deletingChannel}
        onConfirm={() => deletingChannel && handleDelete(deletingChannel)}
        onCancel={() => setDeletingChannel(null)}
      />
    </div>
  )
}
