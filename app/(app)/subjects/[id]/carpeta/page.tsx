import type { Metadata } from 'next'
import {
  FolderGraph,
  type FolderEdgeView,
  type FolderNodeView,
} from '@/components/nodo/folder-graph'
import { getFolderGraph } from '@/lib/data/queries'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Carpeta' }

export default async function SubjectFolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const { nodes, edges } = await getFolderGraph(user.id, id)

  const nodeViews: FolderNodeView[] = nodes.map((node) => ({
    id: node.id,
    title: node.title,
    type: node.type,
    contentMd: node.contentMd,
    posX: node.posX,
    posY: node.posY,
    origin: node.origin,
    updatedAt: node.updatedAt.toISOString(),
    // De dónde salió el apunte, en una línea legible por referencia.
    references: node.references.map((reference) => ({
      id: reference.id,
      label: reference.questionNode
        ? `Duda: ${reference.questionNode.question}`
        : reference.conversation
          ? `Sesión: ${reference.conversation.title}`
          : 'Referencia sin origen',
    })),
  }))

  const edgeViews: FolderEdgeView[] = edges.map((edge) => ({
    id: edge.id,
    fromId: edge.fromId,
    toId: edge.toId,
    kind: edge.kind,
  }))

  return <FolderGraph subjectId={id} nodes={nodeViews} edges={edgeViews} />
}
