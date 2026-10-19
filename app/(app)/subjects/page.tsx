import type { Metadata } from 'next'
import { DemoBadge } from '@/components/shared/demo-badge'
import { PageHeader } from '@/components/shared/page-header'
import { SubjectFormDialog } from '@/components/subjects/subject-form-dialog'
import { SubjectImportDialog } from '@/components/subjects/subject-import-dialog'
import { WorkspaceGrid } from '@/components/workspaces/workspace-grid'
import { getDashboardWorkspaces } from '@/lib/data/workspaces'
import { isDatabaseConfigured } from '@/lib/db/config'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Materias' }

export default async function SubjectsPage() {
  const user = await requireUser()
  const { subjects } = await getDashboardWorkspaces(user.id)

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Materias"
        description="Todas tus materias. Buscalas, ordenalas, editá su aspecto o eliminalas."
        badge={isDatabaseConfigured ? undefined : <DemoBadge label="Modo demo: no se guarda" />}
        actions={
          <>
            <SubjectImportDialog />
            <SubjectFormDialog />
          </>
        }
      />
      <WorkspaceGrid subjects={subjects} />
    </div>
  )
}
