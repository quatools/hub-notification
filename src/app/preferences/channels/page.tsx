"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import { Plus, Trash2, Loader2, LogIn } from "lucide-react"

interface UserChannel {
  id: string
  type: string
  label: string | null
  config: Record<string, unknown>
  created_at: string
}

const SOON = ["SMS", "WhatsApp", "Slack", "Telegram", "Notification push", "Webhook"]

function vignetteForChannel(channel: UserChannel): { bg: string; initial: string } {
  const email = (channel.config.email as string | undefined) || ""
  if (channel.type === "email") {
    return { bg: "#24405E", initial: email ? "@" : "@" }
  }
  const source = channel.label || email
  return { bg: "#24405E", initial: (source.charAt(0) || "?").toUpperCase() }
}

function UserChannelsContent() {
  const { loading: clubLoading, isAuthenticated } = useClub()
  const [channels, setChannels] = useState<UserChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newEmail, setNewEmail] = useState("")

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/user/channels")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setChannels(data.channels || [])
    } catch {
      toast.error("Erreur lors du chargement des canaux")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchChannels() }, [fetchChannels])

  const handleCreate = async () => {
    if (!newEmail) return
    setCreating(true)
    try {
      const res = await fetch("/api/user/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "email",
          label: newLabel || undefined,
          config: { email: newEmail },
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Erreur lors de la création")
        return
      }
      toast.success("Canal ajouté")
      setCreateOpen(false)
      setNewLabel("")
      setNewEmail("")
      fetchChannels()
    } catch {
      toast.error("Erreur lors de la création")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (channelId: string) => {
    try {
      const res = await fetch(`/api/user/channels/${channelId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setChannels((prev) => prev.filter((c) => c.id !== channelId))
      toast.success("Canal supprimé")
    } catch {
      toast.error("Erreur lors de la suppression")
    }
  }

  if (clubLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-24" /></div>
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <LogIn className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Connexion requise</h2>
        <p className="text-muted-foreground">Connectez-vous pour gérer vos comptes.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  return (
    <div className="max-w-[720px] mx-auto py-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-[26px] font-medium">Mes comptes</h1>
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setNewLabel(""); setNewEmail("") } }}>
          <DialogTrigger asChild>
            <Button className="bg-[#24405E] text-white hover:bg-[#24405E]/90 shrink-0">
              <Plus className="h-4 w-4 mr-2" />Ajouter un email
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une adresse email</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Label (optionnel)</Label>
                <Input
                  placeholder="ex: Email perso"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Adresse email</Label>
                <Input
                  type="email"
                  placeholder="mon.email@exemple.fr"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={creating || !newEmail} className="bg-[#24405E] text-white hover:bg-[#24405E]/90">
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Connectez vos comptes pour recevoir vos notifications là où vous êtes.
      </p>

      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-7">Aucun compte pour l&apos;instant.</p>
      ) : (
        <div className="flex flex-col gap-2.5 mb-7">
          {channels.map((channel) => {
            const { bg, initial } = vignetteForChannel(channel)
            return (
              <div
                key={channel.id}
                className="bg-white border border-[#DAD4C6] rounded-xl px-4 py-3.5 flex items-center gap-3"
              >
                <div
                  className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: bg }}
                >
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{channel.label || "Email"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {channel.config.email as string}
                  </div>
                </div>
                <span
                  className="mono-label text-[10px] rounded-full px-2 py-0.5"
                  style={{
                    background: "color-mix(in srgb, #2F7D5B 12%, white)",
                    color: "#2F7D5B",
                  }}
                >
                  Vérifié
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-[#B5402F]">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer ce compte ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Vous ne recevrez plus de notifications sur cette adresse.
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
            )
          })}
        </div>
      )}

      <div className="mono-label mb-3">Bientôt · le hub se connecte à tout</div>
      <div className="flex flex-wrap gap-2">
        {SOON.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-[#DAD4C6] px-3 py-1.5 text-xs text-muted-foreground"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#C9CDD6]" />
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function UserChannelsPage() {
  return <UserChannelsContent />
}
