"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface LogEntry {
  id: string
  workflow_id: string | null
  event_slug: string
  channel_id: string | null
  user_id: string
  org_id: string | null
  status: string
  payload: Record<string, unknown> | null
  rendered_content: Record<string, unknown> | null
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
  if (type === "discord_webhook" || type === "discord_dm") return "Discord"
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-medium">Historique</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chaque notification envoyée par vos règles. Cliquez pour voir le détail.
          </p>
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f.key
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
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
                      {chanWord(log.channels?.type)} «&nbsp;{log.events?.label || log.event_slug}&nbsp;»
                      {log.channels?.label ? ` · ${log.channels.label}` : ""}
                      {log.is_test ? " · test" : ""}
                    </span>
                    <span className="mono-label shrink-0" style={{ color: statusColor(log.status) }}>{statusLabel(log.status)}</span>
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

      {/* Détail */}
      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif font-medium">Détail de la notification</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="mono-label mb-1">Événement</p><p className="font-medium">{detailLog.events?.label || detailLog.event_slug}</p></div>
                  <div><p className="mono-label mb-1">Statut</p><p className="font-medium" style={{ color: statusColor(detailLog.status) }}>{statusLabel(detailLog.status)}</p></div>
                  <div><p className="mono-label mb-1">Canal</p><p className="font-medium">{detailLog.channels?.label || detailLog.channels?.type || "—"}</p></div>
                  {detailLog.destination && (
                    <div><p className="mono-label mb-1">Destinataire</p><p className="font-medium truncate">{detailLog.destination}</p></div>
                  )}
                  <div><p className="mono-label mb-1">Date</p><p className="font-medium">{formatDate(detailLog.created_at)}</p></div>
                  <div><p className="mono-label mb-1">Tentatives</p><p className="font-medium">{detailLog.attempts}</p></div>
                </div>

                {detailLog.error_message && (
                  <div>
                    <p className="mono-label mb-1">Erreur</p>
                    <pre className="whitespace-pre-wrap rounded-md bg-destructive/10 p-3 text-sm text-destructive">{detailLog.error_message}</pre>
                  </div>
                )}
                {detailLog.payload && (
                  <div>
                    <p className="mono-label mb-1">Données</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{JSON.stringify(detailLog.payload, null, 2)}</pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AdminLogsPage() {
  return <LogsContent />
}
