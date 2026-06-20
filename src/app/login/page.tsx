"use client"

import { useEffect, useState, Suspense, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { safeInternalPath } from "@/lib/safe-next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, SlidersHorizontal, BellOff, Forward, ShieldCheck } from "lucide-react"

type Provider = "discord" | "google" | "github"

/** Seules les destinations internes sont autorisées (anti open-redirect). */
function safeNext(next: string | null): string {
  return safeInternalPath(next)
}

/** Lien de rattachement MEMBRE (et non /api/link-admin, qui garde l'accueil par défaut). */
function isMemberLinkPath(next: string): boolean {
  return next.startsWith("/api/link?") || next === "/api/link"
}

/** Décode (sans vérifier) le jeton de rattachement pour personnaliser l'accueil. */
function decodeLinkInfo(next: string): { isMemberLink: boolean; name?: string } {
  try {
    if (!isMemberLinkPath(next)) return { isMemberLink: false }
    const token = new URL(next, "http://x").searchParams.get("token")
    if (!token) return { isMemberLink: true }
    let b = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")
    while (b.length % 4) b += "="
    const payload = JSON.parse(atob(b))
    return { isMemberLink: true, name: payload?.name || undefined }
  } catch {
    return { isMemberLink: isMemberLinkPath(next) }
  }
}

function DiscordIcon() {
  return (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}
function GoogleIcon() {
  return (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  )
}
function GithubIcon() {
  return (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.56v-2.05c-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.34-1.73-1.34-1.73-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.21 1.84 1.21 1.07 1.79 2.81 1.27 3.5.97.11-.76.42-1.27.76-1.56-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.17-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.21.96-.26 1.98-.39 3-.4 1.02.01 2.04.14 3 .4 2.28-1.53 3.29-1.21 3.29-1.21.66 1.64.24 2.86.12 3.16.77.83 1.24 1.88 1.24 3.17 0 4.53-2.81 5.53-5.49 5.82.43.36.81 1.09.81 2.2v3.26c0 .31.21.68.82.56C20.57 21.88 24 17.49 24 12.29 24 5.78 18.63.5 12 .5z" />
    </svg>
  )
}

function ProviderButtons({
  onLogin,
  loading,
}: {
  onLogin: (p: Provider) => void
  loading: Provider | null
}) {
  return (
    <div className="space-y-2.5">
      <Button
        onClick={() => onLogin("discord")}
        disabled={!!loading}
        size="lg"
        className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white"
      >
        {loading === "discord" ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <DiscordIcon />}
        Continuer avec Discord
      </Button>
      <Button
        onClick={() => onLogin("google")}
        disabled={!!loading}
        size="lg"
        variant="outline"
        className="w-full bg-white hover:bg-secondary/50"
      >
        {loading === "google" ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <GoogleIcon />}
        Continuer avec Google
      </Button>
      <Button
        onClick={() => onLogin("github")}
        disabled={!!loading}
        size="lg"
        className="w-full bg-[#24292e] hover:bg-[#1b1f23] text-white"
      >
        {loading === "github" ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <GithubIcon />}
        Continuer avec GitHub
      </Button>
    </div>
  )
}

/** Mention de consentement affichée sous les boutons de connexion. */
function LegalConsent() {
  return (
    <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
      En continuant, vous acceptez les{" "}
      <Link href="/cgu" className="underline hover:text-foreground">CGU</Link>{" "}et la{" "}
      <Link href="/confidentialite" className="underline hover:text-foreground">Politique de confidentialité</Link>.
    </p>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get("next"))
  const { isMemberLink, name } = useMemo(() => decodeLinkInfo(next), [next])
  const [loading, setLoading] = useState<Provider | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push(next)
    })
  }, [router, next, supabase])

  const handleLogin = async (provider: Provider) => {
    setLoading(provider)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) {
      console.error("Erreur de connexion:", error)
      setLoading(null)
    }
  }

  // --- Accueil MEMBRE (arrivée via un partenaire) : pédagogique, marque blanche ---
  if (isMemberLink) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/notifications-mark.svg" alt="" width={32} height={32} className="h-8 w-8" />
            </div>
            <CardTitle className="font-serif text-2xl font-medium">Vos notifications, votre vie, vos choix.</CardTitle>
            <CardDescription className="text-base">
              {name ? `Bonjour ${name}, votre` : "Votre"} partenaire s&apos;associe à{" "}
              <strong>Quatools Hub</strong> pour vous offrir une transparence totale et la maîtrise de vos
              notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <SlidersHorizontal className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span><strong>Choisissez</strong> les notifications que vous recevez.</span>
              </li>
              <li className="flex items-start gap-3">
                <BellOff className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span><strong>Arrêtez</strong> celles que vous ne voulez plus, quand vous voulez.</span>
              </li>
              <li className="flex items-start gap-3">
                <Forward className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span><strong>Reroutez-les</strong> vers vos propres adresses (email, Discord…).</span>
              </li>
            </ul>

            <ProviderButtons onLogin={handleLogin} loading={loading} />

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Vous restez maître et propriétaire de vos notifications.
            </p>
            <LegalConsent />
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- Accueil par défaut (admin / organisation / développeur) ---
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/notifications-mark.svg" alt="" width={32} height={32} className="h-8 w-8" />
          </div>
          <CardTitle className="font-serif text-2xl font-medium">Quatools Notifications</CardTitle>
          <CardDescription>
            Connectez-vous pour gérer les notifications de votre organisation ou intégrer votre application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProviderButtons onLogin={handleLogin} loading={loading} />
          <LegalConsent />
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
