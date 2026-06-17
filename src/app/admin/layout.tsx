import type { Metadata } from "next"

// Espace d'administration : zone privée, jamais indexée.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
