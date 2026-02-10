"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import Link from "next/link"
import { Radio, Workflow, ScrollText, AlertCircle, CheckCircle, XCircle, LogIn } from "lucide-react"

interface DashboardData {
  events_count: number
  workflows_count: number
  channels_count: number
  recent_logs: Array<{
    id: string
    event_slug: string
    status: string
    created_at: string
  }>
}

export default function AdminDashboardPage() {
  const { selectedClub, loading: clubLoading, isAuthenticated, clubs } = useClub()
  const orgId = selectedClub?.club_id
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      const [eventsRes, workflowsRes, channelsRes, logsRes] = await Promise.all([
        fetch(`/api/admin/events?org_id=${orgId}`),
        fetch(`/api/admin/workflows?org_id=${orgId}`),
        fetch(`/api/admin/channels?org_id=${orgId}`),
        fetch(`/api/admin/logs?org_id=${orgId}&limit=5`),
      ])

      const events = eventsRes.ok ? await eventsRes.json() : { events: [] }
      const workflows = workflowsRes.ok ? await workflowsRes.json() : { events_with_workflows: [] }
      const channels = channelsRes.ok ? await channelsRes.json() : { channels: [] }
      const logs = logsRes.ok ? await logsRes.json() : { logs: [] }

      const wfCount = workflows.events_with_workflows?.reduce(
        (sum: number, e: { workflows: unknown[] }) => sum + (e.workflows?.length || 0), 0
      ) || 0

      setData({
        events_count: events.events?.length || 0,
        workflows_count: wfCount,
        channels_count: channels.channels?.length || 0,
        recent_logs: logs.logs || [],
      })
    } catch {
      toast.error("Erreur lors du chargement du dashboard")
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  if (clubLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <LogIn className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Connexion requise</h2>
        <p className="text-muted-foreground">
          Connectez-vous pour accéder à l&apos;espace d&apos;administration.
        </p>
      </div>
    )
  }

  if (clubs.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Aucun club</h2>
        <p className="text-muted-foreground">
          Vous n&apos;êtes administrateur d&apos;aucun club. Créez ou rejoignez un club depuis le BAAS.
        </p>
      </div>
    )
  }

  if (!selectedClub) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sélectionnez un club</h2>
        <p className="text-muted-foreground">
          Choisissez un club dans le menu en haut de page.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard — {selectedClub.club_name}</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4" />
                Canaux configurés
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data?.channels_count || 0}</div>
            {data?.channels_count === 0 && (
              <Button variant="link" className="px-0 text-sm" asChild>
                <Link href="/admin/channels">Configurer un canal</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4" />
                Workflows actifs
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data?.workflows_count || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              sur {data?.events_count || 0} événements disponibles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <ScrollText className="h-4 w-4" />
                Dernières notifications
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recent_logs && data.recent_logs.length > 0 ? (
              <div className="space-y-2">
                {data.recent_logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-sm">
                    <span className="truncate mr-2">{log.event_slug}</span>
                    <Badge variant={log.status === "sent" ? "default" : "destructive"} className="text-xs">
                      {log.status === "sent" ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {log.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune notification envoyée</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      {data?.channels_count === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Radio className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Commencez par configurer un canal</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ajoutez un webhook Discord ou une adresse email pour recevoir vos notifications.
            </p>
            <Button asChild>
              <Link href="/admin/channels">Configurer un canal</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
