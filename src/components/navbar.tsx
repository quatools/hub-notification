"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Bell, Radio, Settings } from "lucide-react"

const navItems = [
  { href: "/channels", label: "Mes canaux", icon: Radio },
  { href: "/preferences", label: "Préférences", icon: Settings },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 max-w-5xl flex items-center h-14 gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Bell className="h-5 w-5" />
          <span>Quatools Notifications</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                pathname === item.href
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
