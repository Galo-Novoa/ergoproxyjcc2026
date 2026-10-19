'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isUuid } from '@/lib/data/queries'
import { db } from '@/lib/db'
import { AgentError, runAgent } from '@/lib/llm/agent'
import { isConversationMode } from '@/lib/llm/contract'
import { getUserId } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

const contentSchema = z
  .string()
  .trim()
  .min(1, 'Escribí un mensaje.')
  .max(4000, 'El mensaje admite hasta 4000 caracteres.')

const DEFAULT_TITLE = 'Nueva conversación'
const HISTORY_LIMIT = 20
const NODE_CONTEXT_LIMIT = 40

export async function sendMessage(
  conversationId: string,
  rawContent: string,
): Promise<ActionResult<{ proposedActions: number }>> {
  const userId = await getUserId()
  const parsed = contentSchema.safeParse(rawContent)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const content = parsed.data

  if (!isUuid(conversationId)) return { ok: false, error: 'No encontramos la conversación.' }
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, title: true, mode: true, subjectId: true },
  })
  if (!conversation) return { ok: false, error: 'No encontramos la conversación.' }
  const mode = isConversationMode(conversation.mode) ? conversation.mode : 'free'

  const [previous, nodes] = await Promise.all([
    db.message.findMany({
      where: { conversationId, userId, role: { in: ['user', 'assistant'] } },
      select: { role: true, content: true },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    }),
    db.questionNode.findMany({
      where: { userId, ...(conversation.subjectId ? { subjectId: conversation.subjectId } : {}) },
      select: { id: true, question: true },
      orderBy: { createdAt: 'desc' },
      take: NODE_CONTEXT_LIMIT,
    }),
  ])

  const history = [
    ...previous.reverse().map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    })),
    { role: 'user' as const, content },
  ]

  // Si el modelo falla no se guarda nada: el usuario conserva su borrador y puede reintentar.
  let result
  try {
    result = await runAgent({ mode, nodes, history })
  } catch (error) {
    if (error instanceof AgentError) return { ok: false, error: error.message }
    return { ok: false, error: 'No pudimos generar la respuesta. Probá de nuevo.' }
  }

  // Las acciones solo pueden colgar de nodos del propio usuario; el resto se descarta.
  const parentIds = [
    ...new Set(
      result.response.actions.flatMap((a) => (a.parent_node_id ? [a.parent_node_id] : [])),
    ),
  ].filter(isUuid)
  const ownedParents = new Set(
    parentIds.length
      ? (
          await db.questionNode.findMany({
            where: { id: { in: parentIds }, userId },
            select: { id: true },
          })
        ).map((n) => n.id)
      : [],
  )
  const actions = result.response.actions.filter(
    (a) => a.parent_node_id === null || ownedParents.has(a.parent_node_id),
  )
  const droppedActions =
    result.metadata.droppedActions + (result.response.actions.length - actions.length)

  await db.$transaction(async (tx) => {
    await tx.message.create({ data: { conversationId, userId, role: 'user', content } })
    const reply = await tx.message.create({
      data: {
        conversationId,
        userId,
        role: 'assistant',
        content: result.response.output,
        description: result.response.description,
        metadata: { ...result.metadata, droppedActions },
      },
      select: { id: true },
    })
    if (actions.length) {
      await tx.agentAction.createMany({
        data: actions.map((a) => ({
          userId,
          conversationId,
          messageId: reply.id,
          type: a.type,
          payload: a,
        })),
      })
    }
    await tx.conversation.updateMany({
      where: { id: conversationId, userId },
      data: {
        title:
          conversation.title === DEFAULT_TITLE && result.response.description
            ? result.response.description
            : conversation.title,
        updatedAt: new Date(),
      },
    })
  })

  revalidatePath('/chat', 'layout')
  return { ok: true, data: { proposedActions: actions.length } }
}
