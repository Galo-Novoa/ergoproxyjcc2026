'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createDocument } from '@/app/actions/documents'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
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

export function DocumentForm({
  subjects,
}: {
  subjects: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [subjectId, setSubjectId] = useState('none')
  const [kind, setKind] = useState('note')
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)
    form.set('subjectId', subjectId)
    form.set('kind', kind)

    startTransition(async () => {
      const result = await createDocument(form)
      if (!result.ok || !result.data) {
        setError(result.ok ? 'No pudimos guardar el documento.' : result.error)
        return
      }
      toast.success('Documento guardado.')
      router.push(`/documents/${result.data.id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="doc-title">Título</FieldLabel>
          <Input
            id="doc-title"
            name="title"
            required
            maxLength={160}
            disabled={pending}
            placeholder="Resumen: integrales dobles"
          />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="doc-kind">Tipo</FieldLabel>
            <Select value={kind} onValueChange={setKind} disabled={pending}>
              <SelectTrigger id="doc-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="note">Nota</SelectItem>
                  <SelectItem value="summary">Resumen</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="doc-subject">Materia</FieldLabel>
            <Select value={subjectId} onValueChange={setSubjectId} disabled={pending}>
              <SelectTrigger id="doc-subject" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="none">Sin materia</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="doc-content">Contenido</FieldLabel>
          <Textarea
            id="doc-content"
            name="contentMd"
            rows={14}
            maxLength={50000}
            disabled={pending}
            className="font-mono text-sm"
            placeholder="Escribí en Markdown…"
          />
        </Field>
      </FieldGroup>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Guardar documento
        </Button>
      </div>
    </form>
  )
}
