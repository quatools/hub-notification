"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { ShieldAlert, Check, Ban, Clock } from "lucide-react"

type Status = "trial" | "active" | "blocked"
interface App {
  id: string
  slug: string
  name: string
  owner_email: string | null
  status: Status
  send_count: number
  trial_limit: number
  created_at: string
}

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  trial: { label: "Essai", color: "#C05B2E", bg: "rgba(192,91,46,0.10)" },
  active: { label: "Actif", color: "#2F7D5B", bg: "rgba(47,125,91,0.10)" },
  blocked: { label: "Bloqué", color: "#B5402F", bg: "rgba(181,64,47,0.10)" },
}

export default function OperatorPage() {
  const [apps, setApps] = useState<App[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)

  const fetchApps = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/apps")
      if (res.status === 403) {
        setDenied(true)
        return
      }
      if (!res.ok) throw new Error()
      const j = await res.json()
      setApps(j.apps)
    } catch {
      toast.error("Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchApps()
  }, [fetchApps])

  const setStatus = async (app: App, status: Status) => {
    const res = await fetch("/api/operator/apps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: app.id, status }),
    })
    if (res.ok) {
      toast.success(`${app.name} → ${STATUS_META[status].label}`)
      fetchApps()
    } else {
      toast.error((await res.json()).error || "Erreur")
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[920px] space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  if (denied) {
    return (
      <div className="mx-auto max-w-[920px] p-6 py-20 text-center">
        <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="mb-2 text-xl font-semibold">Accès réservé</h1>
        <p className="text-sm text-muted-foreground">Cette console est réservée aux opérateurs Quatools.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[920px] p-6">
      <div className="mb-6">
        <h1 className="font-serif text-[26px] font-medium">Console opérateur</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Validez ou bloquez les applications self-service. Une app en <strong>essai</strong> est plafonnée
          jusqu&apos;à votre validation.
        </p>
      </div>

      <div className="space-y-2.5">
        {apps && apps.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#DAD4C6] p-8 text-center text-sm text-muted-foreground">
            Aucune application.
          </div>
        )}
        {apps?.map((a) => {
          const m = STATUS_META[a.status]
          return (
            <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-[#DAD4C6] bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {a.name}
                  <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{a.slug}</code>
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {a.owner_email || "propriétaire inconnu"}
                  {a.status === "trial" ? ` · ${a.send_count}/${a.trial_limit} envois d'essai` : ` · ${a.send_count} envois`}
                </div>
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ color: m.color, background: m.bg }}
              >
                {m.label}
              </span>
              <div className="flex shrink-0 gap-1.5">
                {a.status !== "active" && (
                  <Button size="sm" onClick={() => setStatus(a, "active")}>
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Valider
                  </Button>
                )}
                {a.status !== "blocked" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[#B5402F] hover:text-[#B5402F]"
                    onClick={() => setStatus(a, "blocked")}
                  >
                    <Ban className="mr-1 h-3.5 w-3.5" />
                    Bloquer
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(a, "trial")}>
                    <Clock className="mr-1 h-3.5 w-3.5" />
                    Essai
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
