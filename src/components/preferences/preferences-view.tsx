"use client"

import { useEffect, useState, useCallback } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import Link from "next/link"
import { Settings } from "lucide-react"
import { PreferencesTable } from "./preferences-table"
import type { PreferenceEventRow } from "@/lib/types/notifications"

interface PreferencesViewProps {
  orgId: string | null
}

export function PreferencesView({ orgId }: PreferencesViewProps) {
  const [preferences, setPreferences] = useState<PreferenceEventRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPreferences = useCallback(async () => {
    if (!orgId) {
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/notifications/preferences?org_id=${orgId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPreferences(data.preferences)
    } catch {
      toast.error("Impossible de charger les préférences")
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  const handleToggle = async (eventId: string, channelId: string, isActive: boolean) => {
    if (!orgId) return

    // Update optimiste
    setPreferences((prev) =>
      prev.map((row) => {
        if (row.event_id !== eventId) return row
        return {
          ...row,
          channels: row.channels.map((ch) =>
            ch.channel_id === channelId ? { ...ch, is_active: isActive } : ch
          ),
        }
      })
    )

    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          event_id: eventId,
          channel_id: channelId,
          is_active: isActive,
        }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Rollback
      setPreferences((prev) =>
        prev.map((row) => {
          if (row.event_id !== eventId) return row
          return {
            ...row,
            channels: row.channels.map((ch) =>
              ch.channel_id === channelId ? { ...ch, is_active: !isActive } : ch
            ),
          }
        })
      )
      toast.error("Erreur lors de la mise à jour")
    }
  }

  // Pas d'org_id
  if (!orgId) {
    return (
      <div className="text-center py-12">
        <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Préférences de notification</h2>
        <p className="text-muted-foreground mb-4">
          Accédez à cette page depuis votre application pour configurer les notifications de votre organisation.
        </p>
        <p className="text-sm text-muted-foreground">
          L&apos;identifiant de l&apos;organisation doit être passé en paramètre <code>org_id</code>.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Compter les actifs
  const totalSlots = preferences.reduce((sum, row) => sum + row.channels.length, 0)
  const activeCount = preferences.reduce(
    (sum, row) => sum + row.channels.filter((ch) => ch.is_active).length,
    0
  )

  // Vérifier s'il y a des canaux
  const hasChannels = preferences.some((row) => row.channels.length > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Préférences de notification</h1>
          {hasChannels && (
            <p className="text-sm text-muted-foreground mt-1">
              <Badge variant="secondary">{activeCount}/{totalSlots}</Badge>{" "}
              notifications actives
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/channels">Gérer mes canaux</Link>
        </Button>
      </div>

      {/* Contenu */}
      {!hasChannels ? (
        <div className="border rounded-lg p-8 text-center">
          <p className="text-muted-foreground mb-4">
            Configurez au moins un canal de notification pour pouvoir activer vos préférences.
          </p>
          <Button asChild>
            <Link href="/channels">Configurer mes canaux</Link>
          </Button>
        </div>
      ) : (
        <PreferencesTable preferences={preferences} onToggle={handleToggle} />
      )}
    </div>
  )
}
