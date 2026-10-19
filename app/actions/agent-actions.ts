'use server'

import { revalidatePath } from 'next/cache'
import { isUuid } from '@/lib/data/queries'
import { db } from '@/lib/db'
import { agentActionSchema, isConversationMode } from '@/lib/llm/contract'
import { demoModeBlock, getUserId } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

/** Confirma o descarta una acción propuesta. Al aceptar se revalida todo en el servidor. */
export async function resolveAgentAction(
  actionId: string,
  decision: 'accept' | 'dismiss',
): Promise<ActionResult<{ nodeId?: string }>> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(actionId)) return { ok: false, error: 'No encontramos la acción.' }

  const action = await db.agentAction.findFirst({
    where: { id: actionId, userId },
    include: { conversation: { select: { subjectId: true } } },
  })
  if (!action) return { ok: false, error: 'No encontramos la acción.' }
  if (action.status !== 'proposed') return { ok: false, error: 'Esta acción ya fue resuelta.' }

  if (decision === 'dismiss') {
    const { count } = await db.agentAction.updateMany({
      where: { id: actionId, userId, status: 'proposed' },
      data: { status: 'dismissed', resolvedAt: new Date() },
    })
    if (count === 0) return { ok: false, error: 'Esta acción ya fue resuelta.' }
    revalidatePath('/chat', 'layout')
    return { ok: true }
  }

  const payload = agentActionSchema.safeParse(action.payload)
  if (!payload.success) return { ok: false, error: 'La acción propuesta no es válida.' }

  const { parent_node_id, title, description } = payload.data
  let parentSubjectId: string | null = null
  if (parent_node_id) {
    if (!isUuid(parent_node_id)) return { ok: false, error: 'La acción propuesta no es válida.' }
    const parent = await db.questionNode.findFirst({
      where: { id: parent_node_id, userId },
      select: { subjectId: true },
    })
    if (!parent) return { ok: false, error: 'El nodo padre ya no existe. Descartá la propuesta.' }
    parentSubjectId = parent.subjectId
  }

  const nodeId = await db.$transaction(async (tx) => {
    const claimed = await tx.agentAction.updateMany({
      where: { id: actionId, userId, status: 'proposed' },
      data: { status: 'accepted', resolvedAt: new Date() },
    })
    if (claimed.count === 0) return null
    const node = await tx.questionNode.create({
      data: {
        userId,
        question: title,
        answerSummary: description,
        parentId: parent_node_id,
        subjectId: action.conversation.subjectId ?? parentSubjectId,
        conversationId: action.conversationId,
        messageId: action.messageId,
      },
      select: { id: true },
    })
    await tx.agentAction.update({ where: { id: actionId }, data: { resultNodeId: node.id } })
    return node.id
  })
  if (!nodeId) return { ok: false, error: 'Esta acción ya fue resuelta.' }

  revalidatePath('/chat', 'layout')
  revalidatePath('/map')
  return { ok: true, data: { nodeId } }
}

export async function setConversationMode(
  conversationId: string,
  mode: string,
): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(conversationId)) return { ok: false, error: 'No encontramos la conversación.' }
  if (!isConversationMode(mode)) return { ok: false, error: 'Modo inválido.' }
  const { count } = await db.conversation.updateMany({
    where: { id: conversationId, userId },
    data: { mode },
  })
  if (count === 0) return { ok: false, error: 'No encontramos la conversación.' }
  revalidatePath('/chat', 'layout')
  return { ok: true }
}
