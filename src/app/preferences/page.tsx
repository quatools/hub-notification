"use client"

import { useSearchParams } from "next/navigation"
import { PreferencesView } from "@/components/preferences/preferences-view"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

function PreferencesContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get("org_id")

  return <PreferencesView orgId={orgId} />
}

export default function PreferencesPage() {
  return (
    <div>
      <Suspense fallback={<PreferencesLoading />}>
        <PreferencesContent />
      </Suspense>
    </div>
  )
}

function PreferencesLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
