import type { ReactNode } from "react"
import { FlowDiagram, type FlowStep } from "@/components/flow-diagram"

interface PageHeaderProps {
  title: string
  /** Phrase d'explication : à quoi sert cette page, sur quoi agit-on */
  description: string
  /** Étape du pipeline concernée par la page — affiche le fil d'Ariane visuel */
  flowStep?: FlowStep
  /** Actions à droite du titre (boutons, filtres…) */
  actions?: ReactNode
}

export function PageHeader({ title, description, flowStep, actions }: PageHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {flowStep && <FlowDiagram compact highlight={flowStep} />}
    </div>
  )
}
