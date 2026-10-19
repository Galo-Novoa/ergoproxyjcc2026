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
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  DEFAULT_COLOR,
  DEFAULT_ICON,
  getWorkspaceColor,
  getWorkspaceIcon,
  WORKSPACE_COLORS,
  WORKSPACE_ICONS,
} from '@/lib/workspace'

type Subject = {
  id: string
  name: string
  code: string | null
  description: string | null
  color: string
  icon: string
}

/** Diálogo controlado: sirve para abrirlo desde un menú o desde su propio botón. */
export function SubjectDialog({
  open,
  onOpenChange,
  subject,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subject?: Subject
  children?: React.ReactNode
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [color, setColor] = useState<string>(subject?.color ?? DEFAULT_COLOR)
  const [icon, setIcon] = useState<string>(subject?.icon ?? DEFAULT_ICON)
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(subject)

  const PreviewIcon = getWorkspaceIcon(icon)
  const previewColor = getWorkspaceColor(color)

  function handleOpenChange(next: boolean) {
    if (next) {
      setColor(subject?.color ?? DEFAULT_COLOR)
      setIcon(subject?.icon ?? DEFAULT_ICON)
    }
    setError(null)
    onOpenChange(next)
  }

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
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar materia' : 'Nueva materia'}</DialogTitle>
            <DialogDescription>
              Elegí cómo se ve en tu dashboard. Podés cambiarlo cuando quieras.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <div className="flex items-end gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-lg text-primary-foreground',
                  previewColor.tile,
                )}
              >
                <PreviewIcon className="size-5" />
              </span>
              <Field className="flex-1">
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
            </div>

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

            <FieldSet>
              <FieldLegend variant="label">Color</FieldLegend>
              <div className="flex flex-wrap gap-3">
                {WORKSPACE_COLORS.map((option) => (
                  <label key={option.key} className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="color"
                      value={option.key}
                      checked={color === option.key}
                      onChange={() => setColor(option.key)}
                      disabled={pending}
                      className="peer sr-only"
                    />
                    <span className="sr-only">{option.label}</span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'block size-8 rounded-full ring-offset-2 ring-offset-background transition-shadow',
                        'peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                        option.swatch,
                      )}
                    />
                  </label>
                ))}
              </div>
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label">Icono</FieldLegend>
              <div className="flex flex-wrap gap-2">
                {WORKSPACE_ICONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <label key={option.key} className="relative cursor-pointer">
                      <input
                        type="radio"
                        name="icon"
                        value={option.key}
                        checked={icon === option.key}
                        onChange={() => setIcon(option.key)}
                        disabled={pending}
                        className="peer sr-only"
                      />
                      <span className="sr-only">{option.label}</span>
                      <span
                        aria-hidden="true"
                        title={option.label}
                        className={cn(
                          'flex size-9 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:bg-muted',
                          'peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground',
                          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                    </label>
                  )
                })}
              </div>
            </FieldSet>

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

/** Botón + diálogo, para usar directamente en cabeceras y estados vacíos. */
export function SubjectFormDialog({
  subject,
  variant,
}: {
  subject?: Subject
  variant?: 'default' | 'outline'
}) {
  const [open, setOpen] = useState(false)

  return (
    <SubjectDialog open={open} onOpenChange={setOpen} subject={subject}>
      {subject ? (
        <Button variant="outline">
          <Pencil data-icon="inline-start" />
          Editar
        </Button>
      ) : (
        <Button variant={variant ?? 'default'}>
          <Plus data-icon="inline-start" />
          Nueva materia
        </Button>
      )}
    </SubjectDialog>
  )
}
