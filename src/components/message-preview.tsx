"use client"

import { renderTemplate } from "@/lib/notifications/templates"
import { Bell } from "lucide-react"

/** Couleurs d'embed Discord par catégorie (miroir du dispatcher) */
const CATEGORY_COLORS: Record<string, string> = {
  billing: "#3498db",
  member: "#2ecc71",
  team: "#e67e22",
  shop: "#9b59b6",
  system: "#95a5a6",
}

/** Rendu markdown minimal façon Discord : gras, italique, code, retours à la ligne. */
function renderDiscordMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code style="background:#1e1f22;padding:1px 4px;border-radius:3px;font-size:0.85em">$1</code>')
    .replace(/\n/g, "<br/>")
}

interface MessagePreviewProps {
  channelType: string | null
  format: string
  subject: string
  body: string
  /** Valeurs de test pour remplacer les {{variables}} */
  values: Record<string, string>
  eventLabel: string
  eventCategory: string
  /** Nom d'expéditeur marque blanche de l'org */
  senderName: string | null
  /** Adresse From affichée dans l'aperçu email */
  fromEmail: string
}

/**
 * Aperçu en temps réel du message tel que le destinataire le verra :
 * embed Discord ou email selon le canal.
 */
export function MessagePreview({
  channelType,
  format,
  subject,
  body,
  values,
  eventLabel,
  eventCategory,
  senderName,
  fromEmail,
}: MessagePreviewProps) {
  const displayName = senderName || "Quatools Notifications"
  const renderedBody = body ? renderTemplate(body, values) : ""
  const renderedSubject = subject ? renderTemplate(subject, values) : eventLabel

  if (!channelType) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Choisissez un canal pour voir l&apos;aperçu
      </div>
    )
  }

  if (channelType === "discord_webhook") {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Aperçu — ce que verra le destinataire sur Discord
        </p>
        <div className="rounded-lg p-4" style={{ background: "#313338" }}>
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "#5865F2" }}>
              <Bell className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-white">{displayName}</span>
                <span className="rounded px-1 py-px text-[10px] font-semibold leading-tight text-white" style={{ background: "#5865F2" }}>
                  APP
                </span>
                <span className="text-xs" style={{ color: "#949ba4" }}>aujourd&apos;hui</span>
              </div>
              <div
                className="mt-1 max-w-md rounded p-3"
                style={{
                  background: "#2b2d31",
                  borderLeft: `4px solid ${CATEGORY_COLORS[eventCategory] || CATEGORY_COLORS.system}`,
                }}
              >
                <p className="text-sm font-semibold text-white">{eventLabel}</p>
                <div
                  className="mt-1 text-sm break-words"
                  style={{ color: "#dbdee1" }}
                  dangerouslySetInnerHTML={{
                    __html: renderedBody
                      ? renderDiscordMarkdown(renderedBody)
                      : '<span style="opacity:0.5">Votre message apparaîtra ici…</span>',
                  }}
                />
                <p className="mt-2 text-[11px]" style={{ color: "#949ba4" }}>{displayName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Email
  const isFullDocument = /<!DOCTYPE|<html[\s>]/i.test(renderedBody)

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Aperçu — ce que verra le destinataire dans sa boîte mail
      </p>
      <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
        <div className="space-y-1 border-b bg-muted/40 px-4 py-3 text-xs">
          <p>
            <span className="text-muted-foreground">De : </span>
            <span className="font-medium">{displayName}</span>{" "}
            <span className="text-muted-foreground">&lt;{fromEmail}&gt;</span>
          </p>
          <p>
            <span className="text-muted-foreground">Objet : </span>
            <span className="font-semibold">{renderedSubject || "—"}</span>
          </p>
        </div>
        {isFullDocument ? (
          // Document HTML complet : rendu isolé tel quel, sans habillage
          <iframe
            title="Aperçu email"
            sandbox=""
            srcDoc={renderedBody}
            className="h-96 w-full border-0 bg-white"
          />
        ) : (
          <div className="px-4 py-4">
            {renderedBody ? (
              format === "html" ? (
                <div
                  className="text-sm [&_h1]:text-lg [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:my-2 [&_p]:my-1.5 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: renderedBody }}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm">{renderedBody}</p>
              )
            ) : (
              <p className="text-sm text-muted-foreground/60">Votre message apparaîtra ici…</p>
            )}
            <div className="mt-4 border-t pt-2">
              <p className="text-[11px] text-muted-foreground">
                Envoyé par {displayName} · habillage automatique appliqué à l&apos;envoi
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
