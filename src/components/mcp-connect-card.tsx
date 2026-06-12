"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Bot, Copy, Check } from "lucide-react"

/**
 * Carte "Pilotage par IA" : URL MCP de l'organisation + instructions
 * de connexion depuis claude.ai.
 */
export function McpConnectCard({ orgId }: { orgId: string }) {
  const [copied, setCopied] = useState(false)
  const [mcpUrl, setMcpUrl] = useState("")

  // L'URL dépend de l'origine courante (dev/prod) — résolue côté client
  useEffect(() => {
    setMcpUrl(`${window.location.origin}/api/mcp/${orgId}`)
  }, [orgId])

  const handleCopy = () => {
    navigator.clipboard.writeText(mcpUrl)
    setCopied(true)
    toast.success("URL copiée")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          Pilotage par IA (MCP)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Connectez Claude à votre espace de notifications : il pourra lister vos
          événements, créer vos canaux et workflows, rédiger les messages (y compris
          le HTML des emails) et envoyer des tests — en parlant simplement avec lui.
        </p>

        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            URL de votre connecteur
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 text-xs">
              {mcpUrl || "…"}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!mcpUrl}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              Copier
            </Button>
          </div>
        </div>

        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Sur <span className="font-medium text-foreground">claude.ai</span> :
            Paramètres → <span className="font-medium text-foreground">Connecteurs</span> →
            « Ajouter un connecteur personnalisé »
          </li>
          <li>Collez l&apos;URL ci-dessus et validez</li>
          <li>
            Connectez-vous avec votre compte Discord — seuls les administrateurs de
            l&apos;organisation peuvent se connecter
          </li>
          <li>
            Dans une conversation, demandez par exemple :{" "}
            <em>« Configure une notification Discord pour chaque nouvelle commande de prévente »</em>
          </li>
        </ol>
      </CardContent>
    </Card>
  )
}
