"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { SendingDomainCard } from "@/components/sending-domain-card"
import { DiscordBotCard } from "@/components/discord-bot-card"
import { McpConnectCard } from "@/components/mcp-connect-card"
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import { Loader2, Mail, MessageSquare, Sparkles } from "lucide-react"

interface OrgSettings {
  sender_name: string | null
  reply_to: string | null
  sender_domain: string | null
  domain_status: string
}

export default function AdminSettingsPage() {
  const { selectedClub, loading: clubLoading } = useClub()
  const orgId = selectedClub?.club_id
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [senderName, setSenderName] = useState("")
  const [replyTo, setReplyTo] = useState("")

  const fetchSettings = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      const res = await fetch(`/api/admin/settings?org_id=${orgId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const s: OrgSettings = data.settings
      setSenderName(s.sender_name || "")
      setReplyTo(s.reply_to || "")
    } catch {
      toast.error("Erreur lors du chargement des paramètres")
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { setLoading(true); fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          sender_name: senderName || null,
          reply_to: replyTo || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Erreur lors de la sauvegarde")
        return
      }
      toast.success("Paramètres enregistrés")
    } catch {
      toast.error("Erreur lors de la sauvegarde")
    } finally {
      setSaving(false)
    }
  }

  if (clubLoading || !selectedClub || loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48" /></div>
  }

  const previewName = senderName || "Quatools Notifications"

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres"
        description="L'identité sous laquelle vos notifications sont envoyées. Vos membres et clients voient le nom de votre organisation, pas celui de Quatools."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            Identité d&apos;expéditeur
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sender-name">Nom d&apos;expéditeur</Label>
              <Input
                id="sender-name"
                placeholder="ex: Club Démo"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                maxLength={80}
              />
              <p className="text-xs text-muted-foreground">
                Affiché comme nom d&apos;envoi sur les emails et comme auteur des messages Discord.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply-to">Adresse de réponse (Reply-To)</Label>
              <Input
                id="reply-to"
                type="email"
                placeholder="ex: contact@monclub.fr"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Quand un destinataire répond à un email, sa réponse part vers cette adresse.
              </p>
            </div>
          </div>

          {/* Aperçu */}
          <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Aperçu</p>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-blue-500 shrink-0" />
              <span>
                <span className="font-semibold">{previewName}</span>
                <span className="text-muted-foreground"> &lt;notifications@quatools.fr&gt;</span>
                {replyTo && <span className="text-muted-foreground"> · répond vers {replyTo}</span>}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-indigo-500 shrink-0" />
              <span>
                Messages Discord postés sous le nom <span className="font-semibold">{previewName}</span>
              </span>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      <SendingDomainCard orgId={selectedClub.club_id} />

      <DiscordBotCard />

      <McpConnectCard orgId={selectedClub.club_id} />
    </div>
  )
}
