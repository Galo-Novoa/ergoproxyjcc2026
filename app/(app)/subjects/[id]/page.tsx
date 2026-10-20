import type { Metadata } from 'next'
import {
  ChatView,
  type ChatMessage,
  type ProposedAction,
  type Session,
} from '@/components/nodo/chat-view'
import type { HistoryNode } from '@/components/nodo/history-overlay'
import {
  getConversationWithMessages,
  getFolderGraph,
  listConversations,
  listQuestionNodes,
} from '@/lib/data/queries'
import {
  agentActionSchema,
  FOLDER_EDGE_LABELS,
  FOLDER_NODE_LABELS,
  FOLDER_OPERATION_LABELS,
  type FolderEdgeKind,
  type FolderNodeType,
} from '@/lib/llm/contract'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Chat' }

export default async function SubjectChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sesion?: string }>
}) {
  const { id } = await params
  const { sesion } = await searchParams
  const user = await requireUser()

  const [conversations, nodes, folder] = await Promise.all([
    listConversations(user.id, id),
    listQuestionNodes(user.id, id),
    getFolderGraph(user.id, id),
  ])

  // Sin sesión en la URL se abre la más reciente, que es la primera de la lista.
  const activeId = sesion ?? conversations[0]?.id ?? null
  const active = activeId ? await getConversationWithMessages(user.id, activeId) : undefined

  const sessions: Session[] = conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    messageCount: conversation.messageCount,
  }))

  // Títulos de la Carpeta, para que la vista previa nombre los apuntes en lugar de ids.
  const folderTitles = new Map(folder.nodes.map((node) => [node.id, node.title]))

  const messages: ChatMessage[] = (active?.messages ?? []).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    // Solo se ofrecen las propuestas que siguen pendientes de decisión.
    actions: message.agentActions.flatMap<ProposedAction>((action) => {
      if (action.status !== 'proposed') return []
      const parsed = agentActionSchema.safeParse(action.payload)
      if (!parsed.success) return []

      if (parsed.data.type === 'propose_history_branch') {
        return [
          {
            id: action.id,
            kind: 'history',
            title: parsed.data.title,
            description: parsed.data.description,
          },
        ]
      }

      const proposal = parsed.data
      return [
        {
          id: action.id,
          kind: 'folder',
          operationLabel: FOLDER_OPERATION_LABELS[proposal.operation],
          reason: proposal.reason,
          title: proposal.title,
          contentMd: proposal.content_md,
          solutionMd: proposal.solution_md,
          targetTitle: proposal.target_node_id
            ? (folderTitles.get(proposal.target_node_id) ?? null)
            : null,
          relatedTitle: proposal.related_node_id
            ? (folderTitles.get(proposal.related_node_id) ?? null)
            : null,
          nodeTypeLabel: proposal.node_type
            ? FOLDER_NODE_LABELS[proposal.node_type as FolderNodeType]
            : null,
          edgeLabel: proposal.edge_kind
            ? FOLDER_EDGE_LABELS[proposal.edge_kind as FolderEdgeKind]
            : null,
        },
      ]
    }),
  }))

  const historyNodes: HistoryNode[] = nodes.map((node) => ({
    id: node.id,
    question: node.question,
    answerSummary: node.answerSummary,
    parentId: node.parentId,
    posX: node.posX,
    posY: node.posY,
    status: node.status,
  }))

  return (
    <ChatView
      subjectId={id}
      sessions={sessions}
      activeId={active ? activeId : (conversations[0]?.id ?? null)}
      messages={messages}
      nodes={historyNodes}
    />
  )
}
