"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { Mail, MessageSquare, Phone } from "lucide-react"
import type { NotificationChannel, ChannelType } from "@/lib/types/notifications"

interface ChannelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel: NotificationChannel | null // null = création, sinon = édition
  onSaved: () => void
}

const CHANNEL_OPTIONS: Array<{
  type: ChannelType
  label: string
  icon: typeof Mail
  disabled?: boolean
  disabledLabel?: string
}> = [
  { type: "email", label: "Email", icon: Mail },
  { type: "discord_webhook", label: "Discord Webhook", icon: MessageSquare },
  { type: "sms", label: "SMS", icon: Phone, disabled: true, disabledLabel: "Bientôt disponible" },
]

export function ChannelDialog({ open, onOpenChange, channel, onSaved }: ChannelDialogProps) {
  const isEditing = !!channel
  const [step, setStep] = useState<"type" | "config">(isEditing ? "config" : "type")
  const [selectedType, setSelectedType] = useState<ChannelType | null>(channel?.type ?? null)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [email, setEmail] = useState("")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [label, setLabel] = useState("")

  // Reset on open/close
  useEffect(() => {
    if (open) {
      if (channel) {
        setStep("config")
        setSelectedType(channel.type)
        setLabel(channel.label || "")
        if (channel.type === "email") {
          setEmail((channel.config as { email?: string }).email || "")
        }
        if (channel.type === "discord_webhook") {
          setWebhookUrl((channel.config as { webhook_url?: string }).webhook_url || "")
        }
      } else {
        setStep("type")
        setSelectedType(null)
        setEmail("")
        setWebhookUrl("")
        setLabel("")
      }
    }
  }, [open, channel])

  const handleTypeSelect = (type: ChannelType) => {
    setSelectedType(type)
    setStep("config")
  }

  const handleSubmit = async () => {
    if (!selectedType) return

    let config: Record<string, unknown> = {}
    let finalLabel = label

    if (selectedType === "email") {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast.error("Adresse email invalide")
        return
      }
      config = { email }
      if (!finalLabel) finalLabel = email
    }

    if (selectedType === "discord_webhook") {
      if (
        !webhookUrl.startsWith("https://discord.com/api/webhooks/") &&
        !webhookUrl.startsWith("https://discordapp.com/api/webhooks/")
      ) {
        toast.error("URL webhook Discord invalide")
        return
      }
      config = { webhook_url: webhookUrl }
      if (!finalLabel) finalLabel = "Discord Webhook"
    }

    setSaving(true)

    try {
      const url = isEditing
        ? `/api/notifications/channels/${channel!.id}`
        : "/api/notifications/channels"
      const method = isEditing ? "PUT" : "POST"

      const body = isEditing
        ? { label: finalLabel, config }
        : { type: selectedType, label: finalLabel, config }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur")
      }

      toast.success(isEditing ? "Canal mis à jour" : "Canal ajouté")
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la sauvegarde")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier le canal" : "Ajouter un canal"}
          </DialogTitle>
        </DialogHeader>

        {step === "type" && (
          <div className="grid gap-3">
            {CHANNEL_OPTIONS.map((opt) => (
              <Card
                key={opt.type}
                className={`cursor-pointer transition-colors ${
                  opt.disabled
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-accent"
                }`}
                onClick={() => !opt.disabled && handleTypeSelect(opt.type)}
              >
                <CardContent className="flex items-center gap-3 py-3">
                  <opt.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{opt.label}</p>
                    {opt.disabledLabel && (
                      <p className="text-xs text-muted-foreground">{opt.disabledLabel}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {step === "config" && selectedType === "email" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                placeholder="alex@quatools.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Nom (optionnel)</Label>
              <Input
                id="label"
                placeholder="Email pro"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === "config" && selectedType === "discord_webhook" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook">URL du webhook</Label>
              <Input
                id="webhook"
                placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                <a
                  href="https://support.discord.com/hc/en-us/articles/228383668"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Comment créer un webhook Discord ?
                </a>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Nom du canal</Label>
              <Input
                id="label"
                placeholder="#general, #compta..."
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === "config" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
