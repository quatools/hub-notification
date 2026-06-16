"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useClub } from "@/lib/contexts/club-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AccountMenu } from "@/components/account-menu"

export function Navbar() {
  const pathname = usePathname()
  const { clubs, selectedClub, selectClub, loading } = useClub()

  const isAdmin = pathname.startsWith("/admin")
  const isUser = pathname.startsWith("/preferences")

  const adminItems = [
    { href: "/admin", label: "Aperçu", exact: true },
    { href: "/admin/workflows", label: "Notifications", exact: false },
    { href: "/admin/channels", label: "Canaux", exact: false },
    { href: "/admin/logs", label: "Historique", exact: false },
  ]

  const userItems = [
    { href: "/preferences", label: "Mes notifications", exact: true },
    { href: "/preferences/channels", label: "Mes comptes", exact: false },
    { href: "/preferences/history", label: "Mon historique", exact: false },
  ]

  const navItems = isAdmin ? adminItems : isUser ? userItems : []
  const initial = selectedClub?.club_name?.charAt(0).toUpperCase() || "•"

  return (
    <header className="border-b bg-card">
      <div className="flex items-center h-[58px] gap-3 px-5">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/notifications-favicon.svg" alt="" width={26} height={26} className="h-[26px] w-[26px] rounded-[7px]" />
          <span className="font-semibold text-[15px] tracking-tight">Notifications</span>
        </Link>

        {/* Sélecteur d'organisation (admin) */}
        {isAdmin && !loading && clubs.length > 1 && (
          <Select value={selectedClub?.club_id || ""} onValueChange={selectClub}>
            <SelectTrigger className="h-8 w-auto gap-2 rounded-lg border-border bg-secondary pl-1.5 pr-2.5 text-[12.5px] font-semibold shadow-none">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">{initial}</span>
              <SelectValue placeholder="Organisation" />
            </SelectTrigger>
            <SelectContent>
              <div className="mono-label px-2 py-1.5">Organisations que vous administrez</div>
              {clubs.map((club) => (
                <SelectItem key={club.club_id} value={club.club_id}>
                  <span className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">
                      {club.club_name?.charAt(0).toUpperCase() || "•"}
                    </span>
                    {club.club_name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {isAdmin && !loading && clubs.length === 1 && selectedClub && (
          <span className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-2 py-1 text-[12.5px] font-semibold">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">{initial}</span>
            {selectedClub.club_name}
          </span>
        )}

        {/* Onglets — à gauche, juste après l'org */}
        <nav className="flex items-center gap-0.5 ml-1">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center">
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
