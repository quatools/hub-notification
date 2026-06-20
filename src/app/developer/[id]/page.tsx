"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { ArrowLeft, Plus, Loader2, Trash2, Copy, Check, KeyRound, Eye, EyeOff } from "lucide-react"

const HUB_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hub.quatools.fr"

interface App {
  id: string
  slug: string
  name: string
  status: "trial" | "active" | "blocked"
  send_count: number
  trial_limit: number
  signing_secret: string
}
interface ApiKey {
  id: string
  key_prefix: string
  label: string | null
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

const STATUS: Record<App["status"], { label: string; color: string }> = {
  trial: { label: "Essai", color: "#C05B2E" },
  active: { label: "Actif", color: "#2F7D5B" },
  blocked: { label: "Bloqué", color: "#B5402F" },
}

function CopyBtn({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500) }}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
      aria-label="Copier"
    >
      {done ? <Check className="h-3.5 w-3.5 text-[#2F7D5B]" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

export default function AppDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [app, setApp] = useState<App | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [genOpen, setGenOpen] = useState(false)
  const [genLabel, setGenLabel] = useState("")
  const [generating, setGenerating] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [showSigning, setShowSigning] = useState(false)

  const load = useCallback(async () => {
    try {
      const [a, k] = await Promise.all([
        fetch(`/api/developer/apps/${id}`),
        fetch(`/api/developer/apps/${id}/keys`),
      ])
      if (!a.ok) throw new Error()
      setApp((await a.json()).app)
      setKeys((await k.json()).keys || [])
    } catch {
      toast.error("Erreur lors du chargement")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/developer/apps/${id}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: genLabel || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "Erreur"); return }
      setGenOpen(false); setGenLabel("")
      setNewSecret(data.secret)
      load()
    } catch {
      toast.error("Erreur lors de la génération")
    } finally {
      setGenerating(false)
    }
  }

  const revoke = async (keyId: string) => {
    try {
      const res = await fetch(`/api/developer/apps/${id}/keys/${keyId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setKeys((prev) => prev.map((k) => k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k))
      toast.success("Clé révoquée")
    } catch {
      toast.error("Erreur lors de la révocation")
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-[760px] py-8 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-32" /></div>
  }
  if (!app) {
    return (
      <div className="mx-auto max-w-[760px] py-16 text-center">
        <p className="text-muted-foreground mb-4">Application introuvable.</p>
        <Button asChild variant="outline"><Link href="/developer"><ArrowLeft className="mr-2 h-4 w-4" />Retour</Link></Button>
      </div>
    )
  }

  const st = STATUS[app.status]
  const envSnippet =
    `NOTIFICATION_HUB_URL=${HUB_URL}\n` +
    `NOTIFICATION_API_KEY=<votre clé générée ci-dessus>\n` +
    `NOTIFICATION_SIGNING_SECRET=${app.signing_secret}`

  return (
    <div className="mx-auto max-w-[760px] py-8">
      <Link href="/developer" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />Mes applications
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-[26px] font-medium">{app.name}</h1>
            <span className="mono-label rounded-full px-2 py-0.5 text-[10px]"
              style={{ background: `color-mix(in srgb, ${st.color} 12%, white)`, color: st.color }}>
              {st.label}
            </span>
          </div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{app.slug}</div>
        </div>
      </div>

      {/* Statut d'essai */}
      {app.status === "trial" && (
        <div className="mt-5 rounded-xl border border-[color:var(--qt-copper-500)]/30 bg-[color:var(--qt-copper-500)]/[0.06] px-4 py-3 text-[13px]">
          <strong>Mode essai</strong> — {app.send_count}/{app.trial_limit} envois utilisés. Au-delà, l&apos;émission
          est suspendue jusqu&apos;à validation manuelle par l&apos;opérateur (le temps qu&apos;il vérifie ce que vous envoyez).
        </div>
      )}
      {app.status === "blocked" && (
        <div className="mt-5 rounded-xl border border-[#B5402F]/30 bg-[#B5402F]/[0.06] px-4 py-3 text-[13px] text-[#7A4039]">
          <strong>Application bloquée</strong> — l&apos;émission est suspendue. Contactez l&apos;opérateur.
        </div>
      )}

      {/* Clés API */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-medium">Clés API</h2>
          <Dialog open={genOpen} onOpenChange={(o) => { setGenOpen(o); if (!o) setGenLabel("") }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Générer une clé</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Générer une clé API</DialogTitle></DialogHeader>
              <div className="space-y-1.5 py-2">
                <Label>Label (optionnel)</Label>
                <Input placeholder="ex: Production" value={genLabel} onChange={(e) => setGenLabel(e.target.value)} />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
                <Button onClick={generate} disabled={generating}>
                  {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Générer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-3 space-y-2">
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune clé. Générez-en une pour intégrer votre app.</p>
          ) : keys.map((k) => (
            <div key={k.id} className={`flex items-center gap-3 rounded-xl border border-[#DAD4C6] bg-white px-4 py-3 ${k.revoked_at ? "opacity-50" : ""}`}>
              <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[13px]">{k.key_prefix}</div>
                <div className="text-xs text-muted-foreground">
                  {k.label ? `${k.label} · ` : ""}{k.revoked_at ? "Révoquée" : k.last_used_at ? "Utilisée récemment" : "Jamais utilisée"}
                </div>
              </div>
              {!k.revoked_at && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-[#B5402F]"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Révoquer cette clé ?</AlertDialogTitle>
                      <AlertDialogDescription>Toute intégration utilisant cette clé cessera de fonctionner immédiatement.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => revoke(k.id)}>Révoquer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Intégration */}
      <div className="mt-8">
        <h2 className="font-serif text-lg font-medium">Intégration</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Variables d&apos;environnement pour votre application :
        </p>
        <div className="mt-3 rounded-xl border border-[#DAD4C6] bg-[#15181E] p-4">
          <div className="flex items-start justify-between gap-3">
            <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed text-[#E8E5DD]">{envSnippet}</pre>
            <CopyBtn value={envSnippet} />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="font-semibold">Secret de signature</span>
          <button type="button" onClick={() => setShowSigning((s) => !s)} className="inline-flex items-center gap-1 hover:text-foreground">
            {showSigning ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showSigning ? "masquer" : "afficher"}
          </button>
          {showSigning && <code className="font-mono text-[11px] break-all">{app.signing_secret}</code>}
          <CopyBtn value={app.signing_secret} />
        </div>

        <div className="mt-5 rounded-xl border border-[#DAD4C6] bg-white p-4 text-[13px] leading-relaxed">
          <div className="mono-label mb-2">Parcours d&apos;intégration</div>
          <ol className="ml-4 list-decimal space-y-1.5 text-foreground/80">
            <li><code>POST /api/notifications/register</code> — déclarez vos événements.</li>
            <li><code>POST /api/notifications/orgs</code> — déclarez une organisation → vous récupérez son <code>org_id</code>.</li>
            <li>Lien admin — donnez les droits à un humain (signé avec votre <em>secret de signature</em>).</li>
            <li><code>POST /api/notifications/emit</code> — émettez (avec <code>org_id</code> + <code>recipients</code>).</li>
          </ol>
          <p className="mt-3 text-muted-foreground">
            Doc complète (lisible aussi par un agent IA) :{" "}
            <a href={`${HUB_URL.replace("hub.", "www.")}/hub/docs/llms-full.txt`} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              llms-full.txt
            </a>{" · "}
            <a href="https://www.quatools.fr/hub/docs" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              documentation
            </a>
          </p>
        </div>
      </div>

      {/* Secret affiché une seule fois */}
      <Dialog open={!!newSecret} onOpenChange={(o) => { if (!o) setNewSecret(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Votre clé API</DialogTitle>
            <DialogDescription>
              Copiez-la maintenant : pour des raisons de sécurité, elle ne sera <strong>plus jamais affichée</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border border-[#DAD4C6] bg-secondary/40 px-3 py-2.5">
            <code className="flex-1 break-all font-mono text-[12px]">{newSecret}</code>
            {newSecret && <CopyBtn value={newSecret} />}
          </div>
          <DialogFooter>
            <Button onClick={() => setNewSecret(null)}>J&apos;ai copié la clé</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
