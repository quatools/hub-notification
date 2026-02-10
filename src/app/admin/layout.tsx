"use client"

import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  )
}
