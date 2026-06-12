"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/page-header"
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import { Plus, Radio, Mail, Trash2, Pencil, CheckCircle, XCircle, Loader2 } from "lucide-react"

interface Channel {
  id: string
  type: string
  label: string | null
  config: Record<string, unknown>
  is_active: boolean
  is_verified: boolean
  created_at: string
}

export default function AdminChannelsPage() {
  const { selectedClub, loading: clubLoading } = useClub()
  const orgId = selectedClub?.club_id
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  // null = création, sinon canal en cours d'édition
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [formType, setFormType] = useState("discord_webhook")
  const [formLabel, setFormLabel] = useState("")
  const [formWebhookUrl, setFormWebhookUrl] = useState("")
  const [formEmail, setFormEmail] = useState("")

  const isEditing = !!editingChannel

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

  useEffect(() => { setLoading(true); fetchChannels() }, [fetchChannels])

  const resetForm = () => {
    setEditingChannel(null)
    setFormType("discord_webhook")
    setFormLabel("")
    setFormWebhookUrl("")
    setFormEmail("")
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (channel: Channel) => {
    setEditingChannel(channel)
    setFormType(channel.type)
    setFormLabel(channel.label || "")
    setFormWebhookUrl(channel.type === "discord_webhook" ? (channel.config.webhook_url as string) || "" : "")
    setFormEmail(channel.type === "email" ? (channel.config.email as string) || "" : "")
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      const config: Record<string, unknown> = formType === "discord_webhook"
        ? { webhook_url: formWebhookUrl }
        : { email: formEmail }

      const url = isEditing ? `/api/admin/channels/${editingChannel.id}` : "/api/admin/channels"
      const method = isEditing ? "PUT" : "POST"
      const body = isEditing
        ? { label: formLabel || null, config }
        : { org_id: orgId, type: formType, label: formLabel || undefined, config }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Erreur lors de l'enregistrement")
        return
      }

      toast.success(isEditing ? "Canal mis à jour" : "Canal créé avec succès")
      setDialogOpen(false)
      resetForm()
      fetchChannels()
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setSaving(false)
    }
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
    if (channel.type === "email") return channel.config.email as string || ""
    return ""
  }

  if (clubLoading || !selectedClub || loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Canaux"
        description="Un canal est une destination de notification : un salon Discord (via webhook) ou une adresse email. Vous les brancherez ensuite sur des événements via les workflows."
        flowStep="channel"
        actions={
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Ajouter un canal</Button>
        }
      />

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Modifier le canal" : "Nouveau canal"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Modifiez le nom ou la destination de ce canal. Les workflows qui l'utilisent ne sont pas impactés."
                : "Une destination vers laquelle vos workflows pourront envoyer des notifications."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formType} onValueChange={setFormType} disabled={isEditing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="discord_webhook">Discord Webhook</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
              {isEditing && (
                <p className="text-xs text-muted-foreground">
                  Le type n&apos;est pas modifiable. Pour changer de type, créez un nouveau canal.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Label (optionnel)</Label>
              <Input placeholder={formType === "discord_webhook" ? "ex: #notifications" : "ex: Contact organisation"} value={formLabel} onChange={(e) => setFormLabel(e.target.value)} />
            </div>
            {formType === "discord_webhook" ? (
              <div className="space-y-2">
                <Label>URL du Webhook</Label>
                <Input placeholder="https://discord.com/api/webhooks/..." value={formWebhookUrl} onChange={(e) => setFormWebhookUrl(e.target.value)} />
                <p className="text-xs text-muted-foreground">Paramètres du serveur &gt; Intégrations &gt; Webhooks</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Adresse email</Label>
                <Input type="email" placeholder="contact@monorg.fr" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
            <Button onClick={handleSubmit} disabled={saving || (formType === "discord_webhook" ? !formWebhookUrl : !formEmail)}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {channels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Radio className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Aucun canal configuré</h3>
            <p className="text-sm text-muted-foreground mb-4">Ajoutez un webhook Discord ou une adresse email pour commencer.</p>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Ajouter un canal</Button>
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
                      <CardTitle className="text-base">{channel.label || getChannelTypeLabel(channel.type)}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">{getChannelTypeLabel(channel.type)} &middot; {getChannelDetail(channel)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={channel.is_verified ? "default" : "secondary"} className="text-xs">
                      {channel.is_verified ? <><CheckCircle className="h-3 w-3 mr-1" />Vérifié</> : <><XCircle className="h-3 w-3 mr-1" />Non vérifié</>}
                    </Badge>
                    <Switch checked={channel.is_active} onCheckedChange={() => handleToggle(channel)} />
                    <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => openEdit(channel)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce canal ?</AlertDialogTitle>
                          <AlertDialogDescription>Les workflows utilisant ce canal seront également supprimés. Cette action est irréversible.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(channel.id)}>Supprimer</AlertDialogAction>
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
