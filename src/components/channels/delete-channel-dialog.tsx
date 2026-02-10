"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { NotificationChannel } from "@/lib/types/notifications"

interface DeleteChannelDialogProps {
  channel: NotificationChannel | null
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteChannelDialog({
  channel,
  onConfirm,
  onCancel,
}: DeleteChannelDialogProps) {
  return (
    <AlertDialog open={!!channel} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce canal ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le canal &quot;{channel?.label || channel?.type}&quot; sera supprimé.
            Les préférences de notification associées seront aussi supprimées.
            Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
