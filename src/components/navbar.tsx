"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useClub } from "@/lib/contexts/club-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bell, LayoutDashboard, Radio, Workflow, ScrollText, BellOff, Mail } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()
  const { clubs, selectedClub, selectClub, loading } = useClub()

  const isAdmin = pathname.startsWith("/admin")
  const isUser = pathname.startsWith("/preferences")

  const adminItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/channels", label: "Canaux", icon: Radio },
    { href: "/admin/workflows", label: "Workflows", icon: Workflow },
    { href: "/admin/logs", label: "Historique", icon: ScrollText },
  ]

  const userItems = [
    { href: "/preferences", label: "Mes notifications", icon: BellOff, exact: true },
    { href: "/preferences/channels", label: "Mes canaux", icon: Mail },
  ]

  const navItems = isAdmin ? adminItems : isUser ? userItems : []

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 max-w-5xl flex items-center h-14 gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Bell className="h-5 w-5" />
          <span className="hidden sm:inline">Quatools Notifications</span>
        </Link>

        {/* Club selector */}
        {!loading && clubs.length > 1 && (
          <Select value={selectedClub?.club_id || ""} onValueChange={selectClub}>
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue placeholder="Choisir un club" />
            </SelectTrigger>
            <SelectContent>
              {clubs.map((club) => (
                <SelectItem key={club.club_id} value={club.club_id}>
                  {club.club_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {!loading && clubs.length === 1 && selectedClub && (
          <span className="text-sm text-muted-foreground border rounded-md px-2 py-1">
            {selectedClub.club_name}
          </span>
        )}

        <nav className="flex items-center gap-1 ml-auto">
          {navItems.map((item) => {
            const isActive = 'exact' in item && item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
