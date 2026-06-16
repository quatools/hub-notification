"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import Link from "next/link"
import { Radio, Mail, MessageCircle, BellOff, Info, LogIn } from "lucide-react"

interface WorkflowOptout {
  workflow_id: string
  event_id: string
  event_label: string
  event_category: string
  channel_type: string
  channel_label: string | null
  is_opted_out: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  billing: "Facturation",
  member: "Membres",
  team: "Équipes",
  shop: "Boutique & préventes",
  system: "Système",
}

function PreferencesContent() {
  const { selectedClub, loading: clubLoading, isAuthenticated } = useClub()
  const orgId = selectedClub?.club_id || null
  const [workflows, setWorkflows] = useState<WorkflowOptout[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const fetchOptouts = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      const res = await fetch(`/api/user/optouts?org_id=${orgId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setWorkflows(data.workflows || [])
    } catch {
      toast.error("Erreur lors du chargement des préférences")
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { fetchOptouts() }, [fetchOptouts])

  const handleToggle = async (workflowId: string, currentOptedOut: boolean) => {
    setToggling(workflowId)
    try {
      const res = await fetch("/api/user/optouts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_id: workflowId, opted_out: !currentOptedOut }),
      })
      if (!res.ok) throw new Error()
      setWorkflows((prev) =>
        prev.map((wf) =>
          wf.workflow_id === workflowId ? { ...wf, is_opted_out: !currentOptedOut } : wf
        )
      )
      toast.success(!currentOptedOut ? "Notification désactivée" : "Notification réactivée")
    } catch {
      toast.error("Erreur lors de la mise à jour")
    } finally {
      setToggling(null)
    }
  }

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "discord_webhook": return <Radio className="h-4 w-4 text-indigo-500" />
      case "discord_dm": return <MessageCircle className="h-4 w-4 text-indigo-500" />
      case "email": return <Mail className="h-4 w-4 text-blue-500" />
      default: return <Radio className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getChannelLabel = (wf: WorkflowOptout) => {
    if (wf.channel_label) return wf.channel_label
    switch (wf.channel_type) {
      case "discord_webhook": return "Discord (salon)"
      case "discord_dm": return "Discord (message privé)"
      case "email": return "Email"
      default: return wf.channel_type
    }
  }

  // Group: catégorie -> événement -> canaux (un toggle par canal)
  const categories = useMemo(() => {
    const cats = new Map<string, Map<string, { label: string; items: WorkflowOptout[] }>>()
    for (const wf of workflows) {
      const cat = CATEGORY_LABELS[wf.event_category] || wf.event_category || "Autre"
      if (!cats.has(cat)) cats.set(cat, new Map())
      const evMap = cats.get(cat)!
      const key = wf.event_id || wf.event_label
      if (!evMap.has(key)) evMap.set(key, { label: wf.event_label, items: [] })
      evMap.get(key)!.items.push(wf)
    }
    return Array.from(cats.entries()).map(([cat, evMap]) => ({
      category: cat,
      events: Array.from(evMap.values()),
    }))
  }, [workflows])

  if (clubLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <LogIn className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Connexion requise</h2>
        <p className="text-muted-foreground mb-4">Connectez-vous pour gérer vos notifications.</p>
        <Button asChild>
          <Link href="/login">Se connecter</Link>
        </Button>
      </div>
    )
  }

  if (!selectedClub) {
    return (
      <div className="text-center py-12">
        <BellOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sélectionnez une organisation</h2>
        <p className="text-muted-foreground">Choisissez une organisation dans le menu en haut de page.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-medium">Mes notifications</h1>
        <p className="text-muted-foreground mt-1">
          Voici ce qui vous est envoyé, et sur quels canaux. Un même événement peut partir sur plusieurs
          canaux&nbsp;: activez ou désactivez chacun comme vous le souhaitez.
        </p>
      </div>

      {workflows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <BellOff className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Aucune notification configurée</h3>
            <p className="text-sm text-muted-foreground">
              L&apos;administrateur n&apos;a pas encore configuré de notifications vous concernant.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {categories.map(({ category, events }) => (
            <div key={category}>
              <h2 className="mono-label mb-3">{category}</h2>
              <div className="space-y-3">
                {events.map((ev) => (
                  <Card key={ev.label} className="overflow-hidden">
                    <CardHeader className="py-3 px-4 bg-muted/30 border-b">
                      <CardTitle className="text-sm font-semibold">{ev.label}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ev.items.length === 1 ? "Envoyé sur 1 canal" : `Envoyé sur ${ev.items.length} canaux`}
                      </p>
                    </CardHeader>
                    <CardContent className="p-0 divide-y">
                      {ev.items.map((wf) => (
                        <div key={wf.workflow_id} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {getChannelIcon(wf.channel_type)}
                            <span className="text-sm truncate">{getChannelLabel(wf)}</span>
                            {wf.is_opted_out && (
                              <Badge variant="secondary" className="text-xs shrink-0">Désactivé</Badge>
                            )}
                          </div>
                          <Switch
                            checked={!wf.is_opted_out}
                            onCheckedChange={() => handleToggle(wf.workflow_id, wf.is_opted_out)}
                            disabled={toggling === wf.workflow_id}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1.5">
              <p>
                Quand un canal n&apos;a pas d&apos;adresse fixe, la notification part sur les coordonnées
                fournies par le service qui la déclenche (l&apos;email ou le Discord que votre application a
                pour vous).{" "}
                <Link href="/preferences/history" className="underline underline-offset-2 hover:text-foreground">
                  Consultez votre historique
                </Link>{" "}
                pour voir sur quels comptes vos notifications ont été envoyées.
              </p>
              <p>
                Pour <strong>rerouter ou renvoyer</strong> vos notifications vers vos propres adresses, connectez
                un canal dans{" "}
                <Link href="/preferences/channels" className="underline underline-offset-2 hover:text-foreground">
                  «&nbsp;Mes canaux de réception&nbsp;»
                </Link>.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function PreferencesPage() {
  return <PreferencesContent />
}
