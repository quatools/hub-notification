"use client"

import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, MessageSquare, Phone } from "lucide-react"
import type { PreferenceEventRow } from "@/lib/types/notifications"

interface PreferencesTableProps {
  preferences: PreferenceEventRow[]
  onToggle: (eventId: string, channelId: string, isActive: boolean) => void
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  discord_webhook: MessageSquare,
  discord_dm: MessageSquare,
  sms: Phone,
}

const CATEGORY_LABELS: Record<string, string> = {
  billing: "Facturation",
  member: "Membres",
  team: "Équipes",
  system: "Système",
}

export function PreferencesTable({ preferences, onToggle }: PreferencesTableProps) {
  // Grouper par catégorie
  const grouped = preferences.reduce<Record<string, PreferenceEventRow[]>>((acc, row) => {
    const cat = row.event_category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(row)
    return acc
  }, {})

  // Déterminer les colonnes (types de canaux uniques)
  const channelColumns = new Map<string, { type: string; label: string }>()
  for (const row of preferences) {
    for (const ch of row.channels) {
      if (!channelColumns.has(ch.channel_id)) {
        channelColumns.set(ch.channel_id, {
          type: ch.channel_type,
          label: ch.channel_label || ch.channel_type,
        })
      }
    }
  }
  const columns = Array.from(channelColumns.entries())

  // Desktop: table
  // Mobile: cards
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        {Object.entries(grouped).map(([category, rows]) => (
          <div key={category} className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {CATEGORY_LABELS[category] || category}
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Événement</TableHead>
                  {columns.map(([colId, col]) => {
                    const Icon = CHANNEL_ICONS[col.type] || Mail
                    return (
                      <TableHead key={colId} className="text-center w-[120px]">
                        <div className="flex items-center justify-center gap-1.5">
                          <Icon className="h-3.5 w-3.5" />
                          <span className="text-xs">{col.label}</span>
                        </div>
                      </TableHead>
                    )
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.event_id}>
                    <TableCell className="font-medium">{row.event_label}</TableCell>
                    {columns.map(([colId]) => {
                      const ch = row.channels.find((c) => c.channel_id === colId)
                      if (!ch) {
                        return (
                          <TableCell key={colId} className="text-center">
                            <span className="text-muted-foreground">—</span>
                          </TableCell>
                        )
                      }
                      return (
                        <TableCell key={colId} className="text-center">
                          <Switch
                            checked={ch.is_active}
                            onCheckedChange={(checked) =>
                              onToggle(row.event_id, ch.channel_id, checked)
                            }
                          />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-6">
        {Object.entries(grouped).map(([category, rows]) => (
          <div key={category}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {CATEGORY_LABELS[category] || category}
            </h3>
            <div className="space-y-3">
              {rows.map((row) => (
                <Card key={row.event_id}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm">{row.event_label}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-0 space-y-2">
                    {row.channels.map((ch) => {
                      const Icon = CHANNEL_ICONS[ch.channel_type] || Mail
                      return (
                        <div
                          key={ch.channel_id}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">
                              {ch.channel_label || ch.channel_type}
                            </span>
                          </div>
                          <Switch
                            checked={ch.is_active}
                            onCheckedChange={(checked) =>
                              onToggle(row.event_id, ch.channel_id, checked)
                            }
                          />
                        </div>
                      )
                    })}
                    {row.channels.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Aucun canal compatible configuré
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
