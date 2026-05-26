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

/**
 * Lightweight wrapper around shadcn AlertDialog for action confirmations.
 * Used by the blog editor for the publish + delete buttons so users get a
 * second-chance prompt before something destructive or irreversible
 * (Vercel deploy, draft loss) kicks off.
 *
 * Controlled component: parent owns the open state so it can also drive
 * the same dialog from multiple buttons / keyboard shortcuts in the
 * future without duplicating markup.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "キャンセル",
  onConfirm,
  variant = "default",
  disabled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  variant?: "default" | "destructive"
  disabled?: boolean
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={disabled}
            onClick={(e) => {
              // Hold the dialog open until the action resolves so the user
              // gets a busy state instead of a flash-close-then-error.
              e.preventDefault()
              void Promise.resolve(onConfirm()).finally(() => {
                onOpenChange(false)
              })
            }}
            className={
              variant === "destructive"
                ? "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600/50"
                : undefined
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
