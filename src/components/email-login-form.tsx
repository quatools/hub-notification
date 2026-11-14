"use client"

import { useState } from "react"
import type { AuthError } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { safeInternalPath } from "@/lib/safe-next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Mode = "code" | "password"

/**
 * Le hub partage l'Auth Supabase des plateformes : il ne crée JAMAIS de compte
 * (shouldCreateUser: false). Supabase répond alors « Signups not allowed for otp ».
 */
function isUnknownAccountError(error: AuthError): boolean {
  return (
    error.code === "otp_disabled" ||
    /signups? not allowed/i.test(error.message || "")
  )
}

/** URL de retour du lien magique : même callback que l'OAuth, `next` conservé. */
function callbackUrl(next: string): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
}

/**
 * Connexion par email (code / lien magique, ou mot de passe) — connexion seule,
 * aucune création de compte. `next` est re-validé (anti open-redirect).
 */
export function EmailLoginForm({ next = "/admin" }: { next?: string }) {
  const target = safeInternalPath(next)
  const [mode, setMode] = useState<Mode>("code")
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Navigation complète : la cible peut être une route API (reprise OAuth MCP)
  // et les composants serveur doivent relire les cookies de session.
  const goToTarget = () => window.location.assign(target)

  const switchMode = (m: Mode) => {
    setMode(m)
    setStep("email")
    setCode("")
    setError(null)
    setInfo(null)
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl(target), shouldCreateUser: false },
    })
    setLoading(false)
    if (error) {
      console.error("Erreur envoi email:", error)
      setError(
        isUnknownAccountError(error)
          ? "Aucun compte trouvé pour cet email. Créez d'abord votre compte sur votre plateforme."
          : error.status === 429
            ? "Trop de demandes, réessayez dans quelques minutes."
            : "Impossible d'envoyer l'email. Vérifiez l'adresse et réessayez."
      )
      return
    }
    setStep("code")
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await createClient().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    })
    if (error) {
      console.error("Erreur vérification code:", error)
      setError("Code invalide ou expiré.")
      setLoading(false)
      return
    }
    goToTarget()
  }

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    const { error } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      console.error("Erreur connexion mot de passe:", error)
      setError(
        error.code === "email_not_confirmed"
          ? "Adresse email pas encore confirmée : utilisez plutôt l'onglet « Code / lien magique »."
          : "Email ou mot de passe incorrect."
      )
      setLoading(false)
      return
    }
    goToTarget()
  }

  const emailInput = (
    <Input
      type="email"
      required
      autoComplete="email"
      placeholder="vous@exemple.fr"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      disabled={loading}
      aria-label="Adresse email"
    />
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        ou par email
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-sm" role="tablist">
        {([["code", "Code / lien magique"], ["password", "Mot de passe"]] as const).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`rounded px-2 py-1.5 transition-colors ${mode === m ? "bg-background shadow font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "password" ? (
        <form onSubmit={handlePassword} className="space-y-3">
          {emailInput}
          <Input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            aria-label="Mot de passe"
          />
          <Button type="submit" size="lg" variant="secondary" className="w-full" disabled={loading || !email || !password}>
            {loading ? "Patientez…" : "Se connecter"}
          </Button>
          <div className="text-right text-xs text-muted-foreground">
            <button
              type="button"
              className="underline"
              onClick={() => {
                setError(null)
                setInfo("Mot de passe oublié ? Connectez-vous avec l'onglet « Code / lien magique » : un code vous sera envoyé par email.")
              }}
            >
              Mot de passe oublié ?
            </button>
          </div>
        </form>
      ) : step === "email" ? (
        <form onSubmit={handleSendCode} className="space-y-3">
          {emailInput}
          <Button type="submit" size="lg" variant="secondary" className="w-full" disabled={loading || !email}>
            {loading ? "Envoi en cours…" : "Recevoir un code de connexion"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-3">
          <p className="text-sm text-center text-muted-foreground">
            Un email vient d&apos;être envoyé à <strong>{email}</strong>. Saisissez ci-dessous le code
            reçu (recommandé).
          </p>
          <p className="text-xs text-center text-muted-foreground">
            Le lien de l&apos;email fonctionne aussi, mais uniquement s&apos;il est ouvert dans ce même
            navigateur. Sur un autre appareil, utilisez le code.
          </p>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            placeholder="Code à 6 chiffres"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={loading}
            aria-label="Code de connexion"
            className="text-center tracking-[0.5em] text-lg"
          />
          <Button type="submit" size="lg" variant="secondary" className="w-full" disabled={loading || code.length < 6}>
            {loading ? "Vérification…" : "Se connecter"}
          </Button>
          <button
            type="button"
            className="w-full text-xs text-muted-foreground underline"
            onClick={() => { setStep("email"); setCode(""); setError(null) }}
          >
            Changer d&apos;adresse ou renvoyer un code
          </button>
        </form>
      )}

      {error && <p className="text-sm text-center text-destructive" role="alert">{error}</p>}
      {info && <p className="text-sm text-center text-muted-foreground" role="status">{info}</p>}
    </div>
  )
}
