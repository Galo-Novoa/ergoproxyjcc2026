'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createQuestion } from '@/app/actions/questions'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

type Option = { id: string; label: string }

export function QuestionFormDialog({
  subjects,
  questions,
  defaultParentId,
  triggerLabel = 'Nueva duda',
  variant = 'default',
}: {
  subjects: Option[]
  questions: Option[]
  defaultParentId?: string
  triggerLabel?: string
  variant?: 'default' | 'outline' | 'ghost'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subjectId, setSubjectId] = useState('none')
  const [parentId, setParentId] = useState(defaultParentId ?? 'none')
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)
    form.set('subjectId', subjectId)
    form.set('parentId', parentId)

    startTransition(async () => {
      const result = await createQuestion(form)
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success('Duda agregada al mapa.')
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
        <Button variant={variant} size={variant === 'ghost' ? 'sm' : 'default'}>
          <Plus data-icon="inline-start" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Nueva duda</DialogTitle>
            <DialogDescription>
              Anotá lo que todavía no te cierra. Podés colgarla de otra duda para armar el camino.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="question-text">Duda</FieldLabel>
              <Textarea
                id="question-text"
                name="question"
                rows={3}
                required
                maxLength={500}
                disabled={pending}
                placeholder="¿Por qué la serie converge si el término general tiende a 0?"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="question-subject">Materia</FieldLabel>
              <Select value={subjectId} onValueChange={setSubjectId} disabled={pending}>
                <SelectTrigger id="question-subject" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">Sin materia</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {questions.length > 0 ? (
              <Field>
                <FieldLabel htmlFor="question-parent">Depende de</FieldLabel>
                <Select value={parentId} onValueChange={setParentId} disabled={pending}>
                  <SelectTrigger id="question-parent" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">Ninguna (duda raíz)</SelectItem>
                      {questions.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </FieldGroup>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Agregar duda
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
