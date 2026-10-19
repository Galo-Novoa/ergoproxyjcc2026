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

export function ConfirmDeleteButton({
  title,
  description,
  successMessage,
  redirectTo,
  onConfirm,
  iconOnly = false,
  label = 'Eliminar',
}: {
  title: string
  description: string
  successMessage: string
  redirectTo?: string
  onConfirm: () => Promise<ActionResult>
  iconOnly?: boolean
  label?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
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
      setOpen(false)
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
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
      </AlertDialogTrigger>
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
