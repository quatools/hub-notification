"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import Link from "next/link"
import { Radio, Mail, MessageCircle, History, LogIn, CheckCircle2, XCircle, Clock } from "lucide-react"

interface HistoryItem {
  id: string
  event_label: string
  event_category: string | null
  channel_type: string | null
  channel_label: string | null
  destination: string | null
  status: "pending" | "sent" | "failed"
  sent_at: string | null
  created_at: string
}

function HistoryContent() {
  const { selectedClub, loading: clubLoading, isAuthenticated } = useClub()
  const orgId = selectedClub?.club_id || null
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/user/history?org_id=${orgId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setItems(data.items || [])
    } catch {
      toast.error("Erreur lors du chargement de l'historique")
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const channelIcon = (type: string | null) => {
    switch (type) {
      case "discord_webhook": return <Radio className="h-4 w-4 text-indigo-500" />
      case "discord_dm": return <MessageCircle className="h-4 w-4 text-indigo-500" />
      case "email": return <Mail className="h-4 w-4 text-blue-500" />
      default: return <Radio className="h-4 w-4 text-muted-foreground" />
    }
  }

  const statusBadge = (status: HistoryItem["status"]) => {
    if (status === "sent") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1"><CheckCircle2 className="h-3 w-3" />Reçue</Badge>
    if (status === "failed") return <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100 gap-1"><XCircle className="h-3 w-3" />Échec</Badge>
    return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />En cours</Badge>
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

  // « Sur quel compte » : adresse résolue, présentée de façon lisible.
  const destinationLabel = (it: HistoryItem) => {
    if (it.channel_type === "email") return it.destination || "votre email"
    if (it.channel_type === "discord_dm") return "votre Discord"
    if (it.channel_type === "discord_webhook") return it.channel_label || "salon Discord"
    return it.destination || it.channel_label || "—"
  }

  if (clubLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <LogIn className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Connexion requise</h2>
        <p className="text-muted-foreground mb-4">Connectez-vous pour voir votre historique.</p>
        <Button asChild><Link href="/login">Se connecter</Link></Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-medium">Historique</h1>
        <p className="text-muted-foreground mt-1">
          Les notifications qui vous ont été envoyées, et par quel canal.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <History className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Aucune notification pour l&apos;instant</h3>
            <p className="text-sm text-muted-foreground">
              Les notifications que vous recevrez apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <Card key={it.id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {channelIcon(it.channel_type)}
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-medium truncate">{it.event_label}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Envoyé à <span className="font-medium text-foreground/80">{destinationLabel(it)}</span>
                        {" · "}{fmt(it.sent_at || it.created_at)}
                      </p>
                    </div>
                  </div>
                  {statusBadge(it.status)}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HistoryPage() {
  return <HistoryContent />
}
