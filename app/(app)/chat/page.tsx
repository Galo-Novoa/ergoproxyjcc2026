import { MessagesSquare } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { deleteConversation } from '@/app/actions/conversations'
import { NewConversationButton } from '@/components/chat/new-conversation-button'
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button'
import { DemoBadge } from '@/components/shared/demo-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { listConversations } from '@/lib/data/queries'
import { getLlmStatus } from '@/lib/llm/config'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Conversaciones' }

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export default async function ChatListPage() {
  const user = await requireUser()
  const conversations = await listConversations(user.id)
  const llm = getLlmStatus()

  async function remove(id: string) {
    'use server'
    return deleteConversation(id)
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Conversaciones"
        description="Preguntá, repasá y aclará conceptos de tus materias."
        badge={llm.configured ? undefined : <DemoBadge />}
        actions={<NewConversationButton />}
      />

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="Todavía no hay conversaciones"
          description="Iniciá una para empezar a preguntar. Podés asociarla a una materia desde la lista."
        >
          <NewConversationButton />
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {conversations.map((c) => (
            <li key={c.id}>
              <Card className="flex-row items-center justify-between gap-4 px-4 py-3">
                <Link
                  href={`/chat/${c.id}`}
                  className="flex min-w-0 flex-1 flex-col rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="truncate font-medium">{c.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {c.messageCount} mensajes · {dateFormat.format(c.updatedAt)}
                  </span>
                </Link>
                {c.subjectName ? <Badge variant="secondary">{c.subjectName}</Badge> : null}
                <ConfirmDeleteButton
                  iconOnly
                  label={`Eliminar conversación ${c.title}`}
                  title="¿Eliminar esta conversación?"
                  description="Se borran la conversación y todos sus mensajes."
                  successMessage="Conversación eliminada."
                  onConfirm={remove.bind(null, c.id)}
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
