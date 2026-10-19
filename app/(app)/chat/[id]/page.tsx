import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChatThread } from '@/components/chat/chat-thread'
import { DemoBadge } from '@/components/shared/demo-badge'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getConversationHeader, isUuid, listChatFiles } from '@/lib/data/queries'
import { getLlmStatus } from '@/lib/llm/config'
import { isConversationMode } from '@/lib/llm/contract'
import { parseRagMetadata } from '@/lib/rag/types'
import { requireUser } from '@/lib/session'
import { ensureRootNode, listMapNodes, loadBranch, loadTree, pickNodeId } from '@/lib/tree/branch'

export const metadata: Metadata = { title: 'Conversación' }

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()
  if (!isUuid(id)) notFound()
  const [conversation, files] = await Promise.all([
    getConversationHeader(user.id, id),
    listChatFiles(user.id),
  ])
  if (!conversation) notFound()

  const rootId = await ensureRootNode(id, user.id)
  const tree = await loadTree(id, user.id)
  const nodeId = pickNodeId(tree, rootId, null, conversation.activeNodeId)
  const [branch, mapNodes] = await Promise.all([
    loadBranch(id, user.id, nodeId, tree),
    listMapNodes(id, user.id),
  ])
  const llm = getLlmStatus()

  return (
    <div className="flex flex-col gap-2">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/chat">
          <ArrowLeft data-icon="inline-start" />
          Conversaciones
        </Link>
      </Button>
      <PageHeader
        title={conversation.title}
        badge={
          <>
            {conversation.subjectName ? (
              <Badge variant="secondary">{conversation.subjectName}</Badge>
            ) : null}
            {llm.configured ? null : <DemoBadge />}
          </>
        }
      />
      <ChatThread
        key={nodeId}
        conversationId={id}
        nodeId={nodeId}
        path={branch.path.map((n) => ({ id: n.id, alias: n.alias }))}
        mapNodes={mapNodes}
        mode={isConversationMode(conversation.mode) ? conversation.mode : 'free'}
        files={files}
        initialMessages={branch.visible.map(({ message: m, inherited }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          inherited,
          rag: parseRagMetadata(m.metadata),
          actions: m.agentActions.map((a) => ({
            id: a.id,
            status: a.status,
            payload: a.payload,
            resultNodeId: a.resultNodeId,
          })),
        }))}
      />
    </div>
  )
}
