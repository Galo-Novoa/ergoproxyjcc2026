'use client'

import { Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { importSubjects } from '@/app/actions/subjects'
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
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

export function SubjectImportDialog({
  variant = 'outline',
}: {
  variant?: 'default' | 'outline'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const text = String(new FormData(event.currentTarget).get('list') ?? '')

    startTransition(async () => {
      const result = await importSubjects(text)
      if (!result.ok) {
        setError(result.error)
        return
      }
      const count = result.data?.count ?? 0
      toast.success(count === 1 ? 'Se importó 1 materia.' : `Se importaron ${count} materias.`)
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
        <Button variant={variant}>
          <Upload data-icon="inline-start" />
          Importar materias
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Importar materias</DialogTitle>
            <DialogDescription>
              Pegá el listado de tu plan de estudios y creamos una materia por línea.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="import-list">Listado</FieldLabel>
            <Textarea
              id="import-list"
              name="list"
              rows={8}
              required
              disabled={pending}
              placeholder={'MAT-201 | Análisis Matemático II\nFIS-101 | Física I\nÁlgebra Lineal'}
            />
            <FieldDescription>
              Una materia por línea. Si querés sumar un código, escribilo antes del nombre
              separado por &quot;|&quot;. Hasta 50 por vez.
            </FieldDescription>
          </Field>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Importar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
