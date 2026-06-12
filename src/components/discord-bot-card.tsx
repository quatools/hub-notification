"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageCircle, ExternalLink } from "lucide-react"

const DISCORD_APP_ID = process.env.NEXT_PUBLIC_DISCORD_APP_ID

/**
 * Carte "Messages privés Discord" : invitation du bot Notify sur le serveur
 * de l'organisation, prérequis pour les canaux de type MP.
 */
export function DiscordBotCard() {
  if (!DISCORD_APP_ID) return null

  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_APP_ID}&scope=bot&permissions=0`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          Messages privés Discord
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Invitez le bot <span className="font-medium text-foreground">Notify</span> sur le serveur
          Discord de votre organisation pour pouvoir envoyer des notifications en message privé à
          vos membres (canaux de type « MP Discord »). Le bot ne demande aucune permission sur votre
          serveur — sa présence suffit. Vos messages porteront le nom et les couleurs de votre
          organisation.
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Inviter le bot sur mon serveur
          </a>
        </Button>
        <p className="text-xs text-muted-foreground">
          Bon à savoir : un membre peut bloquer les messages privés venant des serveurs dans ses
          paramètres Discord — dans ce cas l&apos;envoi apparaîtra en échec dans l&apos;historique.
        </p>
      </CardContent>
    </Card>
  )
}
