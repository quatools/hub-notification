"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Bell, LayoutDashboard, Radio, Workflow, ScrollText } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const orgId = searchParams.get("org_id")
  const orgParam = orgId ? `?org_id=${orgId}` : ""

  const isAdmin = pathname.startsWith("/admin")

  const adminItems = [
    { href: `/admin${orgParam}`, label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: `/admin/channels${orgParam}`, label: "Canaux", icon: Radio },
    { href: `/admin/workflows${orgParam}`, label: "Workflows", icon: Workflow },
    { href: `/admin/logs${orgParam}`, label: "Historique", icon: ScrollText },
  ]

  const navItems = isAdmin ? adminItems : []

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 max-w-5xl flex items-center h-14 gap-6">
        <Link href={`/${orgParam}`} className="flex items-center gap-2 font-semibold">
          <Bell className="h-5 w-5" />
          <span>Quatools Notifications</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = 'exact' in item && item.exact
              ? pathname === "/admin"
              : pathname.startsWith(item.href.split("?")[0])
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
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
