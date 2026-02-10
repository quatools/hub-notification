"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState, useCallback, Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { Plus, Mail, Trash2, Loader2 } from "lucide-react"

interface UserChannel {
  id: string
  type: string
  label: string | null
  config: Record<string, unknown>
  created_at: string
}

function UserChannelsContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get("org_id")
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

  if (!orgId) {
    return (
      <div className="text-center py-12">
        <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Mes canaux</h2>
        <p className="text-muted-foreground">
          Accédez à cette page depuis votre application avec le paramètre <code>org_id</code>.
        </p>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mes canaux</h1>
          <p className="text-muted-foreground mt-1">
            Ajoutez des adresses email alternatives pour recevoir vos notifications personnelles.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setNewLabel(""); setNewEmail("") } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Ajouter un email</Button>
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
              <Button onClick={handleCreate} disabled={creating || !newEmail}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {channels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Mail className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Aucun canal personnel</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ajoutez une adresse email pour recevoir des notifications personnalisées.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Ajouter un email
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {channels.map((channel) => (
            <Card key={channel.id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-blue-500" />
                    <div>
                      <CardTitle className="text-base">
                        {channel.label || "Email"}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {channel.config.email as string}
                      </p>
                    </div>
                  </div>
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
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function UserChannelsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <UserChannelsContent />
    </Suspense>
  )
}
