"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

/** Affiche le compte connecté + un bouton de déconnexion (pour changer de compte). */
export function AccountMenu() {
  const router = useRouter()
  const supabaseRef = useRef<SupabaseClient | null>(null)
  const [label, setLabel] = useState<string | null>(null)

  if (!supabaseRef.current && typeof window !== "undefined") {
    supabaseRef.current = createClient()
  }

  useEffect(() => {
    supabaseRef.current?.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) return
      const meta = (u.user_metadata || {}) as Record<string, string>
      setLabel(meta.full_name || meta.name || u.email || null)
    })
  }, [])

  if (!label) return null

  const logout = async () => {
    await supabaseRef.current?.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="hidden md:inline text-xs text-muted-foreground max-w-[140px] truncate" title={label}>
        {label}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={logout}
        title="Se déconnecter / changer de compte"
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Déconnexion</span>
      </Button>
    </div>
  )
}
