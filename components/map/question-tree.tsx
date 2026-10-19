'use client'

import { CircleCheck, CircleDashed, Undo2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { deleteQuestion, setQuestionStatus } from '@/app/actions/questions'
import { QuestionFormDialog } from '@/components/map/question-form-dialog'
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type QuestionItem = {
  id: string
  question: string
  status: string
  parentId: string | null
  subjectName: string | null
}

type Option = { id: string; label: string }

function StatusButton({ id, resolved }: { id: string; resolved: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      const result = await setQuestionStatus(id, resolved ? 'open' : 'resolved')
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} disabled={pending}>
      {resolved ? <Undo2 data-icon="inline-start" /> : <CircleCheck data-icon="inline-start" />}
      {resolved ? 'Reabrir' : 'Resolver'}
    </Button>
  )
}

function Node({
  item,
  all,
  subjects,
  options,
  depth,
}: {
  item: QuestionItem
  all: QuestionItem[]
  subjects: Option[]
  options: Option[]
  depth: number
}) {
  const children = all.filter((q) => q.parentId === item.id)
  const resolved = item.status === 'resolved'

  async function remove() {
    return deleteQuestion(item.id)
  }

  return (
    <li className="flex flex-col gap-2">
      <div
        className={cn(
          'flex flex-col gap-3 rounded-xl border bg-card p-4',
          resolved && 'bg-muted/50',
        )}
      >
        <div className="flex items-start gap-3">
          {resolved ? (
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <CircleDashed className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className={cn('text-pretty', resolved && 'text-muted-foreground line-through')}>
              {item.question}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={resolved ? 'secondary' : 'outline'}>
                {resolved ? 'Resuelta' : 'Abierta'}
              </Badge>
              {item.subjectName ? <Badge variant="secondary">{item.subjectName}</Badge> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 pl-8">
          <StatusButton id={item.id} resolved={resolved} />
          <QuestionFormDialog
            subjects={subjects}
            questions={options}
            defaultParentId={item.id}
            triggerLabel="Sub-duda"
            variant="ghost"
          />
          <ConfirmDeleteButton
            iconOnly
            label="Eliminar duda"
            title="¿Eliminar esta duda?"
            description="Sus sub-dudas se conservan y pasan a ser dudas raíz."
            successMessage="Duda eliminada."
            onConfirm={remove}
          />
        </div>
      </div>
      {children.length > 0 && depth < 8 ? (
        <ul className="ml-4 flex flex-col gap-2 border-l-2 border-border pl-4 md:ml-6 md:pl-6">
          {children.map((child) => (
            <Node
              key={child.id}
              item={child}
              all={all}
              subjects={subjects}
              options={options}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function QuestionTree({
  items,
  subjects,
}: {
  items: QuestionItem[]
  subjects: Option[]
}) {
  const ids = new Set(items.map((i) => i.id))
  const roots = items.filter((i) => !i.parentId || !ids.has(i.parentId))
  const options = items.map((i) => ({
    id: i.id,
    label: i.question.length > 60 ? `${i.question.slice(0, 60)}…` : i.question,
  }))

  return (
    <ul className="flex flex-col gap-3">
      {roots.map((item) => (
        <Node
          key={item.id}
          item={item}
          all={items}
          subjects={subjects}
          options={options}
          depth={0}
        />
      ))}
    </ul>
  )
}
