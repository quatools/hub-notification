"use client"

import { useEffect, useState, useCallback } from "react"
import { useClub } from "@/lib/contexts/club-context"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { Users, UserPlus, Crown, Trash2, Copy, Check, Loader2, ChevronDown, ShieldAlert } from "lucide-react"

type Role = "owner" | "admin"
interface Member {
  user_id: string
  role: Role
  email: string | null
  name: string | null
  avatar: string | null
  created_at: string
}
interface TeamData {
  team: Member[]
  my_role: Role
  my_user_id: string
  has_owner: boolean
}

const ROLE_LABEL: Record<Role, string> = { owner: "Propriétaire", admin: "Admin" }
const ROLE_COLOR: Record<Role, string> = { owner: "#C05B2E", admin: "#24405E" }

function Avatar({ m }: { m: Member }) {
  const initials = (m.name || m.email || "?").slice(0, 2).toUpperCase()
  return m.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={m.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
      {initials}
    </span>
  )
}

export default function TeamPage() {
  const { selectedClub, loading: clubLoading } = useClub()
  const orgId = selectedClub?.club_id || null
  const [data, setData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteRole, setInviteRole] = useState<Role>("admin")
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchTeam = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      const res = await fetch(`/api/admin/team?org_id=${orgId}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      toast.error("Erreur lors du chargement de l'équipe")
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { setLoading(true); fetchTeam() }, [fetchTeam])

  const claim = async () => {
    const res = await fetch("/api/admin/team/claim", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId }),
    })
    if (res.ok) { toast.success("Vous êtes propriétaire de cette structure"); fetchTeam() }
    else toast.error((await res.json()).error || "Erreur")
  }

  const generateInvite = async () => {
    setInviting(true); setInviteUrl(null)
    try {
      const res = await fetch("/api/admin/team/invite", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, role: inviteRole }),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || "Erreur"); return }
      setInviteUrl(j.invite_url)
    } finally { setInviting(false) }
  }

  const changeRole = async (userId: string, role: Role) => {
    const res = await fetch("/api/admin/team/member", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, user_id: userId, role }),
    })
    if (res.ok) { toast.success("Rôle mis à jour"); fetchTeam() }
    else toast.error((await res.json()).error || "Erreur")
  }

  const removeMember = async (userId: string) => {
    const res = await fetch("/api/admin/team/member", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, user_id: userId }),
    })
    if (res.ok) { toast.success("Membre retiré"); fetchTeam() }
    else toast.error((await res.json()).error || "Erreur")
  }

  if (clubLoading) {
    return <div className="mx-auto max-w-[720px] space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-24" /></div>
  }
  if (!selectedClub) {
    return (
      <div className="mx-auto max-w-[720px] py-16 text-center">
        <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="mb-2 text-xl font-semibold">Aucune structure à administrer</h2>
        <p className="text-sm text-muted-foreground">
          Ce compte n&apos;administre aucune structure. Rejoignez-en une via un lien d&apos;invitation,
          ou sélectionnez-en une dans le menu en haut si vous en gérez plusieurs.
        </p>
      </div>
    )
  }
  if (loading || !data) {
    return <div className="mx-auto max-w-[720px] space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-24" /></div>
  }

  const isOwner = data.my_role === "owner"

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-[26px] font-medium">Équipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Qui peut gérer les notifications de <strong>{selectedClub.club_name}</strong>.
          </p>
        </div>
        {isOwner && (
          <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) { setInviteUrl(null); setInviteRole("admin") } }}>
            <DialogTrigger asChild>
              <Button className="shrink-0"><UserPlus className="mr-2 h-4 w-4" />Inviter</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Inviter un membre</DialogTitle>
                <DialogDescription>
                  Générez un lien à partager. La personne se connecte et rejoint l&apos;équipe.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-1">
                <div className="flex gap-2">
                  {(["admin", "owner"] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteRole(r)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                        inviteRole === r
                          ? "border-[color:var(--qt-copper-500)] bg-[color:var(--qt-copper-500)]/[0.08]"
                          : "border-[color:var(--qt-sable-300,#DAD4C6)] text-muted-foreground hover:bg-secondary/50"
                      }`}
                    >
                      {ROLE_LABEL[r]}{r === "owner" ? " (co-propriétaire)" : ""}
                    </button>
                  ))}
                </div>
                {inviteUrl ? (
                  <div className="flex items-center gap-2 rounded-lg border border-[#DAD4C6] bg-secondary/40 px-3 py-2.5">
                    <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{inviteUrl}</code>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      {copied ? <Check className="h-4 w-4 text-[#2F7D5B]" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                ) : (
                  <p className="text-[11.5px] text-muted-foreground">Lien valable 7 jours.</p>
                )}
              </div>
              <DialogFooter>
                <Button onClick={generateInvite} disabled={inviting}>
                  {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {inviteUrl ? "Générer un nouveau lien" : "Générer le lien"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Bootstrap : pas encore de propriétaire */}
      {!data.has_owner && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-[color:var(--qt-copper-500)]/30 bg-[color:var(--qt-copper-500)]/[0.06] px-4 py-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-[color:var(--qt-copper-500)]" />
          <div className="flex-1 text-[13px]">
            <strong>Cette structure n&apos;a pas encore de propriétaire.</strong> Devenez-le pour gérer l&apos;équipe.
          </div>
          <Button size="sm" onClick={claim}>Devenir propriétaire</Button>
        </div>
      )}

      {/* Liste des membres */}
      <div className="mt-6 space-y-2.5">
        {data.team.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DAD4C6] p-8 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucun membre dans l&apos;équipe pour l&apos;instant.</p>
          </div>
        ) : data.team.map((m) => {
          const isMe = m.user_id === data.my_user_id
          return (
            <div key={m.user_id} className="flex items-center gap-3 rounded-2xl border border-[#DAD4C6] bg-white px-4 py-3">
              <Avatar m={m} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {m.name || m.email || "Membre"} {isMe && <span className="text-xs font-normal text-muted-foreground">(vous)</span>}
                  {m.role === "owner" && <Crown className="h-3.5 w-3.5 text-[color:var(--qt-copper-500)]" />}
                </div>
                {m.email && <div className="truncate text-xs text-muted-foreground">{m.email}</div>}
              </div>

              {isOwner ? (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1.5 rounded-lg border border-[#DAD4C6] px-2.5 py-1.5 text-xs font-semibold">
                        <span style={{ color: ROLE_COLOR[m.role] }}>{ROLE_LABEL[m.role]}</span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => changeRole(m.user_id, "owner")}>Propriétaire</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => changeRole(m.user_id, "admin")}>Admin</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-[#B5402F]"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Retirer ce membre ?</AlertDialogTitle>
                        <AlertDialogDescription>Il ne pourra plus gérer les notifications de cette structure.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeMember(m.user_id)}>Retirer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <span className="text-xs font-semibold" style={{ color: ROLE_COLOR[m.role] }}>{ROLE_LABEL[m.role]}</span>
              )}
            </div>
          )
        })}
      </div>

      {!isOwner && (
        <p className="mt-5 text-xs text-muted-foreground">
          Seul le propriétaire de la structure peut inviter ou retirer des membres.
        </p>
      )}
    </div>
  )
}
