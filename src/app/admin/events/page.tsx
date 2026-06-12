"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import Link from "next/link"
import { Zap, Radio, Mail, MessageCircle, Search, Info, Workflow as WorkflowIcon, ArrowRight, ChevronDown, ChevronRight } from "lucide-react"

interface Event {
  id: string
  app: string
  slug: string
  label: string
  description: string | null
  category: string
  supported_channels: string[]
  audiences: string[]
  payload_schema: Record<string, unknown> | null
}

interface EventWithWorkflows {
  event: Event
  workflows: Array<{ id: string; is_active: boolean }>
}

const CATEGORY_LABELS: Record<string, string> = {
  billing: "Facturation",
  member: "Membres",
  team: "Équipes",
  shop: "Boutique & préventes",
  system: "Système",
}

const APP_LABELS: Record<string, string> = {
  "baas-esport": "BAAS Esport",
  "cours-quatools": "Cours Quatools",
  "facturation-quatools": "Facturation Quatools",
}

export default function AdminEventsPage() {
  const { selectedClub, loading: clubLoading } = useClub()
  const orgId = selectedClub?.club_id
  const [items, setItems] = useState<EventWithWorkflows[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const fetchEvents = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      const res = await fetch(`/api/admin/workflows?org_id=${orgId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setItems(data.events_with_workflows || [])
    } catch {
      toast.error("Erreur lors du chargement des événements")
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { setLoading(true); fetchEvents() }, [fetchEvents])

  // Filtre texte puis groupement par catégorie
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? items.filter(({ event }) =>
          event.label.toLowerCase().includes(q) ||
          event.slug.toLowerCase().includes(q) ||
          (event.description || "").toLowerCase().includes(q)
        )
      : items

    const map = new Map<string, EventWithWorkflows[]>()
    for (const item of filtered) {
      const cat = CATEGORY_LABELS[item.event.category] || item.event.category || "Autre"
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(item)
    }
    return Array.from(map.entries())
  }, [items, search])

  const apps = useMemo(
    () => Array.from(new Set(items.map(({ event }) => event.app))),
    [items]
  )

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  if (clubLoading || !selectedClub || loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Événements"
        description="La liste de tout ce que vos applications savent signaler : chaque événement ci-dessous peut déclencher l'envoi d'un message vers vos équipes ou vos clients. Pour l'utiliser, créez un workflow dessus."
        flowStep="event"
        actions={
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un événement…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 pl-8"
            />
          </div>
        }
      />

      <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          Ce catalogue est <span className="font-medium text-foreground">déclaré à l&apos;avance</span> par
          vos applications ({apps.map((a) => APP_LABELS[a] || a).join(", ") || "aucune pour l'instant"}) —
          inutile d&apos;attendre qu&apos;un événement se produise pour le voir ici. Quand une application
          ajoute de nouveaux événements, ils apparaissent automatiquement dans cette liste.
        </p>
      </div>

      {grouped.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Zap className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Aucun événement trouvé</h3>
            <p className="text-sm text-muted-foreground">
              {search ? "Essayez une autre recherche." : "Aucune application n'a encore déclaré d'événements."}
            </p>
          </CardContent>
        </Card>
      ) : (
        grouped.map(([category, categoryItems]) => (
          <div key={category}>
            <button
              className="flex items-center gap-2 text-lg font-semibold mb-3 hover:text-foreground/80 transition-colors"
              onClick={() => toggleCategory(category)}
            >
              {collapsed.has(category) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {category}
              <span className="text-sm font-normal text-muted-foreground">({categoryItems.length})</span>
            </button>

            {!collapsed.has(category) && (
              <div className="space-y-3">
                {categoryItems.map(({ event, workflows }) => {
                  const activeCount = workflows.filter((w) => w.is_active).length
                  const variables = event.payload_schema ? Object.keys(event.payload_schema) : []
                  return (
                    <Card key={event.id}>
                      <CardContent className="py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{event.label}</span>
                              <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{event.slug}</code>
                              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                {APP_LABELS[event.app] || event.app}
                              </Badge>
                            </div>
                            {event.description && (
                              <p className="text-sm text-muted-foreground">{event.description}</p>
                            )}
                            {variables.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                <span className="text-xs text-muted-foreground mr-1">Variables pour vos messages :</span>
                                {variables.map((v) => (
                                  <code key={v} className="rounded bg-muted px-1.5 py-0.5 text-xs">{`{{${v}}}`}</code>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              {event.supported_channels.includes("discord_webhook") && <Radio className="h-4 w-4 text-indigo-500" />}
                              {event.supported_channels.includes("discord_dm") && <MessageCircle className="h-4 w-4 text-violet-500" />}
                              {event.supported_channels.includes("email") && <Mail className="h-4 w-4 text-blue-500" />}
                            </div>
                            {activeCount > 0 ? (
                              <Badge variant="default" className="text-xs">
                                <WorkflowIcon className="h-3 w-3 mr-1" />
                                {activeCount} workflow{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""}
                              </Badge>
                            ) : (
                              <Button variant="link" size="sm" className="h-auto px-0 text-xs" asChild>
                                <Link href="/admin/workflows">
                                  Créer un workflow
                                  <ArrowRight className="h-3 w-3 ml-1" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
