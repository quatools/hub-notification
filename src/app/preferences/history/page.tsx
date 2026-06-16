"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useClub } from "@/lib/contexts/club-context"
import { MessagePreview } from "@/components/message-preview"
import { toast } from "sonner"
import Link from "next/link"
import { ChevronRight, X, AlertTriangle, LogIn } from "lucide-react"

interface RenderedContent {
  subject: string | null
  body: string
  format: "text" | "html" | "markdown"
  channel_type: string
}

interface HistoryItem {
  id: string
  event_label: string
  event_category: string | null
  channel_type: string | null
  channel_label: string | null
  destination: string | null
  error_message: string | null
  rendered_content: RenderedContent | null
  status: "pending" | "sent" | "failed"
  sent_at: string | null
  created_at: string
}

interface DayGroup {
  key: string
  label: string
  items: HistoryItem[]
}

const CAT_COLOR: Record<string, string> = {
  billing: "#2F7D5B",
  member: "#C05B2E",
  team: "#24405E",
  shop: "#8F3E1F",
  system: "#9197A1",
}

function catColor(cat: string | null): string {
  return (cat && CAT_COLOR[cat]) || "#9197A1"
}

function chanWord(type: string | null): string {
  switch (type) {
    case "email": return "Email"
    case "discord_webhook": return "Discord"
    case "discord_dm": return "MP Discord"
    default: return "Notification"
  }
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function fullDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function groupLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(d) === dayKey(today)) return "Aujourd'hui"
  if (dayKey(d) === dayKey(yesterday)) return "Hier"
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
}

function buildGroups(items: HistoryItem[]): DayGroup[] {
  const groups: DayGroup[] = []
  const index = new Map<string, DayGroup>()
  for (const it of items) {
    const key = dayKey(new Date(it.created_at))
    let g = index.get(key)
    if (!g) {
      g = { key, label: groupLabel(it.created_at), items: [] }
      index.set(key, g)
      groups.push(g)
    }
    g.items.push(it)
  }
  return groups
}

function StatusPill({ status }: { status: HistoryItem["status"] }) {
  if (status === "sent") {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-mono"
        style={{ background: "color-mix(in srgb,#2F7D5B 12%,white)", color: "#2F7D5B" }}
      >
        Reçue
      </span>
    )
  }
  if (status === "failed") {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-mono"
        style={{ background: "color-mix(in srgb,#B5402F 12%,white)", color: "#B5402F" }}
      >
        Échec
      </span>
    )
  }
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono" style={{ color: "#9197A1" }}>
      En cours
    </span>
  )
}

function DetailDrawer({ item, onClose }: { item: HistoryItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const rc = item.rendered_content
  const channelCell = chanWord(item.channel_type) + (item.channel_label ? " · " + item.channel_label : "")

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0" style={{ background: "rgba(21,24,30,0.34)" }} onClick={onClose} />
      <div className="absolute top-0 right-0 bottom-0 flex w-[460px] max-w-[90vw] flex-col bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-serif text-lg font-medium">Détail de l&apos;envoi</h3>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            <div>
              <div className="mono-label mb-1">Événement</div>
              <div className="text-[13.5px] font-semibold">{item.event_label}</div>
            </div>
            <div>
              <div className="mono-label mb-1">Statut</div>
              <div className="text-[13.5px] font-semibold">
                <StatusPill status={item.status} />
              </div>
            </div>
            <div>
              <div className="mono-label mb-1">Canal</div>
              <div className="text-[13.5px] font-semibold">{channelCell}</div>
            </div>
            <div>
              <div className="mono-label mb-1">Destinataire</div>
              <div className="text-[13.5px] font-semibold break-all">{item.destination || "—"}</div>
            </div>
            <div>
              <div className="mono-label mb-1">Date</div>
              <div className="text-[13.5px] font-semibold">{fullDateTime(item.created_at)}</div>
            </div>
          </div>

          {item.status === "failed" && item.error_message && (
            <div
              className="mt-5 mb-5 flex gap-2.5 rounded-lg border px-3.5 py-3"
              style={{
                borderColor: "color-mix(in srgb,#B5402F 26%,white)",
                background: "color-mix(in srgb,#B5402F 6%,white)",
              }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B5402F]" />
              <p className="text-xs text-[#7A4039]">{item.error_message}</p>
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
              eventLabel={item.event_label}
              eventCategory={item.event_category || "system"}
              senderName={null}
              fromEmail={item.destination || ""}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Aperçu du contenu indisponible pour cet envoi.
            </p>
          )}
        </div>

        <div className="border-t px-5 py-3">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  )
}

function HistoryContent() {
  const { selectedClub, loading: clubLoading, isAuthenticated } = useClub()
  const orgId = selectedClub?.club_id || null
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<HistoryItem | null>(null)

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

  if (clubLoading) {
    return (
      <div className="mx-auto max-w-[720px] space-y-4 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-[720px] py-12 text-center">
        <LogIn className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="mb-2 text-xl font-semibold">Connexion requise</h2>
        <p className="mb-4 text-muted-foreground">Connectez-vous pour voir votre historique.</p>
        <Button asChild><Link href="/login">Se connecter</Link></Button>
      </div>
    )
  }

  const groups = buildGroups(items)

  return (
    <div className="mx-auto max-w-[720px] py-10">
      <h1 className="font-serif text-[26px] font-medium">Mon historique</h1>
      <p className="mb-6 text-sm text-muted-foreground">Ce que vous avez reçu personnellement.</p>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Aucune notification pour l&apos;instant.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="mono-label mb-3">{g.label}</div>
              <Card className="rounded-2xl border border-[#DAD4C6] px-4">
                {g.items.map((it) => (
                  <div
                    key={it.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(it)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected(it) }}
                    className="flex cursor-pointer items-center gap-3 border-b border-[#F4F5F7] py-3.5 last:border-0"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: catColor(it.event_category) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-foreground">
                      {chanWord(it.channel_type)} « {it.event_label} »
                    </span>
                    <StatusPill status={it.status} />
                    <span className="w-12 text-right font-mono text-[11px] text-muted-foreground">
                      {hhmm(it.created_at)}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-[#C9CDD6]" />
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      {selected && <DetailDrawer item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

export default function HistoryPage() {
  return <HistoryContent />
}
