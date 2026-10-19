'use client'

import {
  AlertCircle,
  ChevronRight,
  GraduationCap,
  MessagesSquare,
  SendHorizontal,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setActiveNode, setConversationMode } from '@/app/actions/agent-actions'
import { sendMessage } from '@/app/actions/chat'
import { AgentActionCard, type AgentActionView } from '@/components/chat/agent-action-card'
import { ConversationMap } from '@/components/chat/conversation-map'
import { FilePicker, type ChatFile } from '@/components/chat/file-picker'
import { Markdown } from '@/components/chat/markdown'
import { MessageSources } from '@/components/chat/message-sources'
import { EmptyState } from '@/components/shared/empty-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  CONVERSATION_MODES,
  isConversationMode,
  MODE_LABELS,
  type ConversationMode,
} from '@/lib/llm/contract'
import type { RagMetadata } from '@/lib/rag/types'
import type { MapNode } from '@/lib/tree/branch'

export type ChatMessage = {
  id: string
  role: string
  content: string
  actions: AgentActionView[]
  rag: RagMetadata | null
  /** true si el mensaje viene de un ancestro (contexto compartido hasta la bifurcación). */
  inherited: boolean
}

export function ChatThread({
  conversationId,
  nodeId,
  path,
  mapNodes,
  mode,
  initialMessages,
  files,
}: {
  conversationId: string
  nodeId: string
  path: { id: string; alias: string }[]
  mapNodes: MapNode[]
  mode: ConversationMode
  initialMessages: ChatMessage[]
  files: ChatFile[]
}) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [pendingText, setPendingText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentMode, setCurrentMode] = useState(mode)
  const [pending, startTransition] = useTransition()

  function submit() {
    const content = draft.trim()
    if (!content || pending) return
    setError(null)
    setPendingText(content)
    setDraft('')
    startTransition(async () => {
      const result = await sendMessage(conversationId, content, selectedFileIds, nodeId)
      setPendingText(null)
      if (!result.ok) {
        setError(result.error)
        setDraft(content)
        return
      }
      const proposed = result.data?.proposedActions ?? 0
      if (proposed > 1) {
        toast.info(`El agente propuso ${proposed} ramas. Elegí cuál abrir primero.`)
      }
      router.refresh()
    })
  }

  function openNode(targetId: string) {
    if (targetId === nodeId) return
    startTransition(async () => {
      const result = await setActiveNode(conversationId, targetId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function changeMode(value: string) {
    if (!isConversationMode(value) || value === currentMode) return
    const previous = currentMode
    setCurrentMode(value)
    startTransition(async () => {
      const result = await setConversationMode(conversationId, value)
      if (!result.ok) {
        setCurrentMode(previous)
        toast.error(result.error)
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
    <div className="flex h-[calc(100svh-15rem)] min-h-96 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={currentMode} onValueChange={changeMode}>
          <TabsList aria-label="Modo de la conversación">
            {CONVERSATION_MODES.map((m) => (
              <TabsTrigger key={m} value={m} disabled={pending}>
                {MODE_LABELS[m]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <ConversationMap
          nodes={mapNodes}
          activeNodeId={nodeId}
          disabled={pending}
          onSelect={openNode}
        />
      </div>

      {path.length > 1 ? (
        <nav aria-label="Ruta de la rama" className="flex flex-wrap items-center gap-1 text-sm">
          {path.map((node, index) => (
            <span key={node.id} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden /> : null}
              {index === path.length - 1 ? (
                <span aria-current="page" className="font-medium">
                  {node.alias}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => openNode(node.id)}
                >
                  {node.alias}
                </Button>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      <div className="min-h-0 flex-1 rounded-xl border bg-card">
        {hasMessages ? (
          <MessageScrollerProvider>
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent className="gap-4 p-4">
                  {initialMessages.map((m, index) => (
                    <MessageScrollerItem key={m.id}>
                      {!m.inherited && initialMessages[index - 1]?.inherited ? (
                        <p
                          role="separator"
                          className="pb-4 text-center text-xs text-muted-foreground"
                        >
                          Acá empieza la rama «{path[path.length - 1].alias}». Lo de arriba es el contexto compartido.
                        </p>
                      ) : null}
                      <ChatBubble message={m} conversationId={conversationId} />
                    </MessageScrollerItem>
                  ))}
                  {pendingText ? (
                    <>
                      <MessageScrollerItem scrollAnchor>
                        <ChatBubble
                          message={{
                            id: 'pending',
                            role: 'user',
                            content: pendingText,
                            actions: [],
                            rag: null,
                            inherited: false,
                          }}
                          conversationId={conversationId}
                        />
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

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertTitle>No pudimos obtener la respuesta</AlertTitle>
          <AlertDescription>
            {error} Tu mensaje sigue en el cuadro de texto para reenviarlo.
          </AlertDescription>
        </Alert>
      ) : null}

      <FilePicker
        files={files}
        selectedIds={selectedFileIds}
        onChange={setSelectedFileIds}
        disabled={pending}
      />

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

function ChatBubble({
  message,
  conversationId,
}: {
  message: ChatMessage
  conversationId: string
}) {
  const isUser = message.role === 'user'
  const citationPrefix = `src-${message.id}`
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
      <MessageContent className="gap-2">
        <Bubble variant={isUser ? 'default' : 'secondary'} align={isUser ? 'end' : 'start'}>
          <BubbleContent className={isUser ? 'whitespace-pre-wrap' : undefined}>
            {isUser ? (
              message.content
            ) : (
              <Markdown citationPrefix={message.rag ? citationPrefix : undefined}>
                {message.content}
              </Markdown>
            )}
          </BubbleContent>
        </Bubble>
        {message.rag ? <MessageSources rag={message.rag} anchorPrefix={citationPrefix} /> : null}
        {message.actions.map((action) => (
          <AgentActionCard key={action.id} action={action} conversationId={conversationId} />
        ))}
      </MessageContent>
    </Message>
  )
}
