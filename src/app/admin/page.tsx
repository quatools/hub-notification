"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useClub } from "@/lib/contexts/club-context"
import { FlowDiagram } from "@/components/flow-diagram"
import { toast } from "sonner"
import Link from "next/link"
import { DiscordLoginButton } from "@/components/discord-login-button"
import { Radio, Workflow, ScrollText, AlertCircle, CheckCircle, CheckCircle2, XCircle, ArrowRight, Bell, Mail, Palette, Sparkles, Users, ShieldCheck } from "lucide-react"

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
  // Club d'origine passé par l'app partenaire (?org=) — préservé à la connexion.
  const orgParam = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("org")
    : null
  const dateLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
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
      <div className="flex items-center justify-center py-8 px-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl leading-snug">
              Centralisez vos notifications.<br />Donnez le contrôle à vos membres.
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Le service de notifications partenaire de votre plateforme — à vos couleurs.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span><strong>Email + Discord</strong> (et les canaux suivants), une seule intégration — sans retoucher vos apps.</span>
              </li>
              <li className="flex items-start gap-3">
                <Palette className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span><strong>En marque blanche</strong>, à vos couleurs.</span>
              </li>
              <li className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span><strong>Configurable par l&apos;IA</strong> (connecteur Claude).</span>
              </li>
              <li className="flex items-start gap-3">
                <Users className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span>Des <strong>préférences que vos membres possèdent</strong> vraiment.</span>
              </li>
            </ul>

            <DiscordLoginButton next={orgParam ? `/admin?org=${orgParam}` : "/admin"} className="w-full" />

            <p className="flex items-start justify-center gap-1.5 text-xs text-muted-foreground text-center">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Connexion via votre compte partenaire. Vos clubs apparaissent automatiquement, rien à recréer.</span>
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (clubs.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Aucune organisation</h2>
        <p className="text-muted-foreground">
          Vous n&apos;êtes administrateur d&apos;aucune organisation.
        </p>
      </div>
    )
  }

  if (!selectedClub) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sélectionnez une organisation</h2>
        <p className="text-muted-foreground">
          Choisissez une organisation dans le menu en haut de page.
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
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="mono-label capitalize">{dateLabel} · {selectedClub.club_name}</div>
        <h1 className="font-serif text-3xl font-normal">Bonjour.</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Vue d&apos;ensemble des notifications de votre organisation : ce qui est configuré et ce qui a été envoyé.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="mono-label flex items-center gap-2">
                <Workflow className="h-3.5 w-3.5" />
                Notifications actives
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-4xl font-medium leading-none">{data?.workflows_count || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">
              sur{" "}
              <Link href="/admin/events" className="underline underline-offset-2 hover:text-foreground">
                {data?.events_count || 0} événements disponibles
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="mono-label flex items-center gap-2">
                <Radio className="h-3.5 w-3.5" />
                Canaux configurés
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-4xl font-medium leading-none">{data?.channels_count || 0}</div>
            {data?.channels_count === 0 && (
              <Button variant="link" className="px-0 text-sm h-auto mt-1" asChild>
                <Link href="/admin/channels">Configurer un canal</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="mono-label flex items-center gap-2">
                <ScrollText className="h-3.5 w-3.5" />
                Dernières notifications
            </div>
          </CardHeader>
          <CardContent>
            {data?.recent_logs && data.recent_logs.length > 0 ? (
              <div className="space-y-2">
                {data.recent_logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-sm">
                    <span className="truncate mr-2">{log.event_slug}</span>
                    <span className={`inline-flex items-center gap-1 font-mono text-xs ${log.status === "sent" ? "text-[color:var(--qt-success)]" : "text-destructive"}`}>
                      {log.status === "sent" ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune notification envoyée</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comment ça marche */}
      <Card>
        <CardHeader className="pb-4">
          <div className="mono-label mb-1">Comment ça marche</div>
          <p className="text-sm text-muted-foreground">
            Vos applications Quatools (BAAS, Cours…) émettent des événements. Vous décidez lesquels
            déclenchent un message, vers où, et avec quel contenu.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <FlowDiagram />
          <div className="grid gap-2 sm:grid-cols-3">
            <OnboardingStep
              num={1}
              done={(data?.channels_count || 0) > 0}
              title="Créez un canal"
              detail="Webhook Discord ou email : la destination des messages."
              href="/admin/channels"
              linkLabel="Gérer les canaux"
            />
            <OnboardingStep
              num={2}
              done={(data?.workflows_count || 0) > 0}
              title="Créez un workflow"
              detail="Choisissez un événement, un canal et rédigez le message."
              href="/admin/workflows"
              linkLabel="Gérer les workflows"
            />
            <OnboardingStep
              num={3}
              done={(data?.recent_logs?.length || 0) > 0}
              title="Les envois partent seuls"
              detail="Dès qu'un événement survient, le message est envoyé et tracé."
              href="/admin/logs"
              linkLabel="Voir l'historique"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function OnboardingStep({ num, done, title, detail, href, linkLabel }: {
  num: number
  done: boolean
  title: string
  detail: string
  href: string
  linkLabel: string
}) {
  return (
    <div className={`rounded-lg border p-3 ${done ? "bg-muted/40" : ""}`}>
      <div className="flex items-center gap-2 mb-1">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        ) : (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold text-muted-foreground">
            {num}
          </span>
        )}
        <span className={`text-sm font-semibold ${done ? "text-muted-foreground" : ""}`}>{title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-2">{detail}</p>
      <Button variant="link" size="sm" className="h-auto px-0 text-xs" asChild>
        <Link href={href}>
          {linkLabel}
          <ArrowRight className="h-3 w-3 ml-1" />
        </Link>
      </Button>
    </div>
  )
}
