import type { Metadata } from "next"

// Espace membre : zone privée, jamais indexée.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PreferencesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
