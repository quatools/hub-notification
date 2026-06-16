"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { MessagePreview } from "@/components/message-preview"
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, X, AlertTriangle } from "lucide-react"

interface RenderedContent {
  subject: string | null
  body: string
  format: string
  channel_type: string | null
}

interface LogEntry {
  id: string
  workflow_id: string | null
  event_slug: string
  channel_id: string | null
  user_id: string
  org_id: string | null
  status: string
  payload: Record<string, unknown> | null
  rendered_content: RenderedContent | null
  error_message: string | null
  attempts: number
  sent_at: string | null
  created_at: string
  is_test?: boolean
  destination?: string | null
  events?: { label: string; category: string } | null
  channels?: { type: string; label: string | null } | null
}

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "sent", label: "Envoyés" },
  { key: "failed", label: "Échecs" },
]

function chanWord(type?: string | null) {
  if (type === "email") return "Email"
  if (type === "discord_webhook") return "Discord"
  if (type === "discord_dm") return "MP Discord"
  return "Notification"
}

function statusColor(status: string) {
  if (status === "sent") return "#2F7D5B"
  if (status === "failed") return "#B5402F"
  return "#9197A1"
}

function statusLabel(status: string) {
  if (status === "sent") return "Envoyé"
  if (status === "failed") return "Échec"
  if (status === "pending") return "En attente"
  return status
}

function StatusPill({ status }: { status: string }) {
  const base = "rounded-full px-2 py-0.5 text-[10px] font-mono"
  if (status === "sent") {
    return (
      <span className={base} style={{ background: "color-mix(in srgb,#2F7D5B 12%,white)", color: "#2F7D5B" }}>
        Envoyé
      </span>
    )
  }
  if (status === "failed") {
    return (
      <span className={base} style={{ background: "color-mix(in srgb,#B5402F 12%,white)", color: "#B5402F" }}>
        Échec
      </span>
    )
  }
  return (
    <span className={`${base} bg-muted`} style={{ color: "#9197A1" }}>
      En attente
    </span>
  )
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, now)) return "Aujourd'hui"
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (same(d, y)) return "Hier"
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
}

function LogsContent() {
  const { selectedClub, loading: clubLoading } = useClub()
  const orgId = selectedClub?.club_id || null
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState("all")
  const [detailLog, setDetailLog] = useState<LogEntry | null>(null)
  const limit = 20

  const fetchLogs = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    try {
      const params = new URLSearchParams({ org_id: orgId, limit: String(limit), offset: String(offset) })
      if (statusFilter !== "all") params.set("status", statusFilter)
      const res = await fetch(`/api/admin/logs?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch {
      toast.error("Erreur lors du chargement de l'historique")
    } finally {
      setLoading(false)
    }
  }, [orgId, offset, statusFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])
  useEffect(() => { setOffset(0) }, [statusFilter])

  // Fermeture du drawer avec Escape
  useEffect(() => {
    if (!detailLog) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDetailLog(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [detailLog])

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  const formatTime = (s: string) =>
    new Date(s).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  // Regroupement par jour (les logs arrivent triés du plus récent)
  const dayGroups: { label: string; logs: LogEntry[] }[] = []
  for (const log of logs) {
    const label = dayLabel(log.created_at)
    const last = dayGroups[dayGroups.length - 1]
    if (last && last.label === label) last.logs.push(log)
    else dayGroups.push({ label, logs: [log] })
  }

  if (clubLoading || !selectedClub) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
  }

  const rc = detailLog?.rendered_content || null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-medium">Historique</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chaque notification envoyée par vos règles. Cliquez pour voir le message exact reçu.
          </p>
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => {
            const active = statusFilter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-[color:var(--qt-copper-500)] text-foreground font-semibold"
                    : "border-[#DAD4C6] text-muted-foreground hover:text-foreground font-medium"
                }`}
                style={active ? { background: "color-mix(in srgb,#C05B2E 9%,white)" } : undefined}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : logs.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">Aucune notification pour le moment.</div>
      ) : (
        <>
          {dayGroups.map((group) => (
            <div key={group.label} className="space-y-3">
              <div className="mono-label">{group.label}</div>
              <Card className="px-4 py-1">
                {group.logs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setDetailLog(log)}
                    className="flex cursor-pointer items-center gap-3 border-b py-3 last:border-0"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: statusColor(log.status) }} />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground/80">
                      {chanWord(log.channels?.type)} «&nbsp;{log.events?.label || log.event_slug}&nbsp;» → {log.destination || "—"}
                      {log.is_test ? <span className="text-muted-foreground"> · test</span> : null}
                    </span>
                    <StatusPill status={log.status} />
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatTime(log.created_at)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  </div>
                ))}
              </Card>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total} résultat{total > 1 ? "s" : ""} — page {currentPage}/{totalPages || 1}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                <ChevronLeft className="mr-1 h-4 w-4" />Précédent
              </Button>
              <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
                Suivant<ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Détail — drawer latéral droit */}
      {detailLog && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-[rgba(21,24,30,0.34)]" onClick={() => setDetailLog(null)} />
          <div className="absolute top-0 right-0 bottom-0 flex w-[460px] max-w-[90vw] flex-col bg-card shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="font-serif text-lg font-medium">Détail de l'envoi</h3>
              <button
                onClick={() => setDetailLog(null)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto p-5">
              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                <div>
                  <div className="mono-label mb-1">ÉVÉNEMENT</div>
                  <div className="text-[13.5px] font-semibold">{detailLog.events?.label || detailLog.event_slug}</div>
                </div>
                <div>
                  <div className="mono-label mb-1">STATUT</div>
                  <div className="text-[13.5px] font-semibold"><StatusPill status={detailLog.status} /></div>
                </div>
                <div>
                  <div className="mono-label mb-1">CANAL</div>
                  <div className="text-[13.5px] font-semibold">
                    {chanWord(detailLog.channels?.type)}{detailLog.channels?.label ? ` · ${detailLog.channels.label}` : ""}
                  </div>
                </div>
                <div>
                  <div className="mono-label mb-1">DESTINATAIRE</div>
                  <div className="truncate text-[13.5px] font-semibold">{detailLog.destination || "—"}</div>
                </div>
                <div>
                  <div className="mono-label mb-1">DATE</div>
                  <div className="text-[13.5px] font-semibold">{formatDate(detailLog.created_at)}</div>
                </div>
              </div>

              {detailLog.status === "failed" && detailLog.error_message && (
                <div
                  className="mt-5 mb-5 flex gap-2.5 rounded-lg border px-3.5 py-3"
                  style={{
                    borderColor: "color-mix(in srgb,#B5402F 26%,white)",
                    background: "color-mix(in srgb,#B5402F 6%,white)",
                  }}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B5402F]" />
                  <p className="text-xs text-[#7A4039]">{detailLog.error_message}</p>
                </div>
              )}

              <div className="mono-label mb-2 mt-5">Contenu envoyé</div>
              {rc ? (
                <MessagePreview
                  channelType={rc.channel_type}
                  format={rc.format}
                  subject={rc.subject || ""}
                  body={rc.body}
                  values={{}}
                  eventLabel={detailLog.events?.label || detailLog.event_slug}
                  eventCategory={detailLog.events?.category || "system"}
                  senderName={null}
                  fromEmail={detailLog.destination || ""}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Aperçu du contenu indisponible pour cet envoi.</p>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-5 py-3">
              <Button variant="outline" onClick={() => setDetailLog(null)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminLogsPage() {
  return <LogsContent />
}
