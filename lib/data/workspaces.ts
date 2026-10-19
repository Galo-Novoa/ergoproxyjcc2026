import 'server-only'
import type { WorkspaceItem } from '@/components/workspaces/workspace-card'
import { getGeneralSummary, listSubjects } from '@/lib/data/queries'
import { formatRelative } from '@/lib/format'
import { DEFAULT_COLOR, DEFAULT_ICON, GENERAL_WORKSPACE_ID } from '@/lib/workspace'

/** Arma los datos serializables del dashboard: General fijo + materias de la persona. */
export async function getDashboardWorkspaces(userId: string) {
  const [subjects, generalSummary] = await Promise.all([
    listSubjects(userId),
    getGeneralSummary(userId),
  ])
  const now = new Date()

  const general: WorkspaceItem = {
    id: GENERAL_WORKSPACE_ID,
    href: '/general',
    name: 'General',
    code: null,
    description: 'Documentación de la facultad y archivos sin materia asignada.',
    color: DEFAULT_COLOR,
    icon: DEFAULT_ICON,
    fileCount: generalSummary.fileCount,
    activityLabel: generalSummary.lastActivityAt
      ? formatRelative(generalSummary.lastActivityAt, now)
      : null,
    activityTs: generalSummary.lastActivityAt?.getTime() ?? null,
    isGeneral: true,
  }

  const items: WorkspaceItem[] = subjects.map((s) => ({
    id: s.id,
    href: `/subjects/${s.id}`,
    name: s.name,
    code: s.code,
    description: s.description,
    color: s.color,
    icon: s.icon,
    fileCount: s.fileCount,
    activityLabel: formatRelative(s.lastActivityAt, now),
    activityTs: s.lastActivityAt.getTime(),
    isGeneral: false,
  }))

  return { general, subjects: items }
}
