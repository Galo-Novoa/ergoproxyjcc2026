'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { ActionResult } from '@/lib/types'

type ConfirmProps = {
  title: string
  description: string
  successMessage: string
  redirectTo?: string
  onConfirm: () => Promise<ActionResult>
}

/** Diálogo de confirmación controlado: se puede abrir desde un menú sin trigger propio. */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  successMessage,
  redirectTo,
  onConfirm,
  children,
}: ConfirmProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  children?: React.ReactNode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleConfirm(event: React.MouseEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await onConfirm()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(successMessage)
      onOpenChange(false)
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {children ? <AlertDialogTrigger asChild>{children}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ConfirmDeleteButton({
  iconOnly = false,
  label = 'Eliminar',
  ...props
}: ConfirmProps & { iconOnly?: boolean; label?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <ConfirmDeleteDialog open={open} onOpenChange={setOpen} {...props}>
      {iconOnly ? (
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <Trash2 />
        </Button>
      ) : (
        <Button variant="outline">
          <Trash2 data-icon="inline-start" />
          {label}
        </Button>
      )}
    </ConfirmDeleteDialog>
  )
}
