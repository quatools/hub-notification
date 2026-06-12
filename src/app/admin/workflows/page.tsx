"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/page-header"
import { MessagePreview } from "@/components/message-preview"
import { DEFAULT_TEMPLATES } from "@/lib/notifications/default-templates"
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import Link from "next/link"
import {
  Plus, Radio, Mail, Trash2, Pencil, Send, ChevronDown, ChevronRight,
  Loader2, Workflow as WorkflowIcon, AlertCircle, RotateCcw
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

function WorkflowsContent() {
  const { selectedClub, loading: clubLoading } = useClub()
  const orgId = selectedClub?.club_id || null
  const [eventsWithWorkflows, setEventsWithWorkflows] = useState<EventWithWorkflows[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  // Create workflow dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createEventId, setCreateEventId] = useState("")
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

  // Test
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
    const map = new Map<string, EventWithWorkflows[]>()
    for (const item of eventsWithWorkflows) {
      const cat = CATEGORY_LABELS[item.event.category] || item.event.category || "Autre"
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(item)
    }
    return Array.from(map.entries())
  }, [eventsWithWorkflows])

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "discord_webhook": return <Radio className="h-4 w-4 text-indigo-500" />
      case "email": return <Mail className="h-4 w-4 text-blue-500" />
      default: return <Radio className="h-4 w-4" />
    }
  }

  const getChannelLabel = (ch: Channel | null) => {
    if (!ch) return "Canal inconnu"
    return ch.label || (ch.type === "discord_webhook" ? "Discord" : ch.type === "email" ? "Email" : ch.type)
  }

  // Extract variables from payload_schema
  // Le schéma est stocké à plat ({"member_name":"string"}) ; on garde le
  // fallback "properties" pour d'éventuels schémas au format JSON Schema.
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

  // Template par défaut proposé pour un couple événement + type de canal
  const getDefaultTemplate = (eventSlug: string, channelType: string) =>
    DEFAULT_TEMPLATES[eventSlug]?.[channelType] || null

  // Open create dialog with pre-filled data
  const openCreate = (eventId: string) => {
    const eventData = eventsWithWorkflows.find((e) => e.event.id === eventId)
    setCreateEventId(eventId)
    setCreateChannelId("")
    setCreateSubject("")
    setCreateBody("")
    setCreateFormat(eventData?.event.supported_channels?.includes("email") ? "html" : "text")
    setCreateValues(eventData ? buildSampleValues(eventData.event) : {})
    setCreateOpen(true)
  }

  // Pré-remplit l'éditeur avec le template par défaut de l'événement pour ce canal
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
      toast.success("Workflow créé")
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

  // Envoi de test depuis l'éditeur : valeurs custom + destination email optionnelle
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
      toast.success("Workflow supprimé")
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

  // Get compatible channels for event
  const getCompatibleChannels = (event: Event) => {
    return channels.filter((ch) =>
      event.supported_channels.includes(ch.type)
    )
  }

  // Format for channel type
  const getDefaultFormat = (channelType: string) => {
    return channelType === "email" ? "html" : channelType === "discord_webhook" ? "markdown" : "text"
  }

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
      <div className="space-y-6">
        <PageHeader
          title="Workflows"
          description="Un workflow relie un événement à un canal avec un message personnalisé : « quand X se produit, envoyer ce message sur Y ». C'est ici que tout se décide."
          flowStep="workflow"
        />
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Configurez d&apos;abord un canal</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Vous devez créer au moins un canal (Discord, email) avant de configurer des workflows.
            </p>
            <Button asChild>
              <Link href="/admin/channels">Configurer un canal</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Find selected event for create dialog
  const createEvent = eventsWithWorkflows.find((e) => e.event.id === createEventId)?.event
  const createCompatibleChannels = createEvent ? getCompatibleChannels(createEvent) : []
  const editEvent = editWorkflow
    ? eventsWithWorkflows.find((ewf) => ewf.workflows.some((w) => w.id === editWorkflow.id))?.event
    : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        description="Un workflow relie un événement à un canal avec un message personnalisé : « quand X se produit, envoyer ce message sur Y ». Chaque événement peut avoir plusieurs workflows."
        flowStep="workflow"
      />

      {categories.map(([category, items]) => (
        <div key={category}>
          <button
            className="flex items-center gap-2 text-lg font-semibold mb-3 hover:text-foreground/80 transition-colors"
            onClick={() => toggleCategory(category)}
          >
            {collapsedCategories.has(category)
              ? <ChevronRight className="h-5 w-5" />
              : <ChevronDown className="h-5 w-5" />
            }
            {category}
            <Badge variant="secondary" className="text-xs font-normal">
              {items.reduce((sum, i) => sum + i.workflows.length, 0)} route(s)
            </Badge>
          </button>

          {!collapsedCategories.has(category) && (
            <div className="space-y-4 ml-2">
              {items.map(({ event, workflows }) => (
                <Card key={event.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{event.label}</CardTitle>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">{event.slug}</Badge>
                          {event.audiences.map((a) => (
                            <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                          ))}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openCreate(event.id)}>
                        <Plus className="h-4 w-4 mr-1" />Route
                      </Button>
                    </div>
                  </CardHeader>

                  {workflows.length > 0 && (
                    <CardContent className="pt-0">
                      <Separator className="mb-3" />
                      <div className="space-y-2">
                        {workflows.map((wf) => (
                          <div
                            key={wf.id}
                            className="flex items-center gap-3 p-2 rounded-md border bg-muted/30"
                          >
                            {getChannelIcon(wf.channel?.type || "")}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {getChannelLabel(wf.channel)}
                                </span>
                                {!wf.is_active && (
                                  <Badge variant="secondary" className="text-xs">Inactif</Badge>
                                )}
                              </div>
                              {wf.step?.body && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {wf.step.body.replace(/<[^>]*>/g, "").slice(0, 80)}
                                  {wf.step.body.length > 80 ? "..." : ""}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleTest(wf.id)}
                                disabled={testing === wf.id}
                              >
                                {testing === wf.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Send className="h-4 w-4" />
                                }
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEdit(wf)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Switch
                                checked={wf.is_active}
                                onCheckedChange={() => handleToggle(wf.id, wf.is_active)}
                              />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer ce workflow ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Cette action est irréversible.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(wf.id)}>
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}

      {categories.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <WorkflowIcon className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Aucun événement disponible</h3>
            <p className="text-sm text-muted-foreground">
              Les événements apparaîtront ici une fois que vos applications seront connectées.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create workflow dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle route</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-2 md:grid-cols-2">
            {/* Colonne édition */}
            <div className="space-y-4">
              {createEvent && (
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-sm font-medium">{createEvent.label}</p>
                  <p className="text-xs text-muted-foreground">{createEvent.slug}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Canal de destination</Label>
                <Select
                  value={createChannelId}
                  onValueChange={(val) => {
                    setCreateChannelId(val)
                    const ch = channels.find((c) => c.id === val)
                    if (ch) {
                      // Proposer le template par défaut si l'éditeur est vide
                      const applied = !createBody.trim() && createEvent
                        ? applyDefaultTemplate(createEvent.slug, ch.type, "create")
                        : false
                      if (!applied) setCreateFormat(getDefaultFormat(ch.type))
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir un canal" /></SelectTrigger>
                  <SelectContent>
                    {createCompatibleChannels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        <span className="flex items-center gap-2">
                          {ch.type === "discord_webhook" ? "Discord" : "Email"} — {ch.label || ch.id.slice(0, 8)}
                        </span>
                      </SelectItem>
                    ))}
                    {createCompatibleChannels.length === 0 && (
                      <SelectItem value="none" disabled>
                        Aucun canal compatible
                      </SelectItem>
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
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Remettre par défaut
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
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-xs text-muted-foreground mr-1">Variables (cliquez pour insérer) :</span>
                    {getVariables(createEvent).map((v) => (
                      <button
                        key={v}
                        className="text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 font-mono transition-colors"
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
            <Button
              onClick={handleCreate}
              disabled={creating || !createChannelId || !createBody.trim()}
            >
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer le workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit workflow dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le message</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-2 md:grid-cols-2">
            {/* Colonne édition */}
            <div className="space-y-4">
              {editWorkflow?.channel && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                  {getChannelIcon(editWorkflow.channel.type)}
                  <span className="text-sm font-medium">{getChannelLabel(editWorkflow.channel)}</span>
                </div>
              )}

              {editFormat === "html" && (
                <div className="space-y-2">
                  <Label>Sujet (email)</Label>
                  <Input
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                  />
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
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Remettre par défaut
                    </Button>
                  )}
                </div>
                <Textarea
                  className="min-h-[150px] font-mono text-sm"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
                {editEvent && getVariables(editEvent).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-xs text-muted-foreground mr-1">Variables (cliquez pour insérer) :</span>
                    {getVariables(editEvent).map((v) => (
                      <button
                        key={v}
                        className="text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 font-mono transition-colors"
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

              {/* Envoi de test */}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendTestFromEdit}
                  disabled={sendingTest || !editBody.trim()}
                >
                  {sendingTest ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Envoyer le test
                </Button>
                <p className="text-xs text-muted-foreground">
                  Le test envoie le message tel qu&apos;affiché dans l&apos;aperçu, même non enregistré.
                </p>
              </div>
            </div>

            {/* Colonne aperçu */}
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
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
