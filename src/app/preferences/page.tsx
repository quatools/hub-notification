"use client"

import { useEffect, useState, useCallback } from "react"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { useClub } from "@/lib/contexts/club-context"
import { toast } from "sonner"
import Link from "next/link"
import { BellOff, Info, LogIn, ChevronDown } from "lucide-react"

interface MemberAccount {
  id: string
  type: string
  label: string | null
  config: { email?: string } | null
}

interface NotificationPref {
  event_id: string
  event_slug: string
  label: string
  category: string
  is_enabled: boolean
  channel_id: string | null
}

interface PreferencesData {
  dnd_enabled: boolean
  default_channel_id: string | null
  accounts: MemberAccount[]
  notifications: NotificationPref[]
}

function accountLabel(acc: MemberAccount): string {
  if (acc.label) return acc.label
  if (acc.type === "email") return acc.config?.email || "email"
  return acc.type
}

function accountDot(acc: MemberAccount): string {
  if (acc.type === "email") return "#C05B2E"
  if (acc.type === "discord_dm" || acc.type === "discord") return "#5865F2"
  return "#9197A1"
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-[2px] shrink-0"
      style={{ width: 8, height: 8, backgroundColor: color }}
      aria-hidden
    />
  )
}

function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s
}

function PreferencesContent() {
  const { selectedClub, loading: clubLoading, isAuthenticated } = useClub()
  const orgId = selectedClub?.club_id || null

  const [data, setData] = useState<PreferencesData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPrefs = useCallback(async () => {
    if (!orgId) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/user/preferences?org_id=${orgId}`)
      if (!res.ok) throw new Error()
      const json: PreferencesData = await res.json()
      setData(json)
    } catch {
      toast.error("Erreur lors du chargement des préférences")
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchPrefs()
  }, [fetchPrefs])

  // --- Mutations (optimistic with rollback) ---

  const putGlobal = async (
    patch: { dnd_enabled?: boolean; default_channel_id?: string | null }
  ) => {
    if (!data) return
    const previous = data
    setData({ ...data, ...patch })
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
    } catch {
      setData(previous)
      toast.error("Erreur lors de la mise à jour")
    }
  }

  const putEvent = async (
    eventId: string,
    patch: { is_enabled?: boolean; channel_id?: string | null }
  ) => {
    if (!data) return
    const previous = data
    setData({
      ...data,
      notifications: data.notifications.map((n) =>
        n.event_id === eventId ? { ...n, ...patch } : n
      ),
    })
    try {
      const res = await fetch("/api/user/preferences/event", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, ...patch }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setData(previous)
      toast.error("Erreur lors de la mise à jour")
    }
  }

  // --- Guards (mirror previous patterns) ---

  if (clubLoading) {
    return (
      <div className="mx-auto max-w-[720px] py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <LogIn className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Connexion requise</h2>
        <p className="text-muted-foreground mb-4">
          Connectez-vous pour gérer vos notifications.
        </p>
        <Button asChild>
          <Link href="/login">Se connecter</Link>
        </Button>
      </div>
    )
  }

  if (!selectedClub) {
    return (
      <div className="text-center py-12">
        <BellOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sélectionnez une organisation</h2>
        <p className="text-muted-foreground">
          Choisissez une organisation dans le menu en haut de page.
        </p>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-[720px] py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  const { dnd_enabled, default_channel_id, accounts, notifications } = data
  const defaultAccount = accounts.find((a) => a.id === default_channel_id) || null
  const defaultLabel = defaultAccount ? accountLabel(defaultAccount) : "Aucun compte"
  const defaultColor = defaultAccount ? accountDot(defaultAccount) : "#9197A1"

  return (
    <div className="mx-auto max-w-[720px] py-8">
      <h1 className="font-serif text-[26px] font-medium">Mes notifications</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Choisissez ce que le club vous envoie — et sur quel compte vous le recevez.
      </p>

      {/* Header card: DND + default account */}
      <div className="border border-[#DAD4C6] rounded-2xl px-4 bg-white">
        {/* Row 1: Ne pas déranger */}
        <div className="flex items-center justify-between py-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Ne pas déranger</div>
            <div className="text-xs text-muted-foreground">
              {dnd_enabled
                ? "Toutes vos notifications sont en pause."
                : "Vous recevez vos notifications normalement."}
            </div>
          </div>
          <Switch
            checked={dnd_enabled}
            onCheckedChange={(v) => putGlobal({ dnd_enabled: v })}
          />
        </div>

        {/* Row 2: Compte par défaut */}
        <div className="flex items-center justify-between py-4 border-t border-[#F1F2F5]">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Compte par défaut</div>
            <div className="text-xs text-muted-foreground">
              Où arrivent vos notifications, sauf exception.
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 border border-[#DAD4C6] rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
              >
                <Dot color={defaultColor} />
                <span className="truncate max-w-[160px]">{defaultLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {accounts.length === 0 ? (
                <DropdownMenuItem disabled>Aucun compte</DropdownMenuItem>
              ) : (
                accounts.map((acc) => (
                  <DropdownMenuItem
                    key={acc.id}
                    onSelect={() => putGlobal({ default_channel_id: acc.id })}
                    className="gap-2"
                  >
                    <Dot color={accountDot(acc)} />
                    <span className="truncate">{accountLabel(acc)}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Flat list of notification rows */}
      <div className="flex flex-col gap-3 mt-6">
        {notifications.length === 0 ? (
          <div className="border border-dashed border-[#DAD4C6] rounded-2xl p-8 text-center">
            <BellOff className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Aucune notification configurée</h3>
            <p className="text-sm text-muted-foreground">
              L&apos;administrateur n&apos;a pas encore configuré de notifications
              vous concernant.
            </p>
          </div>
        ) : (
          notifications.map((n) => {
            const chosen = accounts.find((a) => a.id === n.channel_id) || null
            const chosenLabel = chosen ? accountLabel(chosen) : "Compte par défaut"
            const chosenColor = chosen ? accountDot(chosen) : "#9197A1"
            return (
              <div
                key={n.event_id}
                className="border border-[#DAD4C6] rounded-2xl p-4 bg-white"
              >
                <div className="flex items-start gap-3">
                  <p className="flex-1 text-sm">
                    Me prévenir quand{" "}
                    <strong className="font-semibold">{lowerFirst(n.label)}</strong>
                  </p>
                  <Switch
                    checked={n.is_enabled}
                    onCheckedChange={(v) =>
                      putEvent(n.event_id, { is_enabled: v })
                    }
                  />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Reçu sur</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-2 border border-[#DAD4C6] rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
                      >
                        <Dot color={chosenColor} />
                        <span className="truncate max-w-[180px]">{chosenLabel}</span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onSelect={() => putEvent(n.event_id, { channel_id: null })}
                        className="gap-2"
                      >
                        <Dot color="#9197A1" />
                        <span>Compte par défaut</span>
                      </DropdownMenuItem>
                      {accounts.map((acc) => (
                        <DropdownMenuItem
                          key={acc.id}
                          onSelect={() =>
                            putEvent(n.event_id, { channel_id: acc.id })
                          }
                          className="gap-2"
                        >
                          <Dot color={accountDot(acc)} />
                          <span className="truncate">{accountLabel(acc)}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer note */}
      <div className="mt-5 flex items-start gap-2">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Les canaux du club (salon Discord, email du club) sont gérés par
          l&apos;administrateur. Ici, vous choisissez vos propres comptes.
        </p>
      </div>
    </div>
  )
}

export default function PreferencesPage() {
  return <PreferencesContent />
}
