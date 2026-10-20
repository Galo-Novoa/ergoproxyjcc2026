'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { findRelevantMaterial } from '@/lib/data/material'
import { isUuid } from '@/lib/data/queries'
import { db } from '@/lib/db'
import { isDatabaseConfigured } from '@/lib/db/config'
import { AgentError, runAgent } from '@/lib/llm/agent'
import { isConversationMode } from '@/lib/llm/contract'
import { getUserId } from '@/lib/session'
import type { ActionResult } from '@/lib/types'
const DEMO_ERROR =
  'Modo demo: esto necesita una base de datos conectada. Por ahora solo podés crear materias.'


const contentSchema = z
  .string()
  .trim()
  .min(1, 'Escribí un mensaje.')
  .max(4000, 'El mensaje admite hasta 4000 caracteres.')

const DEFAULT_TITLE = 'Nueva conversación'
const HISTORY_LIMIT = 20
const NODE_CONTEXT_LIMIT = 40
const FOLDER_CONTEXT_LIMIT = 40

export async function sendMessage(
  conversationId: string,
  rawContent: string,
  focusNodeId?: string | null,
): Promise<ActionResult<{ proposedActions: number }>> {
  if (!isDatabaseConfigured) return { ok: false, error: DEMO_ERROR }
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

  // El nodo de foco tiene que ser del propio usuario: si no, se ignora.
  const focusNode =
    focusNodeId && isUuid(focusNodeId)
      ? await db.questionNode.findFirst({
          where: { id: focusNodeId, userId },
          select: { id: true, question: true },
        })
      : null

  // Fragmentos del material de la materia que coinciden con la pregunta.
  const material = await findRelevantMaterial(userId, conversation.subjectId, content)

  // Apuntes que ya existen en la Carpeta: el agente los necesita para proponer
  // actualizar o relacionar en lugar de crear un duplicado.
  const folderNodes = conversation.subjectId
    ? await db.folderNode.findMany({
        where: { userId, subjectId: conversation.subjectId },
        select: { id: true, title: true, type: true },
        orderBy: { updatedAt: 'desc' },
        take: FOLDER_CONTEXT_LIMIT,
      })
    : []

  // Si el modelo falla no se guarda nada: el usuario conserva su borrador y puede reintentar.
  let result
  try {
    result = await runAgent({ mode, nodes, history, focusNode, material, folderNodes })
  } catch (error) {
    if (error instanceof AgentError) return { ok: false, error: error.message }
    return { ok: false, error: 'No pudimos generar la respuesta. Probá de nuevo.' }
  }

  // Las ramas del historial solo pueden colgar de nodos del propio usuario; el resto se descarta.
  // Las propuestas de Carpeta se revalidan al aceptarlas (ver resolveAgentAction).
  const parentIds = [
    ...new Set(
      result.response.actions.flatMap((a) =>
        a.type === 'propose_history_branch' && a.parent_node_id ? [a.parent_node_id] : [],
      ),
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
    (a) =>
      a.type !== 'propose_history_branch' ||
      a.parent_node_id === null ||
      ownedParents.has(a.parent_node_id),
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

  revalidatePath('/', 'layout')
  return { ok: true, data: { proposedActions: actions.length } }
}
