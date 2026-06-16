"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { MessagePreview } from "@/components/message-preview"
import { DEFAULT_TEMPLATES } from "@/lib/notifications/default-templates"
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import Link from "next/link"
import {
  Plus, Trash2, Pencil, Send, ChevronRight, Loader2, Eye, AlertCircle, RotateCcw
} from "lucide-react"

interface Event {
  id: string
  slug: string
  label: string
  description: string | null
  category: string
  supported_channels: string[]
  audiences: string[]
  payload_schema: Record<string, unknown> | null
}

interface Channel {
  id: string
  type: string
  label: string | null
}

interface WorkflowStep {
  id: string
  subject: string | null
  body: string
  format: string
}

interface WorkflowItem {
  id: string
  event_id: string
  channel_id: string
  is_active: boolean
  channel: Channel | null
  step: WorkflowStep | null
}

interface EventWithWorkflows {
  event: Event
  workflows: WorkflowItem[]
}

const CATEGORY_LABELS: Record<string, string> = {
  billing: "Facturation",
  member: "Membres",
  team: "Équipes",
  shop: "Boutique & préventes",
  system: "Système",
}

const CAT_COLOR: Record<string, string> = {
  billing: "#2F7D5B",
  member: "#C05B2E",
  team: "#24405E",
  shop: "#8F3E1F",
  system: "#9197A1",
}

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  discord_webhook: "Discord",
  discord_dm: "MP Discord",
  email: "Email",
}

/** Couleur de pastille d'une destination selon le canal (charte). */
function channelColor(type: string | undefined): string {
  if (type === "email") return "#C05B2E"
  return "#5865F2" // Discord (salon ou MP)
}

function WorkflowsContent() {
  const { selectedClub, loading: clubLoading } = useClub()
  const orgId = selectedClub?.club_id || null
  const [eventsWithWorkflows, setEventsWithWorkflows] = useState<EventWithWorkflows[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  // Destination sélectionnée pour l'aperçu en direct (rail droit)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Create workflow dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createEventId, setCreateEventId] = useState("")
  const [createEventLocked, setCreateEventLocked] = useState(false)
  const [createChannelId, setCreateChannelId] = useState("")
  const [createSubject, setCreateSubject] = useState("")
  const [createBody, setCreateBody] = useState("")
  const [createFormat, setCreateFormat] = useState("text")
  const [creating, setCreating] = useState(false)

  // Edit workflow dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editWorkflow, setEditWorkflow] = useState<WorkflowItem | null>(null)
  const [editSubject, setEditSubject] = useState("")
  const [editBody, setEditBody] = useState("")
  const [editFormat, setEditFormat] = useState("text")
  const [saving, setSaving] = useState(false)

  // Valeurs de test (preview + envoi de test)
  const [createValues, setCreateValues] = useState<Record<string, string>>({})
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editTestEmail, setEditTestEmail] = useState("")
  const [sendingTest, setSendingTest] = useState(false)

  // Identité marque blanche (pour l'aperçu)
  const [senderName, setSenderName] = useState<string | null>(null)
  const [fromEmail, setFromEmail] = useState("notifications@hub.quatools.fr")

  // Test (depuis une ligne destination)
  const [testing, setTesting] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      const [wfRes, chRes, settingsRes] = await Promise.all([
        fetch(`/api/admin/workflows?org_id=${orgId}`),
        fetch(`/api/admin/channels?org_id=${orgId}`),
        fetch(`/api/admin/settings?org_id=${orgId}`),
      ])
      if (!wfRes.ok || !chRes.ok) throw new Error()

      const wfData = await wfRes.json()
      const chData = await chRes.json()

      setEventsWithWorkflows(wfData.events_with_workflows || [])
      setChannels(chData.channels || [])

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        const s = settingsData.settings
        setSenderName(s?.sender_name || null)
        if (s?.domain_status === "verified" && s?.sender_domain) {
          setFromEmail(`notifications@${s.sender_domain}`)
        }
      }
    } catch {
      toast.error("Erreur lors du chargement")
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { fetchData() }, [fetchData])

  // Group events by category
  const categories = useMemo(() => {
    const map = new Map<string, { key: string; items: EventWithWorkflows[] }>()
    for (const item of eventsWithWorkflows) {
      const key = item.event.category || "system"
      const label = CATEGORY_LABELS[key] || key || "Autre"
      if (!map.has(label)) map.set(label, { key, items: [] })
      map.get(label)!.items.push(item)
    }
    return Array.from(map.entries()).map(([label, v]) => ({ label, ...v }))
  }, [eventsWithWorkflows])

  // Compteur de notifications actives / configurées
  const { activeCount, totalCount } = useMemo(() => {
    let active = 0, total = 0
    for (const ewf of eventsWithWorkflows) {
      for (const wf of ewf.workflows) {
        total++
        if (wf.is_active) active++
      }
    }
    return { activeCount: active, totalCount: total }
  }, [eventsWithWorkflows])

  const countLine = totalCount === 0
    ? "Aucune notification configurée pour l'instant."
    : `${activeCount} notification${activeCount > 1 ? "s" : ""} active${activeCount > 1 ? "s" : ""} sur ${totalCount} configurée${totalCount > 1 ? "s" : ""}.`

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  // Extract variables from payload_schema
  const getVariables = (event: Event): string[] => {
    if (!event.payload_schema) return []
    const schema = event.payload_schema as { properties?: Record<string, unknown> }
    if (schema.properties) return Object.keys(schema.properties)
    return Object.keys(event.payload_schema)
  }

  // Valeurs d'exemple par défaut pour les variables (preview + test)
  const buildSampleValues = (event: Event): Record<string, string> => {
    const values: Record<string, string> = {}
    const schema = (event.payload_schema || {}) as Record<string, unknown>
    for (const key of getVariables(event)) {
      const type = schema[key]
      if (key.includes("email")) values[key] = "jean.dupont@exemple.fr"
      else if (key.includes("name") && !key.includes("plan")) values[key] = "Jean Dupont"
      else if (key.includes("url")) values[key] = "https://exemple.fr/suivi"
      else if (type === "number") values[key] = "49.99"
      else if (type === "boolean") values[key] = "oui"
      else values[key] = `Exemple ${key.replace(/_/g, " ")}`
    }
    return values
  }

  const getDefaultTemplate = (eventSlug: string, channelType: string) =>
    DEFAULT_TEMPLATES[eventSlug]?.[channelType] || null

  // Open create dialog (depuis le bouton global ou depuis une règle)
  const openCreate = (eventId?: string) => {
    const eventData = eventId ? eventsWithWorkflows.find((e) => e.event.id === eventId) : undefined
    setCreateEventId(eventId || "")
    setCreateEventLocked(!!eventId)
    setCreateChannelId("")
    setCreateSubject("")
    setCreateBody("")
    setCreateFormat(eventData?.event.supported_channels?.includes("email") ? "html" : "text")
    setCreateValues(eventData ? buildSampleValues(eventData.event) : {})
    setCreateOpen(true)
  }

  const onCreateEventChange = (eventId: string) => {
    const eventData = eventsWithWorkflows.find((e) => e.event.id === eventId)
    setCreateEventId(eventId)
    setCreateChannelId("")
    setCreateSubject("")
    setCreateBody("")
    setCreateFormat(eventData?.event.supported_channels?.includes("email") ? "html" : "text")
    setCreateValues(eventData ? buildSampleValues(eventData.event) : {})
  }

  const applyDefaultTemplate = (eventSlug: string, channelType: string, target: "create" | "edit") => {
    const tpl = getDefaultTemplate(eventSlug, channelType)
    if (!tpl) return false
    if (target === "create") {
      setCreateSubject(tpl.subject || "")
      setCreateBody(tpl.body)
      setCreateFormat(tpl.format)
    } else {
      setEditSubject(tpl.subject || "")
      setEditBody(tpl.body)
      setEditFormat(tpl.format)
    }
    return true
  }

  const handleCreate = async () => {
    if (!orgId || !createEventId || !createChannelId || !createBody.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/admin/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          event_id: createEventId,
          channel_id: createChannelId,
          step: {
            subject: createSubject || undefined,
            body: createBody,
            format: createFormat,
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Erreur lors de la création")
        return
      }
      toast.success("Notification créée")
      setCreateOpen(false)
      fetchData()
    } catch {
      toast.error("Erreur lors de la création")
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (workflow: WorkflowItem) => {
    setEditWorkflow(workflow)
    setEditSubject(workflow.step?.subject || "")
    setEditBody(workflow.step?.body || "")
    setEditFormat(workflow.step?.format || "text")
    const ev = eventsWithWorkflows.find((ewf) => ewf.workflows.some((w) => w.id === workflow.id))?.event
    setEditValues(ev ? buildSampleValues(ev) : {})
    setEditTestEmail("")
    setEditOpen(true)
  }

  const handleSendTestFromEdit = async () => {
    if (!editWorkflow) return
    setSendingTest(true)
    try {
      const res = await fetch(`/api/admin/workflows/${editWorkflow.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: editValues,
          step: { subject: editSubject || null, body: editBody, format: editFormat },
          ...(editTestEmail.trim() && { override_email: editTestEmail.trim() }),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || "Erreur lors de l'envoi du test")
        return
      }
      toast.success(
        editTestEmail.trim()
          ? `Test envoyé à ${editTestEmail.trim()}`
          : "Notification de test envoyée sur le canal du workflow"
      )
    } catch {
      toast.error("Erreur lors de l'envoi du test")
    } finally {
      setSendingTest(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editWorkflow || !editBody.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/workflows/${editWorkflow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: {
            subject: editSubject || null,
            body: editBody,
            format: editFormat,
          },
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("Message mis à jour")
      setEditOpen(false)
      fetchData()
    } catch {
      toast.error("Erreur lors de la sauvegarde")
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (workflowId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/workflows/${workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentActive }),
      })
      if (!res.ok) throw new Error()
      setEventsWithWorkflows((prev) =>
        prev.map((ewf) => ({
          ...ewf,
          workflows: ewf.workflows.map((wf) =>
            wf.id === workflowId ? { ...wf, is_active: !currentActive } : wf
          ),
        }))
      )
    } catch {
      toast.error("Erreur lors de la mise à jour")
    }
  }

  const handleDelete = async (workflowId: string) => {
    try {
      const res = await fetch(`/api/admin/workflows/${workflowId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setEventsWithWorkflows((prev) =>
        prev.map((ewf) => ({
          ...ewf,
          workflows: ewf.workflows.filter((wf) => wf.id !== workflowId),
        }))
      )
      if (selectedId === workflowId) setSelectedId(null)
      toast.success("Notification supprimée")
    } catch {
      toast.error("Erreur lors de la suppression")
    }
  }

  const handleTest = async (workflowId: string) => {
    setTesting(workflowId)
    try {
      const res = await fetch(`/api/admin/workflows/${workflowId}/test`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Erreur lors du test")
        return
      }
      toast.success("Notification de test envoyée")
    } catch {
      toast.error("Erreur lors du test")
    } finally {
      setTesting(null)
    }
  }

  const getCompatibleChannels = (event: Event) =>
    channels.filter((ch) => event.supported_channels.includes(ch.type))

  const getDefaultFormat = (channelType: string) => {
    if (channelType === "email") return "html"
    if (channelType === "discord_webhook" || channelType === "discord_dm") return "markdown"
    return "text"
  }

  // Destination sélectionnée (pour le rail d'aperçu)
  const selected = useMemo(() => {
    if (!selectedId) return null
    for (const ewf of eventsWithWorkflows) {
      const wf = ewf.workflows.find((w) => w.id === selectedId)
      if (wf) return { wf, event: ewf.event }
    }
    return null
  }, [selectedId, eventsWithWorkflows])

  if (clubLoading || !selectedClub) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    )
  }

  if (channels.length === 0) {
    return (
      <div className="mx-auto max-w-[680px] space-y-6">
        <div>
          <h1 className="font-serif text-[26px] font-medium">Mes notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configurez d&apos;abord un canal, puis composez vos notifications.
          </p>
        </div>
        <div className="rounded-xl border border-dashed border-[color:var(--qt-sable-300,#DAD4C6)] bg-card py-12 text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="mb-2 font-semibold">Configurez d&apos;abord un canal</h3>
          <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
            Vous devez créer au moins un canal (Discord, email) avant de composer des notifications.
          </p>
          <Button asChild>
            <Link href="/admin/channels">Configurer un canal</Link>
          </Button>
        </div>
      </div>
    )
  }

  const createEvent = eventsWithWorkflows.find((e) => e.event.id === createEventId)?.event
  const createCompatibleChannels = createEvent ? getCompatibleChannels(createEvent) : []
  const editEvent = editWorkflow
    ? eventsWithWorkflows.find((ewf) => ewf.workflows.some((w) => w.id === editWorkflow.id))?.event
    : null

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      {/* ===================== Colonne liste ===================== */}
      <div className="min-w-0">
        <div className="mx-auto max-w-[680px]">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h1 className="font-serif text-[26px] font-medium">Mes notifications</h1>
            <Button onClick={() => openCreate()} className="shrink-0">
              <Plus className="mr-1.5 h-4 w-4" />Nouvelle notification
            </Button>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">{countLine}</p>

          {/* Carte exemple pédagogique (lecture seule) */}
          <ExampleCard />

          {/* Groupes (catégories) */}
          {categories.map(({ label, key, items }) => {
            const ruleCount = items.length
            const collapsed = collapsedCategories.has(label)
            return (
              <div key={label} className="mb-3.5">
                <button
                  onClick={() => toggleCategory(label)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-[color:var(--qt-sable-300,#DAD4C6)] bg-card px-3.5 py-2.5 text-left transition-colors hover:bg-secondary/40"
                >
                  <ChevronRight
                    className="h-3.5 w-3.5 text-muted-foreground transition-transform"
                    style={{ transform: collapsed ? "none" : "rotate(90deg)" }}
                  />
                  <span className="h-[7px] w-[7px] rounded-sm" style={{ background: CAT_COLOR[key] || "#9197A1" }} />
                  <span className="mono-label flex-1">{label}</span>
                  <span className="text-xs text-muted-foreground">{ruleCount} règle{ruleCount > 1 ? "s" : ""}</span>
                </button>

                {!collapsed && (
                  <div className="mt-3 flex flex-col gap-3">
                    {items.map(({ event, workflows }) => {
                      const tint = CAT_COLOR[event.category] || "#9197A1"
                      return (
                        <div
                          key={event.id}
                          className="rounded-xl border border-[color:var(--qt-sable-300,#DAD4C6)] bg-card p-4"
                        >
                          <div className="mb-3 text-[14.5px] leading-relaxed text-foreground">
                            Quand un{" "}
                            <span
                              className="rounded px-1.5 py-0.5 font-semibold"
                              style={{ background: `color-mix(in srgb, ${tint} 12%, white)`, color: tint }}
                            >
                              {event.label.toLowerCase()}
                            </span>{" "}
                            survient, envoyer à&nbsp;:
                          </div>

                          <div className="flex flex-col gap-2">
                            {workflows.map((wf) => {
                              const snippet = wf.step?.body
                                ? wf.step.body.replace(/<[^>]*>/g, "").replace(/\{\{|\}\}/g, "").slice(0, 90)
                                : "Message non défini"
                              const audience = wf.channel?.type === "discord_dm" ? "membre" : "staff"
                              const isSel = selectedId === wf.id
                              return (
                                <div
                                  key={wf.id}
                                  onClick={() => setSelectedId(wf.id)}
                                  className={`flex cursor-pointer items-center gap-3 rounded-[9px] border bg-card px-3 py-2.5 transition-colors ${
                                    isSel
                                      ? "border-[color:var(--qt-copper-500)] ring-1 ring-[color:var(--qt-copper-500)]"
                                      : "border-[#ECEDF1] hover:border-[color:var(--qt-sable-300,#DAD4C6)]"
                                  } ${wf.is_active ? "" : "opacity-60"}`}
                                >
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-sm"
                                    style={{ background: channelColor(wf.channel?.type) }}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[13px] font-semibold">
                                      {wf.channel?.label || CHANNEL_TYPE_LABELS[wf.channel?.type || ""] || "Canal"}
                                    </div>
                                    <div className="truncate text-xs text-muted-foreground">{snippet}</div>
                                  </div>
                                  <span className="mono-label shrink-0 normal-case tracking-normal text-[10px] text-muted-foreground">
                                    {audience}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleTest(wf.id) }}
                                    disabled={testing === wf.id}
                                    title="Tester"
                                    className="flex shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  >
                                    {testing === wf.id
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <Send className="h-3.5 w-3.5" />}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openEdit(wf) }}
                                    title="Modifier"
                                    className="flex shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <span onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center gap-1">
                                    <Switch checked={wf.is_active} onCheckedChange={() => handleToggle(wf.id, wf.is_active)} />
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <button
                                          title="Supprimer"
                                          className="flex rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-[color:var(--qt-danger,#B5402F)]"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Supprimer cette destination ?</AlertDialogTitle>
                                          <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(wf.id)}>Supprimer</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </span>
                                </div>
                              )
                            })}

                            <button
                              onClick={() => openCreate(event.id)}
                              className="inline-flex items-center gap-1.5 self-start rounded-md px-0.5 py-1 text-[12.5px] font-medium text-[color:var(--qt-copper-500)] hover:underline"
                            >
                              <Plus className="h-3 w-3" />Ajouter une destination
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {categories.length === 0 && (
            <div className="rounded-xl border border-dashed border-[color:var(--qt-sable-300,#DAD4C6)] bg-card py-12 text-center">
              <AlertCircle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="mb-2 font-semibold">Aucun événement disponible</h3>
              <p className="text-sm text-muted-foreground">
                Les événements apparaîtront ici une fois vos applications connectées.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ===================== Rail d'aperçu ===================== */}
      <aside className="rounded-xl border border-[color:var(--qt-sable-300,#DAD4C6)] bg-card p-6 lg:sticky lg:top-6">
        {selected ? (
          <div className="flex h-full flex-col">
            <div className="mono-label mb-2 text-[color:var(--qt-copper-500)]">Aperçu en direct</div>
            <h3 className="font-serif text-lg font-medium">{selected.event.label}</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              via {selected.wf.channel?.label || CHANNEL_TYPE_LABELS[selected.wf.channel?.type || ""] || "canal"}
            </p>

            <MessagePreview
              channelType={selected.wf.channel?.type || null}
              format={selected.wf.step?.format || "text"}
              subject={selected.wf.step?.subject || ""}
              body={selected.wf.step?.body || ""}
              values={buildSampleValues(selected.event)}
              eventLabel={selected.event.label}
              eventCategory={selected.event.category || "system"}
              senderName={senderName}
              fromEmail={fromEmail}
            />

            <div className="mt-5 flex gap-2.5">
              <Button variant="outline" className="flex-1" onClick={() => openEdit(selected.wf)}>
                Modifier le message
              </Button>
              <Button variant="secondary" onClick={() => handleTest(selected.wf.id)} disabled={testing === selected.wf.id}>
                {testing === selected.wf.id
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <Send className="mr-1.5 h-3.5 w-3.5" />}
                Tester
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Eye className="mb-3 h-8 w-8 text-[color:var(--qt-sable-300,#C9CDD6)]" />
            <p className="max-w-[24ch] text-sm">Sélectionnez une destination pour voir son aperçu.</p>
          </div>
        )}
      </aside>

      {/* ===================== Create dialog ===================== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Nouvelle notification</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-2 md:grid-cols-2">
            {/* Colonne édition */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Événement déclencheur</Label>
                <Select value={createEventId} onValueChange={onCreateEventChange} disabled={createEventLocked}>
                  <SelectTrigger><SelectValue placeholder="Choisir un événement" /></SelectTrigger>
                  <SelectContent>
                    {eventsWithWorkflows.map(({ event }) => (
                      <SelectItem key={event.id} value={event.id}>{event.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Destination (canal)</Label>
                <Select
                  value={createChannelId}
                  onValueChange={(val) => {
                    setCreateChannelId(val)
                    const ch = channels.find((c) => c.id === val)
                    if (ch) {
                      const applied = !createBody.trim() && createEvent
                        ? applyDefaultTemplate(createEvent.slug, ch.type, "create")
                        : false
                      if (!applied) setCreateFormat(getDefaultFormat(ch.type))
                    }
                  }}
                  disabled={!createEventId}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir un canal" /></SelectTrigger>
                  <SelectContent>
                    {createCompatibleChannels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        {CHANNEL_TYPE_LABELS[ch.type] || ch.type} — {ch.label || ch.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                    {createCompatibleChannels.length === 0 && (
                      <SelectItem value="none" disabled>Aucun canal compatible</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {createFormat === "html" && (
                <div className="space-y-2">
                  <Label>Sujet (email)</Label>
                  <Input
                    placeholder="ex: Nouvelle inscription - {{member_name}}"
                    value={createSubject}
                    onChange={(e) => setCreateSubject(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Message</Label>
                  {createEvent && createChannelId && getDefaultTemplate(
                    createEvent.slug,
                    channels.find((c) => c.id === createChannelId)?.type || ""
                  ) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground"
                      onClick={() => {
                        const ch = channels.find((c) => c.id === createChannelId)
                        if (ch && createEvent) applyDefaultTemplate(createEvent.slug, ch.type, "create")
                      }}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />Remettre par défaut
                    </Button>
                  )}
                </div>
                <Textarea
                  className="min-h-[120px] font-mono text-sm"
                  placeholder="Écrivez votre message ici..."
                  value={createBody}
                  onChange={(e) => setCreateBody(e.target.value)}
                />
                {createEvent && getVariables(createEvent).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="mr-1 text-xs text-muted-foreground">Variables (cliquez pour insérer) :</span>
                    {getVariables(createEvent).map((v) => (
                      <button
                        key={v}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs transition-colors hover:bg-muted/80"
                        onClick={() => setCreateBody((prev) => prev + `{{${v}}}`)}
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={createFormat} onValueChange={setCreateFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texte brut</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Colonne aperçu */}
            <div className="space-y-4">
              <MessagePreview
                channelType={channels.find((c) => c.id === createChannelId)?.type || null}
                format={createFormat}
                subject={createSubject}
                body={createBody}
                values={createValues}
                eventLabel={createEvent?.label || ""}
                eventCategory={createEvent?.category || "system"}
                senderName={senderName}
                fromEmail={fromEmail}
              />
              {createEvent && getVariables(createEvent).length > 0 && (
                <TestDataFields
                  variables={getVariables(createEvent)}
                  values={createValues}
                  onChange={setCreateValues}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button onClick={handleCreate} disabled={creating || !createEventId || !createChannelId || !createBody.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer la notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== Edit dialog ===================== */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Modifier le message</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-2 md:grid-cols-2">
            <div className="space-y-4">
              {editWorkflow?.channel && (
                <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3">
                  <span className="h-2 w-2 rounded-sm" style={{ background: channelColor(editWorkflow.channel.type) }} />
                  <span className="text-sm font-medium">
                    {editWorkflow.channel.label || CHANNEL_TYPE_LABELS[editWorkflow.channel.type] || editWorkflow.channel.type}
                  </span>
                </div>
              )}

              {editFormat === "html" && (
                <div className="space-y-2">
                  <Label>Sujet (email)</Label>
                  <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Message</Label>
                  {editEvent && editWorkflow?.channel && getDefaultTemplate(editEvent.slug, editWorkflow.channel.type) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground"
                      onClick={() => {
                        if (editEvent && editWorkflow?.channel) {
                          applyDefaultTemplate(editEvent.slug, editWorkflow.channel.type, "edit")
                        }
                      }}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />Remettre par défaut
                    </Button>
                  )}
                </div>
                <Textarea
                  className="min-h-[150px] font-mono text-sm"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
                {editEvent && getVariables(editEvent).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="mr-1 text-xs text-muted-foreground">Variables (cliquez pour insérer) :</span>
                    {getVariables(editEvent).map((v) => (
                      <button
                        key={v}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs transition-colors hover:bg-muted/80"
                        onClick={() => setEditBody((prev) => prev + `{{${v}}}`)}
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={editFormat} onValueChange={setEditFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texte brut</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Envoyer un test (avec les données d&apos;exemple ci-contre)
                </Label>
                {editWorkflow?.channel?.type === "email" && (
                  <Input
                    type="email"
                    placeholder="Adresse de test (sinon : canal du workflow)"
                    value={editTestEmail}
                    onChange={(e) => setEditTestEmail(e.target.value)}
                  />
                )}
                <Button variant="outline" size="sm" onClick={handleSendTestFromEdit} disabled={sendingTest || !editBody.trim()}>
                  {sendingTest
                    ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    : <Send className="mr-1.5 h-3.5 w-3.5" />}
                  Envoyer le test
                </Button>
                <p className="text-xs text-muted-foreground">
                  Le test envoie le message tel qu&apos;affiché dans l&apos;aperçu, même non enregistré.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <MessagePreview
                channelType={editWorkflow?.channel?.type || null}
                format={editFormat}
                subject={editSubject}
                body={editBody}
                values={editValues}
                eventLabel={editEvent?.label || ""}
                eventCategory={editEvent?.category || "system"}
                senderName={senderName}
                fromEmail={fromEmail}
              />
              {editEvent && getVariables(editEvent).length > 0 && (
                <TestDataFields
                  variables={getVariables(editEvent)}
                  values={editValues}
                  onChange={setEditValues}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button onClick={handleSaveEdit} disabled={saving || !editBody.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Carte pédagogique statique en tête de liste (non interactive). */
function ExampleCard() {
  const rows = [
    { label: "#staff · Discord", snippet: "Jean Dupont vient de souscrire Premium — 29,99 €. Bienvenue !", audience: "staff", dot: "#5865F2" },
    { label: "MP au client · Discord", snippet: "Bienvenue Jean Dupont ! Votre abonnement Premium est actif.", audience: "client", dot: "#5865F2" },
    { label: "Email au client", snippet: "Votre abonnement Premium est confirmé. Merci de votre confiance !", audience: "client", dot: "#C05B2E" },
  ]
  return (
    <div className="mb-6 rounded-xl border border-dashed border-[color:var(--qt-sable-300,#DAD4C6)] bg-[color:var(--qt-bg,#FBFBFC)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="mono-label">Exemple</span>
        <span className="mono-label rounded-full border border-[color:var(--qt-sable-300,#DAD4C6)] bg-secondary px-2 py-0.5 text-[9px]">
          Lecture seule
        </span>
      </div>
      <div className="mb-3 text-[14.5px] leading-relaxed text-foreground">
        Quand un{" "}
        <span
          className="rounded px-1.5 py-0.5 font-semibold"
          style={{ background: "color-mix(in srgb, #2F7D5B 12%, white)", color: "#0F5B39" }}
        >
          nouvel abonnement
        </span>{" "}
        survient, envoyer à&nbsp;:
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 rounded-[9px] border border-[#ECEDF1] bg-card px-3 py-2.5">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: r.dot }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{r.label}</div>
              <div className="truncate text-xs text-muted-foreground">{r.snippet}</div>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{r.audience}</span>
            <span className="relative h-[21px] w-9 shrink-0 rounded-full bg-[#C9CDD6]">
              <span className="absolute right-0.5 top-0.5 h-[17px] w-[17px] rounded-full bg-white" />
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] text-muted-foreground">
        Un même événement peut prévenir <strong className="font-semibold text-foreground/70">le staff</strong> (salon
        Discord) <strong className="font-semibold text-foreground/70">et le client lui-même</strong> (MP Discord, email).
        Exemple non modifiable.
      </p>
    </div>
  )
}

/** Champs de données d'exemple : alimentent l'aperçu et l'envoi de test. */
function TestDataFields({ variables, values, onChange }: {
  variables: string[]
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Données d&apos;exemple
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {variables.map((v) => (
          <div key={v} className="space-y-1">
            <Label htmlFor={`testdata-${v}`} className="font-mono text-xs text-muted-foreground">
              {`{{${v}}}`}
            </Label>
            <Input
              id={`testdata-${v}`}
              className="h-8 text-sm"
              value={values[v] || ""}
              onChange={(e) => onChange({ ...values, [v]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminWorkflowsPage() {
  return <WorkflowsContent />
}
