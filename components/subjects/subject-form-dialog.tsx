'use client'

import { Pencil, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createSubject, updateSubject } from '@/app/actions/subjects'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

type Subject = {
  id: string
  name: string
  code: string | null
  description: string | null
}

export function SubjectFormDialog({ subject }: { subject?: Subject }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(subject)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = subject
        ? await updateSubject(subject.id, form)
        : await createSubject(form)
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(isEdit ? 'Materia actualizada.' : 'Materia creada.')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="outline">
            <Pencil data-icon="inline-start" />
            Editar
          </Button>
        ) : (
          <Button>
            <Plus data-icon="inline-start" />
            Nueva materia
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar materia' : 'Nueva materia'}</DialogTitle>
            <DialogDescription>
              Agrupá archivos, conversaciones y documentos por materia.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="subject-name">Nombre</FieldLabel>
              <Input
                id="subject-name"
                name="name"
                defaultValue={subject?.name}
                placeholder="Análisis Matemático II"
                required
                maxLength={120}
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="subject-code">Código (opcional)</FieldLabel>
              <Input
                id="subject-code"
                name="code"
                defaultValue={subject?.code ?? ''}
                placeholder="MAT-201"
                maxLength={20}
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="subject-description">Descripción (opcional)</FieldLabel>
              <Textarea
                id="subject-description"
                name="description"
                defaultValue={subject?.description ?? ''}
                rows={3}
                maxLength={500}
                disabled={pending}
              />
            </Field>
          </FieldGroup>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {isEdit ? 'Guardar cambios' : 'Crear materia'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
