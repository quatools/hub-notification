"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Plus, Loader2, ChevronRight, LogIn, Terminal } from "lucide-react"

interface App {
  id: string
  slug: string
  name: string
  status: "trial" | "active" | "blocked"
  send_count: number
  trial_limit: number
  created_at: string
}

const STATUS: Record<App["status"], { label: string; color: string }> = {
  trial: { label: "Essai", color: "#C05B2E" },
  active: { label: "Actif", color: "#2F7D5B" },
  blocked: { label: "Bloqué", color: "#B5402F" },
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 39)
}

export default function DeveloperPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setAuthed(!!data.user))
  }, [])

  const fetchApps = useCallback(async () => {
    try {
      const res = await fetch("/api/developer/apps")
      if (res.status === 401) { setAuthed(false); return }
      if (!res.ok) throw new Error()
      const data = await res.json()
      setApps(data.apps || [])
    } catch {
      toast.error("Erreur lors du chargement des applications")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchApps() }, [fetchApps])

  const handleCreate = async () => {
    if (!name.trim() || !slug) return
    setCreating(true)
    try {
      const res = await fetch("/api/developer/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "Erreur"); return }
      toast.success("Application créée")
      setOpen(false); setName(""); setSlug(""); setSlugEdited(false)
      fetchApps()
    } catch {
      toast.error("Erreur lors de la création")
    } finally {
      setCreating(false)
    }
  }

  if (authed === false) {
    return (
      <div className="text-center py-16">
        <LogIn className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Connexion requise</h2>
        <p className="text-muted-foreground mb-4">Connectez-vous pour gérer vos applications.</p>
        <Button asChild><Link href="/login?next=/developer">Se connecter</Link></Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[760px] py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[26px] font-medium">Espace développeur</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connectez votre application au hub : déclarez-la, générez une clé, et émettez des notifications.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setName(""); setSlug(""); setSlugEdited(false) } }}>
          <DialogTrigger asChild>
            <Button className="shrink-0"><Plus className="mr-2 h-4 w-4" />Nouvelle application</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle application</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Nom</Label>
                <Input
                  placeholder="ex: Storm"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (!slugEdited) setSlug(slugify(e.target.value))
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Identifiant (slug)</Label>
                <Input
                  placeholder="ex: storm"
                  value={slug}
                  onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true) }}
                />
                <p className="text-[11.5px] text-muted-foreground">
                  Sert d&apos;espace de noms à vos événements (ex: <code>storm.appointment.created</code>). Minuscules, chiffres, tirets.
                </p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
              <Button onClick={handleCreate} disabled={creating || !name.trim() || !slug}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        ) : apps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DAD4C6] p-10 text-center">
            <Terminal className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h3 className="mb-1 font-semibold">Aucune application</h3>
            <p className="text-sm text-muted-foreground">Créez-en une pour obtenir votre clé d&apos;intégration.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {apps.map((app) => {
              const st = STATUS[app.status]
              return (
                <Link
                  key={app.id}
                  href={`/developer/${app.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-[#DAD4C6] bg-white px-4 py-3.5 hover:border-[color:var(--qt-copper-500)] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{app.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{app.slug}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {app.status === "trial"
                        ? `Essai · ${app.send_count}/${app.trial_limit} envois`
                        : app.status === "active"
                          ? `Actif · ${app.send_count} envois`
                          : "Bloqué"}
                    </div>
                  </div>
                  <span
                    className="mono-label rounded-full px-2 py-0.5 text-[10px]"
                    style={{ background: `color-mix(in srgb, ${st.color} 12%, white)`, color: st.color }}
                  >
                    {st.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-[#C9CDD6]" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
