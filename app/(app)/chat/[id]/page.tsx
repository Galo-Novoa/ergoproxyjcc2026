import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChatThread } from '@/components/chat/chat-thread'
import { DemoBadge } from '@/components/shared/demo-badge'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getConversationWithMessages, listChatFiles } from '@/lib/data/queries'
import { getLlmStatus } from '@/lib/llm/config'
import { isConversationMode } from '@/lib/llm/contract'
import { parseRagMetadata } from '@/lib/rag/types'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Conversación' }

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()
  const [data, files] = await Promise.all([
    getConversationWithMessages(user.id, id),
    listChatFiles(user.id),
  ])
  if (!data) notFound()
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
        title={data.conversation.title}
        badge={
          <>
            {data.conversation.subjectName ? (
              <Badge variant="secondary">{data.conversation.subjectName}</Badge>
            ) : null}
            {llm.configured ? null : <DemoBadge />}
          </>
        }
      />
      <ChatThread
        conversationId={id}
        mode={isConversationMode(data.conversation.mode) ? data.conversation.mode : 'free'}
        files={files}
        initialMessages={data.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          rag: parseRagMetadata(m.metadata),
          actions: m.agentActions.map((a) => ({
            id: a.id,
            status: a.status,
            payload: a.payload,
          })),
        }))}
      />
    </div>
  )
}
