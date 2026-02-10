"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState, useCallback, Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { Plus, Radio, Mail, Trash2, CheckCircle, XCircle, Loader2 } from "lucide-react"

interface Channel {
  id: string
  type: string
  label: string | null
  config: Record<string, unknown>
  is_active: boolean
  is_verified: boolean
  created_at: string
}

function ChannelsContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get("org_id")
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newType, setNewType] = useState("discord_webhook")
  const [newLabel, setNewLabel] = useState("")
  const [newWebhookUrl, setNewWebhookUrl] = useState("")
  const [newEmail, setNewEmail] = useState("")

  const fetchChannels = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      const res = await fetch(`/api/admin/channels?org_id=${orgId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setChannels(data.channels || [])
    } catch {
      toast.error("Erreur lors du chargement des canaux")
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { fetchChannels() }, [fetchChannels])

  const handleCreate = async () => {
    if (!orgId) return
    setCreating(true)
    try {
      const config: Record<string, unknown> = newType === "discord_webhook"
        ? { webhook_url: newWebhookUrl }
        : { email: newEmail }

      const res = await fetch("/api/admin/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          type: newType,
          label: newLabel || undefined,
          config,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Erreur lors de la création")
        return
      }

      toast.success("Canal créé avec succès")
      setCreateOpen(false)
      resetForm()
      fetchChannels()
    } catch {
      toast.error("Erreur lors de la création")
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setNewType("discord_webhook")
    setNewLabel("")
    setNewWebhookUrl("")
    setNewEmail("")
  }

  const handleToggle = async (channel: Channel) => {
    try {
      const res = await fetch(`/api/admin/channels/${channel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !channel.is_active }),
      })
      if (!res.ok) throw new Error()
      setChannels((prev) =>
        prev.map((c) => c.id === channel.id ? { ...c, is_active: !c.is_active } : c)
      )
    } catch {
      toast.error("Erreur lors de la mise à jour")
    }
  }

  const handleDelete = async (channelId: string) => {
    try {
      const res = await fetch(`/api/admin/channels/${channelId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setChannels((prev) => prev.filter((c) => c.id !== channelId))
      toast.success("Canal supprimé")
    } catch {
      toast.error("Erreur lors de la suppression")
    }
  }

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "discord_webhook": return <Radio className="h-5 w-5 text-indigo-500" />
      case "email": return <Mail className="h-5 w-5 text-blue-500" />
      default: return <Radio className="h-5 w-5" />
    }
  }

  const getChannelTypeLabel = (type: string) => {
    switch (type) {
      case "discord_webhook": return "Discord Webhook"
      case "email": return "Email"
      default: return type
    }
  }

  const getChannelDetail = (channel: Channel) => {
    if (channel.type === "discord_webhook") {
      const url = channel.config.webhook_url as string
      return url ? `...${url.slice(-20)}` : ""
    }
    if (channel.type === "email") {
      return channel.config.email as string || ""
    }
    return ""
  }

  if (!orgId) {
    return <p className="text-center text-muted-foreground py-12">Paramètre org_id manquant.</p>
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Canaux</h1>
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Ajouter un canal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau canal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discord_webhook">Discord Webhook</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Label (optionnel)</Label>
                <Input
                  placeholder={newType === "discord_webhook" ? "ex: #notifications" : "ex: Contact club"}
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              {newType === "discord_webhook" ? (
                <div className="space-y-2">
                  <Label>URL du Webhook</Label>
                  <Input
                    placeholder="https://discord.com/api/webhooks/..."
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paramètres du serveur &gt; Intégrations &gt; Webhooks
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Adresse email</Label>
                  <Input
                    type="email"
                    placeholder="contact@monclub.fr"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button
                onClick={handleCreate}
                disabled={creating || (newType === "discord_webhook" ? !newWebhookUrl : !newEmail)}
              >
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {channels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Radio className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Aucun canal configuré</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ajoutez un webhook Discord ou une adresse email pour commencer à recevoir vos notifications.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Ajouter un canal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {channels.map((channel) => (
            <Card key={channel.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getChannelIcon(channel.type)}
                    <div>
                      <CardTitle className="text-base">
                        {channel.label || getChannelTypeLabel(channel.type)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {getChannelTypeLabel(channel.type)} &middot; {getChannelDetail(channel)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={channel.is_verified ? "default" : "secondary"} className="text-xs">
                      {channel.is_verified ? (
                        <><CheckCircle className="h-3 w-3 mr-1" />Vérifié</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" />Non vérifié</>
                      )}
                    </Badge>
                    <Switch
                      checked={channel.is_active}
                      onCheckedChange={() => handleToggle(channel)}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce canal ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Les workflows utilisant ce canal seront également supprimés. Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(channel.id)}>
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminChannelsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ChannelsContent />
    </Suspense>
  )
}
