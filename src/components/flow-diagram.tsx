"use client"

import { cn } from "@/lib/utils"
import { Zap, Workflow, Radio, BellRing, ArrowRight, ArrowDown } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type FlowStep = "event" | "workflow" | "channel" | "delivery"

interface StepDef {
  key: FlowStep
  label: string
  icon: typeof Zap
  /** Définition courte, affichée sous le nœud (mode complet) ou en tooltip (mode compact) */
  definition: string
  /** Classe de couleur de l'icône */
  iconColor: string
  /** Classe de fond du chip icône */
  chipBg: string
}

const STEPS: StepDef[] = [
  {
    key: "event",
    label: "Événement",
    icon: Zap,
    definition:
      "Ce qui se passe dans vos applications : nouvel abonnement, paiement, nouveau membre…",
    iconColor: "text-amber-600 dark:text-amber-400",
    chipBg: "bg-amber-500/10",
  },
  {
    key: "workflow",
    label: "Workflow",
    icon: Workflow,
    definition:
      "La règle que vous créez : « quand cet événement arrive, envoyer ce message sur ce canal ».",
    iconColor: "text-violet-600 dark:text-violet-400",
    chipBg: "bg-violet-500/10",
  },
  {
    key: "channel",
    label: "Canal",
    icon: Radio,
    definition:
      "La destination du message : un salon Discord (webhook) ou une adresse email.",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    chipBg: "bg-indigo-500/10",
  },
  {
    key: "delivery",
    label: "Réception",
    icon: BellRing,
    definition:
      "Le message part automatiquement. Chaque envoi est tracé dans l'historique.",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    chipBg: "bg-emerald-500/10",
  },
]

interface FlowDiagramProps {
  /** Étape mise en avant ("Vous êtes ici") */
  highlight?: FlowStep
  /** Mode compact : bandeau fin sous le titre de page */
  compact?: boolean
  className?: string
}

/**
 * Schéma du pipeline de notification : Événement → Workflow → Canal → Réception.
 * Sert de repère pédagogique sur chaque page (l'étape courante est mise en avant).
 */
export function FlowDiagram({ highlight, compact = false, className }: FlowDiagramProps) {
  if (compact) {
    return (
      <TooltipProvider delayDuration={150}>
        <div
          className={cn(
            "flex items-center gap-1.5 overflow-x-auto rounded-lg border bg-muted/40 px-3 py-2",
            className
          )}
        >
          {STEPS.map((step, i) => {
            const isCurrent = step.key === highlight
            return (
              <div key={step.key} className="flex items-center gap-1.5 shrink-0">
                {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs cursor-default transition-colors",
                        isCurrent
                          ? "bg-background border shadow-sm font-semibold text-foreground ring-1 ring-primary/30"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <step.icon className={cn("h-3.5 w-3.5", step.iconColor)} />
                      <span>{step.label}</span>
                      {isCurrent && (
                        <span className="ml-0.5 rounded-sm bg-primary px-1 py-px text-[10px] font-medium leading-none text-primary-foreground">
                          ici
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-60 text-center">
                    {step.definition}
                  </TooltipContent>
                </Tooltip>
              </div>
            )
          })}
        </div>
      </TooltipProvider>
    )
  }

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-2", className)}>
      {STEPS.map((step, i) => {
        const isCurrent = step.key === highlight
        return (
          <div key={step.key} className="flex flex-col gap-3 sm:flex-1 sm:flex-row sm:items-stretch sm:gap-2">
            {i > 0 && (
              <div className="flex items-center justify-center shrink-0">
                <ArrowDown className="h-4 w-4 text-muted-foreground/50 sm:hidden" />
                <ArrowRight className="hidden h-4 w-4 text-muted-foreground/50 sm:block" />
              </div>
            )}
            <div
              className={cn(
                "flex-1 rounded-lg border bg-card p-3 transition-shadow",
                isCurrent && "ring-2 ring-primary/40 shadow-sm"
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={cn("flex h-7 w-7 items-center justify-center rounded-md", step.chipBg)}>
                  <step.icon className={cn("h-4 w-4", step.iconColor)} />
                </div>
                <span className="text-sm font-semibold">{step.label}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{step.definition}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
