"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useClub } from "@/lib/contexts/club-context"
import { createClient } from "@/lib/supabase/client"
import { DiscordLoginButton } from "@/components/discord-login-button"
import { toast } from "sonner"
import Link from "next/link"
import { Bell, Mail, Palette, Sparkles, Users, ShieldCheck, AlertCircle } from "lucide-react"

interface DashboardData {
  active_workflows: number
  sent_7d: number
  success_rate: number | null
  to_configure: { label: string; color: string }[]
  activity: { text: string; color: string; time: string }[]
  unsubscribes: { event: string; total: number; reasons: Record<string, number> }[]
}

const REASON_LABELS: Record<string, string> = {
  trop_souvent: "Trop souvent",
  pas_pertinent: "Pas pertinent",
  mauvais_moment: "Mauvais moment",
  autre_canal: "Autre canal",
  autre: "Autre",
}

export default function AdminDashboardPage() {
  const { selectedClub, loading: clubLoading, isAuthenticated, clubs } = useClub()
  const orgId = selectedClub?.club_id
  const orgParam = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("org")
    : null
  const dateLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [adminName, setAdminName] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) return
      const m = (u.user_metadata || {}) as Record<string, string>
      const full = m.full_name || m.name || u.email || ""
      setAdminName(full.split(" ")[0] || full.split("@")[0] || null)
    })
  }, [])

  const fetchData = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      const res = await fetch(`/api/admin/dashboard?org_id=${orgId}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      toast.error("Erreur lors du chargement du tableau de bord")
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
          <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
        </div>
      </div>
    )
  }

  // --- Accueil non connecté (landing pédagogique partenaire) ---
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
      <div className="mx-auto max-w-lg py-16 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="mb-2 text-xl font-semibold">Aucune organisation associée</h2>
        <p className="text-sm text-muted-foreground">
          Deux possibilités : <strong>configurez votre application</strong> pour la connecter au hub
          (créez-la et générez votre clé dans l&apos;espace développeur), ou <strong>rattachez vos
          notifications</strong> depuis une plateforme partenaire Quatools — via le bouton
          « Gérer mes notifications » de cette plateforme.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/developer">Configurer mon application</Link>
          </Button>
          <Button variant="outline" asChild>
            <a href="https://www.quatools.fr/hub/docs" target="_blank" rel="noopener noreferrer">
              Documentation
            </a>
          </Button>
        </div>
      </div>
    )
  }

  if (!selectedClub) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sélectionnez une organisation</h2>
        <p className="text-muted-foreground">Choisissez une organisation dans le menu en haut de page.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
        </div>
        <Skeleton className="h-40" />
      </div>
    )
  }

  const successLabel = data?.success_rate == null
    ? "—"
    : `${data.success_rate.toFixed(1).replace(".", ",")}%`

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="mono-label">{dateLabel} · {selectedClub.club_name}</div>
        <h1 className="font-serif text-3xl font-normal">Bonjour{adminName ? ` ${adminName}` : ""}.</h1>
      </div>

      {/* Stats santé */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Notifications actives" value={String(data?.active_workflows ?? 0)} />
        <StatCard label="Envoyées · 7 jours" value={String(data?.sent_7d ?? 0)} />
        <StatCard label="Taux de succès" value={successLabel} success />
      </div>

      {/* À configurer */}
      {data?.to_configure && data.to_configure.length > 0 && (
        <div className="space-y-3">
          <div className="mono-label text-[color:var(--qt-copper-500)]">
            À configurer · événements sans notification
          </div>
          <div className="space-y-2">
            {data.to_configure.map((t, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                <span className="h-1.5 w-1.5 rounded-sm shrink-0" style={{ background: t.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{t.label}</div>
                  <div className="text-xs text-muted-foreground">Personne n&apos;est prévenu</div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/workflows">Configurer</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Désabonnements · feedback membre (data du club) */}
      {data?.unsubscribes && data.unsubscribes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="mono-label">Désabonnements · pourquoi vos membres partent</div>
            <Link href="/admin/unsubscribes" className="shrink-0 text-xs font-semibold text-[color:var(--qt-copper-500)] hover:underline">Voir qui →</Link>
          </div>
          <Card>
            <CardContent className="px-4 py-1">
              {data.unsubscribes.map((u, i) => {
                const reasons = Object.entries(u.reasons).sort((a, b) => b[1] - a[1])
                const noReason = u.total - reasons.reduce((s, [, c]) => s + c, 0)
                return (
                  <div key={i} className="py-3 border-b last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{u.event}</div>
                      <div className="font-mono text-xs text-muted-foreground shrink-0">{u.total} désab.</div>
                    </div>
                    {(reasons.length > 0 || noReason > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {reasons.map(([r, c]) => (
                          <span key={r} className="rounded-full bg-secondary px-2.5 py-1 text-[11.5px] text-muted-foreground">
                            {REASON_LABELS[r] || r} · <strong className="text-foreground">{c}</strong>
                          </span>
                        ))}
                        {noReason > 0 && (
                          <span className="rounded-full px-2.5 py-1 text-[11.5px] text-muted-foreground/60">sans raison · {noReason}</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Activité récente */}
      <div className="space-y-3">
        <div className="mono-label">Activité récente</div>
        <Card>
          <CardContent className="px-4 py-1">
            {data?.activity && data.activity.length > 0 ? (
              data.activity.map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b last:border-0">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: a.color }} />
                  <span className="flex-1 min-w-0 text-sm text-foreground/80 truncate">{a.text}</span>
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{a.time}</span>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-muted-foreground">Aucune notification envoyée pour l&apos;instant.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ label, value, success }: { label: string; value: string; success?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="mono-label">{label}</div>
      </CardHeader>
      <CardContent>
        <div className={`font-serif text-4xl font-medium leading-none ${success ? "text-[color:var(--qt-success)]" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
