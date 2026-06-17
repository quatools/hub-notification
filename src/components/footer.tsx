import Link from "next/link"

/** Pied de page global : signature + liens légaux (présent sur toutes les pages). */
export function Footer() {
  return (
    <footer className="mt-12 border-t border-[color:var(--qt-sable-300,#DAD4C6)]">
      <div className="container mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground">
        <span className="mono-label">© 2026 Quatools</span>
        <nav className="flex items-center gap-5">
          <Link href="/cgu" className="transition-colors hover:text-foreground">CGU</Link>
          <Link href="/confidentialite" className="transition-colors hover:text-foreground">Confidentialité</Link>
        </nav>
      </div>
    </footer>
  )
}
