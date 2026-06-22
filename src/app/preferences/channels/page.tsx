"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useClub } from "@/lib/contexts/club-context"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Plus, Trash2, LogIn, Mail, MessageSquare, ShieldCheck } from "lucide-react"

interface UserChannel {
  id: string
  type: string
  label: string | null
  config: Record<string, unknown>
  is_verified?: boolean
}

const SOON = ["SMS", "WhatsApp", "Slack", "Telegram", "Notification push", "Webhook"]
const PROVIDERS = [
  { id: "discord", label: "Discord" },
  { id: "google", label: "Google" },
] as const

function channelView(c: UserChannel): { Icon: typeof Mail; primary: string; secondary: string } {
  if (c.type === "discord_dm") {
    return { Icon: MessageSquare, primary: c.label || "Discord", secondary: "Message privé Discord" }
  }
  return { Icon: Mail, primary: c.label || "Email", secondary: (c.config.email as string) || "" }
}

function UserChannelsContent() {
  const { loading: clubLoading, isAuthenticated } = useClub()
  const supabase = createClient()
  const [channels, setChannels] = useState<UserChannel[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      // Synchronise les canaux depuis les identités PROUVÉES (Discord/Google/GitHub).
      await fetch("/api/user/channels/sync", { method: "POST" }).catch(() => {})
      const res = await fetch("/api/user/channels")
      if (!res.ok) throw new Error()
      setChannels((await res.json()).channels || [])
    } catch {
      toast.error("Erreur lors du chargement des comptes")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Erreur OAuth renvoyée dans l'URL au retour de linkIdentity (query ou hash).
  useEffect(() => {
    if (typeof window === "undefined") return
    const q = new URLSearchParams(window.location.search)
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    if (q.get("discord") === "linked") {
      toast.success("Compte Discord connecté")
      window.history.replaceState({}, "", window.location.pathname)
      return
    }
    const code = q.get("error_code") || h.get("error_code")
    const desc = q.get("error_description") || h.get("error_description")
    if (!code && !desc) return
    const msg =
      code === "identity_already_exists"
        ? "Ce compte est déjà lié à un autre profil. Connectez-vous avec ce profil pour l'utiliser, ou détachez-le d'abord."
        : code === "discord_not_configured"
          ? "La connexion Discord n'est pas encore configurée côté serveur."
          : code?.startsWith("discord")
            ? "La connexion du compte Discord a échoué. Réessayez."
            : desc
              ? decodeURIComponent(desc.replace(/\+/g, " "))
              : "La connexion du compte a échoué."
    toast.error(msg)
    window.history.replaceState({}, "", window.location.pathname)
  }, [])

  const connect = async (provider: (typeof PROVIDERS)[number]["id"]) => {
    // Discord = canal de LIVRAISON : OAuth dédié (récupère l'ID, pas un login)
    // → gère n'importe quel compte, y compris un alt.
    if (provider === "discord") {
      window.location.href = "/api/user/channels/discord/start"
      return
    }
    // Email (Google…) = identité Supabase liée (email vérifié par le provider).
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: typeof window !== "undefined" ? window.location.href : undefined },
    })
    if (error) {
      toast.error(error.message || "Connexion impossible — ce compte est peut-être déjà lié à un autre profil.")
    }
  }

  const handleDelete = async (channelId: string) => {
    try {
      const res = await fetch(`/api/user/channels/${channelId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setChannels((prev) => prev.filter((c) => c.id !== channelId))
      toast.success("Canal retiré")
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
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-24" /></div>
  }

  return (
    <div className="max-w-[720px] mx-auto py-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-[26px] font-medium">Mes comptes</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="bg-[#24405E] text-white hover:bg-[#24405E]/90 shrink-0">
              <Plus className="h-4 w-4 mr-2" />Connecter un compte
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {PROVIDERS.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => connect(p.id)}>{p.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Connectez vos comptes (Discord, Google) pour recevoir vos notifications là où vous êtes. La
        possession est <strong>vérifiée par le service</strong> — on n&apos;envoie jamais vers une adresse non prouvée.
      </p>

      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-7">
          Aucun compte connecté. Cliquez « Connecter un compte » pour recevoir vos notifications par email ou Discord.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5 mb-7">
          {channels.map((channel) => {
            const { Icon, primary, secondary } = channelView(channel)
            return (
              <div key={channel.id} className="bg-white border border-[#DAD4C6] rounded-xl px-4 py-3.5 flex items-center gap-3">
                <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-white shrink-0" style={{ background: "#24405E" }}>
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{primary}</div>
                  <div className="text-xs text-muted-foreground truncate">{secondary}</div>
                </div>
                <span
                  className="mono-label text-[10px] rounded-full px-2 py-0.5 inline-flex items-center gap-1"
                  style={{ background: "color-mix(in srgb, #2F7D5B 12%, white)", color: "#2F7D5B" }}
                >
                  <ShieldCheck className="h-3 w-3" />Vérifié
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-[#B5402F]">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Retirer ce canal ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Vous ne recevrez plus de notifications ici. Tant que le compte reste connecté, il peut
                        réapparaître ; déconnectez le compte pour le retirer définitivement.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(channel.id)}>Retirer</AlertDialogAction>
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
          <span key={name} className="inline-flex items-center gap-2 rounded-full border border-dashed border-[#DAD4C6] px-3 py-1.5 text-xs text-muted-foreground">
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
