"use client"

import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

function PreferencesLayoutContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export default function PreferencesLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <PreferencesLayoutContent>{children}</PreferencesLayoutContent>
    </Suspense>
  )
}
