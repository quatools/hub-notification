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
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import Link from "next/link"
import {
  Plus, Radio, Mail, Trash2, Pencil, Send, ChevronDown, ChevronRight,
  Loader2, Workflow as WorkflowIcon, AlertCircle
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

  // Test
  const [testing, setTesting] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      const [wfRes, chRes] = await Promise.all([
        fetch(`/api/admin/workflows?org_id=${orgId}`),
        fetch(`/api/admin/channels?org_id=${orgId}`),
      ])
      if (!wfRes.ok || !chRes.ok) throw new Error()

      const wfData = await wfRes.json()
      const chData = await chRes.json()

      setEventsWithWorkflows(wfData.events_with_workflows || [])
      setChannels(chData.channels || [])
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
  const getVariables = (event: Event): string[] => {
    if (!event.payload_schema) return []
    const props = (event.payload_schema as { properties?: Record<string, unknown> }).properties
    if (!props) return []
    return Object.keys(props)
  }

  // Open create dialog with pre-filled data
  const openCreate = (eventId: string) => {
    const eventData = eventsWithWorkflows.find((e) => e.event.id === eventId)
    setCreateEventId(eventId)
    setCreateChannelId("")
    setCreateSubject("")
    setCreateBody("")
    setCreateFormat(eventData?.event.supported_channels?.includes("email") ? "html" : "text")
    setCreateOpen(true)
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
    setEditOpen(true)
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle route</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
                  if (ch) setCreateFormat(getDefaultFormat(ch.type))
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
              <Label>Message</Label>
              <Textarea
                className="min-h-[120px] font-mono text-sm"
                placeholder="Écrivez votre message ici..."
                value={createBody}
                onChange={(e) => setCreateBody(e.target.value)}
              />
              {createEvent && getVariables(createEvent).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-xs text-muted-foreground mr-1">Variables :</span>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
              <Label>Message</Label>
              <Textarea
                className="min-h-[150px] font-mono text-sm"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
              />
              {editEvent && getVariables(editEvent).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-xs text-muted-foreground mr-1">Variables :</span>
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

export default function AdminWorkflowsPage() {
  return <WorkflowsContent />
}
