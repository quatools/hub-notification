"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { LogOut, Shield, User, Check, Zap, Settings, Code } from "lucide-react"

/** Avatar + menu compte : bascule d'espace (admin / membre) et déconnexion. */
export function AccountMenu() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) return
      const m = (u.user_metadata || {}) as Record<string, string>
      setName(m.full_name || m.name || u.email || null)
      setEmail(u.email || null)
      // Discord / Google / GitHub exposent la photo via avatar_url ou picture.
      setAvatar(m.avatar_url || m.picture || null)
    })
  }, [supabase])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  if (!name) return null

  const initials = name.includes("@")
    ? name.slice(0, 2).toUpperCase()
    : name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
  const isAdmin = pathname.startsWith("/admin")
  const isUser = pathname.startsWith("/preferences")
  const isDeveloper = pathname.startsWith("/developer")

  const logout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={name}
        className="flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-72 rounded-xl border bg-popover p-2 shadow-lg">
          <div className="flex items-center gap-3 px-2.5 pb-3 pt-2">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{name}</div>
              {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
            </div>
          </div>

          <div className="border-t pt-1.5">
            <div className="mono-label px-2.5 py-1.5">Changer d&apos;espace</div>
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-secondary"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-[13px] font-semibold">Espace administration</span>
                <span className="block text-xs text-muted-foreground">Gérer les notifs des clubs</span>
              </span>
              {isAdmin && <Check className="h-4 w-4 text-[color:var(--qt-copper-500)]" />}
            </Link>
            <Link
              href="/preferences"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-secondary"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <User className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-[13px] font-semibold">Mon espace</span>
                <span className="block text-xs text-muted-foreground">Mes notifications perso</span>
              </span>
              {isUser && <Check className="h-4 w-4 text-[color:var(--qt-copper-500)]" />}
            </Link>
            <Link
              href="/developer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-secondary"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <Code className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-[13px] font-semibold">Espace développeur</span>
                <span className="block text-xs text-muted-foreground">Mes applications &amp; clés API</span>
              </span>
              {isDeveloper && <Check className="h-4 w-4 text-[color:var(--qt-copper-500)]" />}
            </Link>
          </div>

          {isAdmin && (
            <div className="mt-1.5 border-t pt-1.5">
              <div className="mono-label px-2.5 py-1.5">Administration</div>
              <Link href="/admin/events" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] hover:bg-secondary">
                <Zap className="h-4 w-4 text-muted-foreground" />Événements
              </Link>
              <Link href="/admin/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] hover:bg-secondary">
                <Settings className="h-4 w-4 text-muted-foreground" />Paramètres
              </Link>
            </div>
          )}

          <div className="mt-1.5 border-t pt-1.5">
            <button
              onClick={logout}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
