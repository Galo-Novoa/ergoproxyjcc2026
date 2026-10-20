'use server'

import { revalidatePath } from 'next/cache'
import { isUuid } from '@/lib/data/queries'
import { nextNodePosition } from '@/lib/data/tree-layout'
import { db } from '@/lib/db'
import {
  agentActionSchema,
  isConversationMode,
  type AgentActionProposal,
} from '@/lib/llm/contract'
import { getUserId } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

type ActionRow = {
  id: string
  conversationId: string
  messageId: string
  conversation: { subjectId: string | null }
}

/**
 * Confirma o descarta una acción propuesta por el agente.
 *
 * El agente nunca escribe solo: deja la propuesta en estado 'proposed' y acá se
 * revalida todo (que los nodos sigan existiendo y sean del usuario) antes de
 * ejecutarla. Descartar no toca ni el historial ni la Carpeta.
 */
export async function resolveAgentAction(
  actionId: string,
  decision: 'accept' | 'dismiss',
): Promise<ActionResult<{ nodeId?: string }>> {
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
    revalidatePath('/', 'layout')
    return { ok: true }
  }

  const payload = agentActionSchema.safeParse(action.payload)
  if (!payload.success) return { ok: false, error: 'La acción propuesta no es válida.' }

  return payload.data.type === 'propose_history_branch'
    ? acceptHistoryBranch(userId, action, payload.data)
    : acceptFolderChange(userId, action, payload.data)
}

/** Marca la acción como aceptada. Devuelve false si otra pestaña se adelantó. */
async function claim(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  userId: string,
  actionId: string,
) {
  const { count } = await tx.agentAction.updateMany({
    where: { id: actionId, userId, status: 'proposed' },
    data: { status: 'accepted', resolvedAt: new Date() },
  })
  return count > 0
}

async function acceptHistoryBranch(
  userId: string,
  action: ActionRow,
  proposal: Extract<AgentActionProposal, { type: 'propose_history_branch' }>,
): Promise<ActionResult<{ nodeId?: string }>> {
  const { parent_node_id, title, description } = proposal

  let parentSubjectId: string | null = null
  let parentPosition: { posX: number; posY: number } | null = null
  if (parent_node_id) {
    if (!isUuid(parent_node_id)) return { ok: false, error: 'La acción propuesta no es válida.' }
    const parent = await db.questionNode.findFirst({
      where: { id: parent_node_id, userId },
      select: { subjectId: true, posX: true, posY: true },
    })
    if (!parent) return { ok: false, error: 'El nodo padre ya no existe. Descartá la propuesta.' }
    parentSubjectId = parent.subjectId
    parentPosition = { posX: parent.posX, posY: parent.posY }
  }

  const nodeSubjectId = action.conversation.subjectId ?? parentSubjectId
  const siblingCount = await db.questionNode.count({
    where: parent_node_id
      ? { userId, parentId: parent_node_id }
      : { userId, parentId: null, subjectId: nodeSubjectId },
  })
  const position = nextNodePosition({ parent: parentPosition, siblingCount })

  const nodeId = await db.$transaction(async (tx) => {
    if (!(await claim(tx, userId, action.id))) return null
    const node = await tx.questionNode.create({
      data: {
        userId,
        question: title,
        answerSummary: description,
        parentId: parent_node_id,
        subjectId: nodeSubjectId,
        conversationId: action.conversationId,
        messageId: action.messageId,
        ...position,
      },
      select: { id: true },
    })
    await tx.agentAction.update({ where: { id: action.id }, data: { resultNodeId: node.id } })
    return node.id
  })
  if (!nodeId) return { ok: false, error: 'Esta acción ya fue resuelta.' }

  revalidatePath('/', 'layout')
  return { ok: true, data: { nodeId } }
}

/**
 * Ejecuta un cambio en la Carpeta ya autorizado por la persona.
 *
 * Todo lo que el agente nombró se vuelve a buscar acá filtrando por userId: un
 * id inventado o ajeno hace fallar la operación en lugar de tocar datos de otro.
 */
async function acceptFolderChange(
  userId: string,
  action: ActionRow,
  proposal: Extract<AgentActionProposal, { type: 'propose_folder_change' }>,
): Promise<ActionResult<{ nodeId?: string }>> {
  const subjectId = action.conversation.subjectId
  if (!subjectId) {
    return { ok: false, error: 'La conversación no pertenece a una materia, así que no hay Carpeta.' }
  }

  const ownedNode = async (id: string | null) => {
    if (!id || !isUuid(id)) return null
    return db.folderNode.findFirst({
      where: { id, userId, subjectId },
      select: { id: true, title: true, contentMd: true, posX: true, posY: true },
    })
  }

  const target = await ownedNode(proposal.target_node_id)
  const related = await ownedNode(proposal.related_node_id)

  // Referencia al mensaje que originó el apunte: así la nota sabe de dónde salió.
  const reference = {
    userId,
    conversationId: action.conversationId,
    messageId: action.messageId,
  }

  switch (proposal.operation) {
    case 'create_node': {
      if (!proposal.title || !proposal.content_md) {
        return { ok: false, error: 'La propuesta no trae título o contenido.' }
      }
      if (proposal.target_node_id && !target) {
        return { ok: false, error: 'El apunte padre ya no existe. Descartá la propuesta.' }
      }
      const siblingCount = await db.folderNode.count({ where: { userId, subjectId } })
      const position = nextNodePosition({
        parent: target ? { posX: target.posX, posY: target.posY } : null,
        siblingCount,
      })

      const nodeId = await db.$transaction(async (tx) => {
        if (!(await claim(tx, userId, action.id))) return null
        const node = await tx.folderNode.create({
          data: {
            userId,
            subjectId,
            title: proposal.title!,
            type: proposal.node_type ?? 'concept',
            contentMd: proposal.content_md!,
            origin: 'ai',
            ...position,
          },
          select: { id: true },
        })
        if (target) {
          await tx.folderEdge.create({
            data: { userId, fromId: target.id, toId: node.id, kind: 'contains' },
          })
        }
        await tx.folderNodeRef.create({ data: { ...reference, nodeId: node.id } })
        await tx.agentAction.update({
          where: { id: action.id },
          data: { resultNodeId: node.id },
        })
        return node.id
      })
      if (!nodeId) return { ok: false, error: 'Esta acción ya fue resuelta.' }
      revalidatePath('/', 'layout')
      return { ok: true, data: { nodeId } }
    }

    case 'append_content':
    case 'replace_content': {
      if (!target) return { ok: false, error: 'El apunte ya no existe. Descartá la propuesta.' }
      if (!proposal.content_md) return { ok: false, error: 'La propuesta no trae contenido.' }

      // Agregar conserva lo escrito: el agente no pisa el apunte de la persona.
      const contentMd =
        proposal.operation === 'append_content' && target.contentMd
          ? `${target.contentMd}\n\n${proposal.content_md}`
          : proposal.content_md

      const done = await db.$transaction(async (tx) => {
        if (!(await claim(tx, userId, action.id))) return false
        await tx.folderNode.updateMany({ where: { id: target.id, userId }, data: { contentMd } })
        await tx.folderNodeRef.create({ data: { ...reference, nodeId: target.id } })
        await tx.agentAction.update({
          where: { id: action.id },
          data: { resultNodeId: target.id },
        })
        return true
      })
      if (!done) return { ok: false, error: 'Esta acción ya fue resuelta.' }
      revalidatePath('/', 'layout')
      return { ok: true, data: { nodeId: target.id } }
    }

    case 'relate_nodes': {
      if (!target || !related) {
        return { ok: false, error: 'Alguno de los apuntes ya no existe. Descartá la propuesta.' }
      }
      if (target.id === related.id) {
        return { ok: false, error: 'Un apunte no se relaciona consigo mismo.' }
      }
      const kind = proposal.edge_kind ?? 'relates'

      const done = await db.$transaction(async (tx) => {
        if (!(await claim(tx, userId, action.id))) return false
        // Si ya estaban relacionados, la propuesta se cumple sin duplicar la arista.
        await tx.folderEdge.createMany({
          data: [{ userId, fromId: target.id, toId: related.id, kind }],
          skipDuplicates: true,
        })
        await tx.agentAction.update({
          where: { id: action.id },
          data: { resultNodeId: target.id },
        })
        return true
      })
      if (!done) return { ok: false, error: 'Esta acción ya fue resuelta.' }
      revalidatePath('/', 'layout')
      return { ok: true, data: { nodeId: target.id } }
    }

    case 'create_exercise_with_solution': {
      if (!proposal.title || !proposal.content_md || !proposal.solution_md) {
        return { ok: false, error: 'Falta el enunciado o la resolución.' }
      }
      const siblingCount = await db.folderNode.count({ where: { userId, subjectId } })
      const exercisePosition = nextNodePosition({
        parent: target ? { posX: target.posX, posY: target.posY } : null,
        siblingCount,
      })
      const solutionPosition = nextNodePosition({ parent: exercisePosition, siblingCount: 0 })

      const nodeId = await db.$transaction(async (tx) => {
        if (!(await claim(tx, userId, action.id))) return null
        const exercise = await tx.folderNode.create({
          data: {
            userId,
            subjectId,
            title: proposal.title!,
            type: 'exercise',
            contentMd: proposal.content_md!,
            origin: 'ai',
            ...exercisePosition,
          },
          select: { id: true },
        })
        const solution = await tx.folderNode.create({
          data: {
            userId,
            subjectId,
            title: `Resolución · ${proposal.title!}`,
            type: 'solution',
            contentMd: proposal.solution_md!,
            origin: 'ai',
            ...solutionPosition,
          },
          select: { id: true },
        })
        await tx.folderEdge.create({
          data: { userId, fromId: solution.id, toId: exercise.id, kind: 'solves' },
        })
        if (target) {
          await tx.folderEdge.create({
            data: { userId, fromId: target.id, toId: exercise.id, kind: 'contains' },
          })
        }
        await tx.folderNodeRef.createMany({
          data: [
            { ...reference, nodeId: exercise.id },
            { ...reference, nodeId: solution.id },
          ],
        })
        await tx.agentAction.update({
          where: { id: action.id },
          data: { resultNodeId: exercise.id },
        })
        return exercise.id
      })
      if (!nodeId) return { ok: false, error: 'Esta acción ya fue resuelta.' }
      revalidatePath('/', 'layout')
      return { ok: true, data: { nodeId } }
    }
  }
}

export async function setConversationMode(
  conversationId: string,
  mode: string,
): Promise<ActionResult> {
  const userId = await getUserId()
  if (!isUuid(conversationId)) return { ok: false, error: 'No encontramos la conversación.' }
  if (!isConversationMode(mode)) return { ok: false, error: 'Modo inválido.' }
  const { count } = await db.conversation.updateMany({
    where: { id: conversationId, userId },
    data: { mode },
  })
  if (count === 0) return { ok: false, error: 'No encontramos la conversación.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}
