"use client"

import { useEffect, useState, useCallback } from "react"
import { useClub } from "@/lib/contexts/club-context"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { BellOff, Mail } from "lucide-react"

interface Optout {
  member: string
  email: string | null
  event: string
  reason: string | null
  date: string
}

const REASON_LABELS: Record<string, string> = {
  trop_souvent: "Trop souvent",
  pas_pertinent: "Pas pertinent",
  mauvais_moment: "Mauvais moment",
  autre_canal: "Préfère un autre canal",
  autre: "Autre",
}

export default function UnsubscribesPage() {
  const { selectedClub, loading: clubLoading } = useClub()
  const orgId = selectedClub?.club_id
  const [rows, setRows] = useState<Optout[] | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!orgId) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/admin/unsubscribes?org_id=${orgId}`)
      if (!res.ok) throw new Error()
      setRows((await res.json()).optouts)
    } catch {
      toast.error("Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  if (clubLoading || !selectedClub || loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[820px] space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-normal">Désabonnements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Qui a coupé quelles notifications, et pourquoi. Vous pouvez recontacter un membre pour lui proposer de
          réactiver — il le refait lui-même depuis son espace (jamais réactivé sans son accord).
        </p>
      </div>

      {!rows || rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DAD4C6] p-10 text-center">
          <BellOff className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucun désabonnement pour l&apos;instant. 🎉</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((o, i) => (
            <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[#DAD4C6] bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{o.member}</div>
                {o.email && <div className="truncate text-xs text-muted-foreground">{o.email}</div>}
              </div>
              <div className="min-w-0 text-sm">
                <span className="text-muted-foreground">a coupé</span> <span className="font-medium">« {o.event} »</span>
              </div>
              {o.reason && (
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11.5px] text-muted-foreground">
                  {REASON_LABELS[o.reason] || o.reason}
                </span>
              )}
              <div className="shrink-0 font-mono text-xs text-muted-foreground">
                {new Date(o.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </div>
              {o.email && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={`mailto:${o.email}?subject=${encodeURIComponent(`Vos notifications ${selectedClub.club_name}`)}`}>
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    Contacter
                  </a>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
