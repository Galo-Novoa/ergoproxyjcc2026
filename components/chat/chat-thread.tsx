'use client'

import { GraduationCap, SendHorizontal } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { sendMessage } from '@/app/actions/chat'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import {
  Message,
  MessageAvatar,
  MessageContent,
} from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/empty-state'
import { MessagesSquare } from 'lucide-react'

type ChatMessage = { id: string; role: string; content: string }

export function ChatThread({
  conversationId,
  initialMessages,
}: {
  conversationId: string
  initialMessages: ChatMessage[]
}) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [pendingText, setPendingText] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    const content = draft.trim()
    if (!content || pending) return
    setPendingText(content)
    setDraft('')
    startTransition(async () => {
      const result = await sendMessage(conversationId, content)
      setPendingText(null)
      if (!result.ok) {
        toast.error(result.error)
        setDraft(content)
        return
      }
      router.refresh()
    })
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      event.keyCode !== 229
    ) {
      event.preventDefault()
      submit()
    }
  }

  const hasMessages = initialMessages.length > 0 || pendingText !== null

  return (
    <div className="flex h-[calc(100svh-15rem)] min-h-96 flex-col gap-4">
      <div className="min-h-0 flex-1 rounded-xl border bg-card">
        {hasMessages ? (
          <MessageScrollerProvider>
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent className="gap-4 p-4">
                  {initialMessages.map((m) => (
                    <MessageScrollerItem key={m.id}>
                      <ChatBubble role={m.role} content={m.content} />
                    </MessageScrollerItem>
                  ))}
                  {pendingText ? (
                    <>
                      <MessageScrollerItem scrollAnchor>
                        <ChatBubble role="user" content={pendingText} />
                      </MessageScrollerItem>
                      <MessageScrollerItem>
                        <div
                          className="flex items-center gap-2 px-2 text-sm text-muted-foreground"
                          role="status"
                        >
                          <Spinner /> Pensando…
                        </div>
                      </MessageScrollerItem>
                    </>
                  ) : null}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        ) : (
          <EmptyState
            icon={MessagesSquare}
            title="Empezá la conversación"
            description="Escribí tu primera pregunta abajo. Enter envía, Shift + Enter agrega una línea."
          />
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex items-end gap-2"
      >
        <label htmlFor="chat-input" className="sr-only">
          Mensaje
        </label>
        <Textarea
          id="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí tu pregunta…"
          rows={2}
          maxLength={4000}
          disabled={pending}
          className="min-h-12 resize-none"
        />
        <Button type="submit" size="lg" disabled={pending || draft.trim().length === 0}>
          {pending ? <Spinner data-icon="inline-start" /> : <SendHorizontal data-icon="inline-start" />}
          Enviar
        </Button>
      </form>
    </div>
  )
}

function ChatBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'user'
  return (
    <Message align={isUser ? 'end' : 'start'}>
      {!isUser ? (
        <MessageAvatar>
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-primary-foreground">
              <GraduationCap className="size-4" />
            </AvatarFallback>
          </Avatar>
        </MessageAvatar>
      ) : null}
      <MessageContent>
        <Bubble variant={isUser ? 'default' : 'secondary'} align={isUser ? 'end' : 'start'}>
          <BubbleContent className="whitespace-pre-wrap">{content}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}
