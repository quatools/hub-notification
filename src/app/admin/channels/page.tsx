"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
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

const DISCORD_APP_ID = process.env.NEXT_PUBLIC_DISCORD_APP_ID
const BOT_INVITE_URL = DISCORD_APP_ID
  ? `https://discord.com/oauth2/authorize?client_id=${DISCORD_APP_ID}&scope=bot&permissions=0`
  : null

const TYPES = [
  { value: "discord_webhook", label: "Salon Discord", dot: "#5865F2" },
  { value: "discord_dm", label: "MP joueur", dot: "#5865F2" },
  { value: "email", label: "Email", dot: "#C05B2E" },
]

/** Petit logo Discord pour le bouton d'invitation. */
function DiscordGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.6 5.6A17 17 0 0 0 15.4 4l-.2.4a13 13 0 0 1 3.7 1.9 12 12 0 0 0-10 0A13 13 0 0 1 12.6 4.4L12.4 4a17 17 0 0 0-4.2 1.6C5 9 4.3 12.4 4.6 15.7A17 17 0 0 0 9.8 18l.4-.6a11 11 0 0 1-1.8-.9l.4-.3a8.6 8.6 0 0 0 7.3 0l.4.3a11 11 0 0 1-1.8.9l.4.6a17 17 0 0 0 5.2-2.3c.4-3.9-.6-7.3-2.9-10zM9.7 13.6c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7zm4.6 0c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7z" />
    </svg>
  )
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
  // Destinataire — partagé par le MP Discord ET l'Email :
  // "member" = membre concerné par l'événement (résolu à l'envoi), "fixed" = adresse/ID précis.
  const [formRecipient, setFormRecipient] = useState("member")

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
    setFormRecipient("member")
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
    // MP Discord ET Email partagent le mode "membre concerné" / "adresse fixe".
    setFormRecipient(channel.config.recipient === "member" ? "member" : "fixed")
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      const config: Record<string, unknown> =
        formType === "discord_webhook" ? { webhook_url: formWebhookUrl }
        : formType === "discord_dm"
          ? (formRecipient === "member" ? { recipient: "member" } : { discord_user_id: formDiscordUserId.trim() })
        : (formRecipient === "member" ? { recipient: "member" } : { email: formEmail })

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
      case "discord_webhook": return <Radio className="h-5 w-5" style={{ color: "#5865F2" }} />
      case "discord_dm": return <MessageCircle className="h-5 w-5" style={{ color: "#5865F2" }} />
      case "email": return <Mail className="h-5 w-5" style={{ color: "#C05B2E" }} />
      default: return <Radio className="h-5 w-5" />
    }
  }

  const getChannelTypeLabel = (type: string) => {
    switch (type) {
      case "discord_webhook": return "Salon Discord"
      case "discord_dm": return "MP Discord"
      case "email": return "Email"
      default: return type
    }
  }

  const getChannelDetail = (channel: Channel) => {
    if (channel.type === "discord_webhook") {
      // Le secret n'est plus renvoyé en clair : on affiche l'indice masqué.
      return (channel.config.webhook_hint as string) || "Webhook configuré"
    }
    if (channel.type === "discord_dm") {
      return channel.config.recipient === "member" ? "Membre concerné par l'événement" : `ID ${channel.config.discord_user_id || ""}`
    }
    if (channel.type === "email") {
      return channel.config.recipient === "member"
        ? "Membre concerné par l'événement"
        : (channel.config.email as string) || ""
    }
    return ""
  }

  const labelPlaceholder =
    formType === "discord_webhook" ? "ex: #annonces"
    : formType === "discord_dm" ? "ex: MP aux joueurs"
    : formRecipient === "member" ? "ex: Email aux joueurs"
    : "ex: Contact du club"

  const submitDisabled =
    saving ||
    // En édition d'un webhook, l'URL peut rester vide (= conserver l'existante).
    (formType === "discord_webhook" ? (!isEditing && !formWebhookUrl)
      : formType === "discord_dm" ? (formRecipient === "fixed" && !formDiscordUserId.trim())
      : (formRecipient === "fixed" && !formEmail))

  if (clubLoading || !selectedClub || loading) {
    return <div className="mx-auto max-w-[760px] space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
  }

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-[26px] font-medium">Canaux</h1>
        <Button onClick={openCreate} className="shrink-0"><Plus className="mr-2 h-4 w-4" />Ajouter un canal</Button>
      </div>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Les destinations où vos notifications sont envoyées.</p>

      {/* ===================== Modale Nouveau / Modifier canal ===================== */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Modifier le canal" : "Nouveau canal"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Puces de type (création seulement) */}
            {!isEditing && (
              <div className="flex gap-2">
                {TYPES.map((t) => {
                  const active = formType === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setFormType(t.value)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-[12.5px] font-semibold transition-colors ${
                        active
                          ? "border-[color:var(--qt-copper-500)] bg-[color:var(--qt-copper-500)]/[0.08] text-foreground"
                          : "border-[color:var(--qt-sable-300,#DAD4C6)] text-muted-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.dot }} />
                      {t.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* --- Salon Discord (webhook) --- */}
            {formType === "discord_webhook" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[12.5px] font-semibold text-foreground/80">Nom du canal</label>
                  <Input placeholder={labelPlaceholder} value={formLabel} onChange={(e) => setFormLabel(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[12.5px] font-semibold text-foreground/80">URL du webhook</label>
                  <Input placeholder={isEditing ? "Laisser vide pour conserver l'URL actuelle" : "https://discord.com/api/webhooks/…"} value={formWebhookUrl} onChange={(e) => setFormWebhookUrl(e.target.value)} />
                  <p className="text-[11.5px] text-muted-foreground">Le webhook poste dans un salon. Paramètres du serveur › Intégrations › Webhooks.</p>
                </div>
              </div>
            )}

            {/* --- MP joueur (discord_dm) --- */}
            {formType === "discord_dm" && (
              <div className="space-y-3">
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Le bot envoie un <strong className="font-semibold text-foreground">message privé</strong> directement
                  au joueur concerné par l&apos;événement. Invitez-le une fois sur le serveur Discord de votre
                  communauté — il pourra ensuite écrire aux membres.
                </p>

                {BOT_INVITE_URL ? (
                  <a
                    href={BOT_INVITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2.5 rounded-[9px] px-3 py-3 text-[13.5px] font-semibold text-white"
                    style={{ background: "#5865F2" }}
                  >
                    <DiscordGlyph className="h-[18px] w-[18px]" />Inviter le bot sur Discord
                  </a>
                ) : (
                  <p className="text-[11.5px] text-muted-foreground">
                    Lien d&apos;invitation indisponible (NEXT_PUBLIC_DISCORD_APP_ID non configuré).
                  </p>
                )}
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  Vous serez redirigé vers Discord pour autoriser le bot sur votre serveur. Aucune permission de
                  modération n&apos;est demandée.
                </p>

                <div className="space-y-1.5">
                  <label className="block text-[12.5px] font-semibold text-foreground/80">Nom du canal</label>
                  <Input placeholder={labelPlaceholder} value={formLabel} onChange={(e) => setFormLabel(e.target.value)} />
                </div>

                {/* Option avancée : notifier toujours la même personne (capitaine, admin…). */}
                {formRecipient === "fixed" ? (
                  <div className="space-y-1.5">
                    <label className="block text-[12.5px] font-semibold text-foreground/80">ID Discord du destinataire</label>
                    <Input placeholder="ex: 137245874929861234" value={formDiscordUserId} onChange={(e) => setFormDiscordUserId(e.target.value)} />
                    <button
                      type="button"
                      onClick={() => { setFormRecipient("member"); setFormDiscordUserId("") }}
                      className="text-[11.5px] font-medium text-[color:var(--qt-copper-500)] hover:underline"
                    >
                      ← Revenir au membre concerné
                    </button>
                  </div>
                ) : !isEditing ? (
                  <button
                    type="button"
                    onClick={() => setFormRecipient("fixed")}
                    className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Notifier plutôt une personne précise (ID Discord)
                  </button>
                ) : null}
              </div>
            )}

            {/* --- Email --- */}
            {formType === "email" && (
              <div className="space-y-3">
                {/* Destinataire : au membre concerné (comme le MP) ou adresse fixe */}
                {!isEditing && (
                  <div className="flex gap-2">
                    {[
                      { value: "member", label: "Au membre concerné" },
                      { value: "fixed", label: "Adresse fixe" },
                    ].map((m) => {
                      const active = formRecipient === m.value
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setFormRecipient(m.value)}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-[12.5px] font-semibold transition-colors ${
                            active
                              ? "border-[color:var(--qt-copper-500)] bg-[color:var(--qt-copper-500)]/[0.08] text-foreground"
                              : "border-[color:var(--qt-sable-300,#DAD4C6)] text-muted-foreground hover:bg-secondary/50"
                          }`}
                        >
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#C05B2E" }} />
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                )}

                {formRecipient === "member" ? (
                  <>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      L&apos;email part à <strong className="font-semibold text-foreground">chaque joueur concerné</strong> par
                      l&apos;événement, à sa propre adresse. Rien à saisir : le hub la résout à l&apos;envoi, comme le MP Discord.
                    </p>
                    <div className="space-y-1.5">
                      <label className="block text-[12.5px] font-semibold text-foreground/80">Nom du canal</label>
                      <Input placeholder={labelPlaceholder} value={formLabel} onChange={(e) => setFormLabel(e.target.value)} />
                    </div>
                    <div className="rounded-lg border border-[color:var(--qt-sable-300,#DAD4C6)] bg-secondary/40 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
                      <strong className="font-semibold text-foreground/80">Conseil :</strong> avant de router vers les membres,
                      créez d&apos;abord un canal <span className="font-semibold">« Adresse fixe »</span> vers votre propre email
                      pour vérifier la réception réelle (mise en page, arrivée en boîte de réception).
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-[12.5px] font-semibold text-foreground/80">Nom du canal</label>
                      <Input placeholder={labelPlaceholder} value={formLabel} onChange={(e) => setFormLabel(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[12.5px] font-semibold text-foreground/80">Adresse email</label>
                      <Input type="email" placeholder="contact@monclub.fr" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
                      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                        Une adresse unique : le contact du club, ou la vôtre pour tester la réception réelle avant de router vers les membres.
                      </p>
                    </div>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => { setFormRecipient("member"); setFormEmail("") }}
                        className="text-[11.5px] font-medium text-[color:var(--qt-copper-500)] hover:underline"
                      >
                        ← Revenir au membre concerné
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
            <Button onClick={handleSubmit} disabled={submitDisabled}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Enregistrer" : "Créer le canal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== Liste des canaux ===================== */}
      {channels.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--qt-sable-300,#DAD4C6)] bg-card py-12 text-center">
          <Radio className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="mb-2 font-semibold">Aucun canal configuré</h3>
          <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">Ajoutez un salon Discord ou une adresse email pour commencer.</p>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Ajouter un canal</Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {channels.map((channel) => (
            <div key={channel.id} className="rounded-xl border border-[color:var(--qt-sable-300,#DAD4C6)] bg-card px-4 py-[15px]">
              <div className="flex items-center gap-3">
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-secondary">
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-[color:var(--qt-danger,#B5402F)]"><Trash2 className="h-4 w-4" /></Button>
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
          ))}
        </div>
      )}
    </div>
  )
}
