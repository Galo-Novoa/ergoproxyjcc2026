'use server'

import { revalidatePath } from 'next/cache'
import { isUuid } from '@/lib/data/queries'
import { db } from '@/lib/db'
import { isConversationMode, parseProposalPayload } from '@/lib/llm/contract'
import { demoModeBlock, getUserId } from '@/lib/session'
import { loadTree } from '@/lib/tree/branch'
import { pathTo } from '@/lib/tree/compose'
import { MAX_DEPTH, MAX_NODES_PER_CONVERSATION } from '@/lib/tree/config'
import type { ActionResult } from '@/lib/types'

const ALREADY_RESOLVED = 'Esta acción ya fue resuelta.'

/**
 * Confirma o descarta una acción propuesta. Al aceptar, la rama nueva cuelga del nodo donde se hizo la
 * propuesta (se lee del mensaje, no del payload del modelo) y hereda hasta ese mensaje inclusive.
 */
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
    include: { message: { select: { id: true, nodeId: true } } },
  })
  if (!action) return { ok: false, error: 'No encontramos la acción.' }
  if (action.status !== 'proposed') return { ok: false, error: ALREADY_RESOLVED }

  if (decision === 'dismiss') {
    const { count } = await db.agentAction.updateMany({
      where: { id: actionId, userId, status: 'proposed' },
      data: { status: 'dismissed', resolvedAt: new Date() },
    })
    if (count === 0) return { ok: false, error: ALREADY_RESOLVED }
    revalidatePath('/chat', 'layout')
    return { ok: true }
  }

  const proposal = parseProposalPayload(action.payload)
  if (!proposal) return { ok: false, error: 'La acción propuesta no es válida.' }
  const parentId = action.message.nodeId
  if (!parentId) return { ok: false, error: 'La rama de origen ya no existe. Descartá la propuesta.' }

  const tree = await loadTree(action.conversationId, userId)
  const parentPath = pathTo(tree, parentId)
  if (!parentPath.length) return { ok: false, error: 'La rama de origen ya no existe. Descartá la propuesta.' }
  if (tree.length >= MAX_NODES_PER_CONVERSATION) {
    return { ok: false, error: 'Esta conversación ya tiene el máximo de ramas.' }
  }
  if (parentPath.length > MAX_DEPTH) {
    return { ok: false, error: 'Esta rama ya está en el nivel máximo de profundidad.' }
  }
  const siblings = tree.filter((n) => n.parentId === parentId)
  const taken = proposal.alias.toLocaleLowerCase('es')
  if (siblings.some((n) => n.alias.toLocaleLowerCase('es') === taken)) {
    return { ok: false, error: 'Ya existe una rama con ese nombre. Descartá la propuesta.' }
  }

  const nodeId = await db.$transaction(async (tx) => {
    const claimed = await tx.agentAction.updateMany({
      where: { id: actionId, userId, status: 'proposed' },
      data: { status: 'accepted', resolvedAt: new Date() },
    })
    if (claimed.count === 0) return null
    const node = await tx.conversationNode.create({
      data: {
        conversationId: action.conversationId,
        userId,
        parentId,
        anchorMessageId: action.messageId,
        alias: proposal.alias,
        topic: proposal.description,
        position: siblings.length,
      },
      select: { id: true },
    })
    await tx.agentAction.update({ where: { id: actionId }, data: { resultNodeId: node.id } })
    await tx.conversation.updateMany({
      where: { id: action.conversationId, userId },
      data: { activeNodeId: node.id },
    })
    return node.id
  })
  if (!nodeId) return { ok: false, error: ALREADY_RESOLVED }

  revalidatePath('/chat', 'layout')
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

/** Cambia la rama que se muestra y con la que se continúa. Solo acepta nodos de esta conversación. */
export async function setActiveNode(
  conversationId: string,
  nodeId: string,
): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(conversationId) || !isUuid(nodeId)) {
    return { ok: false, error: 'No encontramos la rama.' }
  }
  const node = await db.conversationNode.findFirst({
    where: { id: nodeId, conversationId, userId },
    select: { id: true },
  })
  if (!node) return { ok: false, error: 'No encontramos la rama.' }
  await db.conversation.updateMany({
    where: { id: conversationId, userId },
    data: { activeNodeId: nodeId },
  })
  revalidatePath('/chat', 'layout')
  return { ok: true }
}
