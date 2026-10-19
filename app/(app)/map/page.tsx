import { Network } from 'lucide-react'
import type { Metadata } from 'next'
import { QuestionFormDialog } from '@/components/map/question-form-dialog'
import { QuestionTree } from '@/components/map/question-tree'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { listQuestionNodes, listSubjectOptions } from '@/lib/data/queries'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Mapa de dudas' }

export default async function MapPage() {
  const user = await requireUser()
  const [nodes, subjects] = await Promise.all([
    listQuestionNodes(user.id),
    listSubjectOptions(user.id),
  ])

  const subjectNames = new Map(subjects.map((s) => [s.id, s.name]))
  const items = nodes.map((n) => ({
    id: n.id,
    question: n.question,
    status: n.status,
    parentId: n.parentId,
    subjectName: n.subjectId ? (subjectNames.get(n.subjectId) ?? null) : null,
  }))
  const subjectOptions = subjects.map((s) => ({ id: s.id, label: s.name }))
  const open = items.filter((i) => i.status !== 'resolved').length

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Mapa de dudas"
        description={
          items.length === 0
            ? 'Anotá lo que no te cierra y ordenalo por dependencias.'
            : `${open} abiertas de ${items.length}. Resolvé las de base primero para destrabar el resto.`
        }
        actions={<QuestionFormDialog subjects={subjectOptions} questions={[]} />}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Network}
          title="Tu mapa está vacío"
          description="Agregá una duda. Después podés colgarle sub-dudas para ver qué conceptos necesitás primero."
        >
          <QuestionFormDialog subjects={subjectOptions} questions={[]} />
        </EmptyState>
      ) : (
        <QuestionTree items={items} subjects={subjectOptions} />
      )}
    </div>
  )
}
