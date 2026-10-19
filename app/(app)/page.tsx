import type { Metadata } from 'next'
import { DemoBadge } from '@/components/shared/demo-badge'
import { PageHeader } from '@/components/shared/page-header'
import { SubjectFormDialog } from '@/components/subjects/subject-form-dialog'
import { SubjectImportDialog } from '@/components/subjects/subject-import-dialog'
import { WorkspaceGrid } from '@/components/workspaces/workspace-grid'
import { getDashboardWorkspaces } from '@/lib/data/workspaces'
import { isDatabaseConfigured } from '@/lib/db/config'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const user = await requireUser()
  const { general, subjects } = await getDashboardWorkspaces(user.id)
  const firstName = user.name.split(/\s+/)[0]

  return (
    <div className="flex flex-col">
      <PageHeader
        title={`Hola, ${firstName}`}
        description="Tus espacios de trabajo. Entrá a una materia para ver sus archivos, conversaciones y documentos."
        badge={isDatabaseConfigured ? undefined : <DemoBadge label="Modo demo: no se guarda" />}
        actions={
          <>
            <SubjectImportDialog />
            <SubjectFormDialog />
          </>
        }
      />
      <WorkspaceGrid general={general} subjects={subjects} />
    </div>
  )
}
