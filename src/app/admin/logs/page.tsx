"use client"

import { useEffect, useState, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PageHeader } from "@/components/page-header"
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, Radio, Mail } from "lucide-react"

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
  events?: { label: string; category: string } | null
  channels?: { type: string; label: string | null } | null
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
      const params = new URLSearchParams({
        org_id: orgId,
        limit: String(limit),
        offset: String(offset),
      })
      if (statusFilter !== "all") params.set("status", statusFilter)

      const res = await fetch(`/api/admin/logs?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch {
      toast.error("Erreur lors du chargement des logs")
    } finally {
      setLoading(false)
    }
  }, [orgId, offset, statusFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Reset offset when filter changes
  useEffect(() => { setOffset(0) }, [statusFilter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Envoyé</Badge>
      case "failed":
        return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Échoué</Badge>
      case "pending":
        return <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />En attente</Badge>
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>
    }
  }

  const getChannelIcon = (type: string | undefined) => {
    switch (type) {
      case "discord_webhook": return <Radio className="h-3.5 w-3.5 text-indigo-500" />
      case "email": return <Mail className="h-3.5 w-3.5 text-blue-500" />
      default: return null
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  if (clubLoading || !selectedClub) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historique"
        description="Chaque notification envoyée (ou échouée) par vos workflows est tracée ici, avec le détail du message et l'erreur éventuelle."
        flowStep="delivery"
        actions={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="sent">Envoyé</SelectItem>
              <SelectItem value="failed">Échoué</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucune notification envoyée pour le moment.
        </div>
      ) : (
        <>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Événement</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Tentatives</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetailLog(log)}
                  >
                    <TableCell className="text-sm">{formatDate(log.created_at)}</TableCell>
                    <TableCell>
                      <div>
                        <span className="text-sm font-medium">
                          {log.events?.label || log.event_slug}
                        </span>
                        {log.events?.category && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {log.events.category}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {getChannelIcon(log.channels?.type)}
                        <span className="text-sm">
                          {log.channels?.label || log.channels?.type || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(log.status)}
                        {log.is_test && <Badge variant="outline" className="text-xs">Test</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{log.attempts}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total} résultat{total > 1 ? "s" : ""} — Page {currentPage}/{totalPages || 1}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
              >
                Suivant<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détail de la notification</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Événement</p>
                    <p className="font-medium">{detailLog.events?.label || detailLog.event_slug}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Statut</p>
                    <div className="mt-0.5">{getStatusBadge(detailLog.status)}</div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Canal</p>
                    <p className="font-medium flex items-center gap-1.5">
                      {getChannelIcon(detailLog.channels?.type)}
                      {detailLog.channels?.label || detailLog.channels?.type || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">{formatDate(detailLog.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tentatives</p>
                    <p className="font-medium">{detailLog.attempts}</p>
                  </div>
                  {detailLog.sent_at && (
                    <div>
                      <p className="text-muted-foreground">Envoyé le</p>
                      <p className="font-medium">{formatDate(detailLog.sent_at)}</p>
                    </div>
                  )}
                </div>

                {detailLog.error_message && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Erreur</p>
                    <pre className="text-sm bg-destructive/10 text-destructive p-3 rounded-md whitespace-pre-wrap">
                      {detailLog.error_message}
                    </pre>
                  </div>
                )}

                {detailLog.payload && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Payload</p>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(detailLog.payload, null, 2)}
                    </pre>
                  </div>
                )}

                {detailLog.rendered_content && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Contenu rendu</p>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(detailLog.rendered_content, null, 2)}
                    </pre>
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
