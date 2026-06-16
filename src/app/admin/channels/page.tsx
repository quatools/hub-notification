"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import { Plus, Radio, Mail, MessageCircle, Trash2, Pencil, CheckCircle, XCircle, Loader2 } from "lucide-react"

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
  const [formDiscordUserId, setFormDiscordUserId] = useState("")
  // "member" = membre concerné par l'événement (auto), "fixed" = ID précis
  const [formDmRecipient, setFormDmRecipient] = useState("member")

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
    setFormDiscordUserId("")
    setFormDmRecipient("member")
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
    setFormDiscordUserId(channel.type === "discord_dm" ? (channel.config.discord_user_id as string) || "" : "")
    setFormDmRecipient(channel.type === "discord_dm" && channel.config.recipient === "member" ? "member" : channel.type === "discord_dm" ? "fixed" : "member")
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      const config: Record<string, unknown> =
        formType === "discord_webhook" ? { webhook_url: formWebhookUrl }
        : formType === "discord_dm"
          ? (formDmRecipient === "member" ? { recipient: "member" } : { discord_user_id: formDiscordUserId.trim() })
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
      case "discord_dm": return <MessageCircle className="h-5 w-5 text-violet-500" />
      case "email": return <Mail className="h-5 w-5 text-blue-500" />
      default: return <Radio className="h-5 w-5" />
    }
  }

  const getChannelTypeLabel = (type: string) => {
    switch (type) {
      case "discord_webhook": return "Discord Webhook"
      case "discord_dm": return "MP Discord"
      case "email": return "Email"
      default: return type
    }
  }

  const getChannelDetail = (channel: Channel) => {
    if (channel.type === "discord_webhook") {
      const url = channel.config.webhook_url as string
      return url ? `...${url.slice(-20)}` : ""
    }
    if (channel.type === "discord_dm") {
      return channel.config.recipient === "member" ? "Membre concerné par l'événement" : `ID ${channel.config.discord_user_id || ""}`
    }
    if (channel.type === "email") return channel.config.email as string || ""
    return ""
  }

  if (clubLoading || !selectedClub || loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-medium">Canaux</h1>
          <p className="text-sm text-muted-foreground mt-1">Les destinations où vos notifications sont envoyées.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Ajouter un canal</Button>
      </div>

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
                  <SelectItem value="discord_webhook">Discord Webhook (salon)</SelectItem>
                  <SelectItem value="discord_dm">MP Discord (message privé)</SelectItem>
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
            {formType === "discord_webhook" && (
              <div className="space-y-2">
                <Label>URL du Webhook</Label>
                <Input placeholder="https://discord.com/api/webhooks/..." value={formWebhookUrl} onChange={(e) => setFormWebhookUrl(e.target.value)} />
                <p className="text-xs text-muted-foreground">Paramètres du serveur &gt; Intégrations &gt; Webhooks</p>
              </div>
            )}
            {formType === "discord_dm" && (
              <>
                <div className="space-y-2">
                  <Label>Destinataire</Label>
                  <Select value={formDmRecipient} onValueChange={setFormDmRecipient} disabled={isEditing}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Le membre concerné par l&apos;événement</SelectItem>
                      <SelectItem value="fixed">Une personne précise</SelectItem>
                    </SelectContent>
                  </Select>
                  {formDmRecipient === "member" && (
                    <p className="text-xs text-muted-foreground">
                      Aucun identifiant à saisir : le hub envoie le MP au membre concerné par l&apos;événement,
                      reconnu automatiquement via son compte Discord. C&apos;est le mode recommandé pour notifier vos membres.
                    </p>
                  )}
                </div>
                {formDmRecipient === "fixed" && (
                  <div className="space-y-2">
                    <Label>ID Discord du destinataire</Label>
                    <Input placeholder="ex: 137245874929861234" value={formDiscordUserId} onChange={(e) => setFormDiscordUserId(e.target.value)} />
                    <p className="text-xs text-muted-foreground">
                      Pour notifier toujours la même personne (capitaine, admin…). Clic droit sur le membre &gt;
                      « Copier l&apos;identifiant » (mode développeur requis).
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Le bot Notify doit être présent sur votre serveur Discord (voir Paramètres).
                </p>
              </>
            )}
            {formType === "email" && (
              <div className="space-y-2">
                <Label>Adresse email</Label>
                <Input type="email" placeholder="contact@monorg.fr" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
            <Button
              onClick={handleSubmit}
              disabled={
                saving ||
                (formType === "discord_webhook" ? !formWebhookUrl
                  : formType === "discord_dm" ? (formDmRecipient === "fixed" && !formDiscordUserId.trim())
                  : !formEmail)
              }
            >
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
        <div className="space-y-2.5">
          {channels.map((channel) => (
            <Card key={channel.id} className="p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-secondary">
                  {getChannelIcon(channel.type)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{channel.label || getChannelTypeLabel(channel.type)}</div>
                  <div className="truncate text-xs text-muted-foreground">{getChannelTypeLabel(channel.type)} &middot; {getChannelDetail(channel)}</div>
                </div>
                <span className={`mono-label flex shrink-0 items-center gap-1 ${channel.is_verified ? "text-[color:var(--qt-success)]" : "text-muted-foreground"}`}>
                  {channel.is_verified ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {channel.is_verified ? "Vérifié" : "Non vérifié"}
                </span>
                <Switch checked={channel.is_active} onCheckedChange={() => handleToggle(channel)} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openEdit(channel)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
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
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
