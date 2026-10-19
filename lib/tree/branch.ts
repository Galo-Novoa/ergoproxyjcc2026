import 'server-only'

import { isUuid } from '@/lib/data/queries'
import { db } from '@/lib/db'
import { pathTo, visibleMessages, type TreeNode } from '@/lib/tree/compose'
import { QUESTION_PREVIEW_CHARS, ROOT_ALIAS } from '@/lib/tree/config'

/**
 * Devuelve la raíz de la conversación, creándola si falta (conversaciones nuevas) y adoptando los mensajes
 * que todavía no pertenecen a ninguna rama. Es idempotente: el índice único parcial evita raíces duplicadas.
 */
export async function ensureRootNode(conversationId: string, userId: string) {
  const findRoot = () =>
    db.conversationNode.findFirst({
      where: { conversationId, userId, parentId: null },
      select: { id: true },
    })
  let root = await findRoot()
  if (!root) {
    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { title: true },
    })
    if (!conversation) throw new Error('Conversación inexistente.')
    try {
      root = await db.conversationNode.create({
        data: { conversationId, userId, alias: ROOT_ALIAS, topic: conversation.title },
        select: { id: true },
      })
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error
      root = await findRoot()
    }
  }
  if (!root) throw new Error('No se pudo crear la rama inicial.')

  await db.message.updateMany({
    where: { conversationId, userId, nodeId: null },
    data: { nodeId: root.id },
  })
  await db.conversation.updateMany({
    where: { id: conversationId, userId, activeNodeId: null },
    data: { activeNodeId: root.id },
  })
  return root.id
}

export async function loadTree(conversationId: string, userId: string): Promise<TreeNode[]> {
  const rows = await db.conversationNode.findMany({
    where: { conversationId, userId },
    select: {
      id: true,
      parentId: true,
      alias: true,
      topic: true,
      contextSummary: true,
      summaryUpToSeq: true,
      inheritedSummary: true,
      anchorMessage: { select: { seq: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(({ anchorMessage, ...node }) => ({ ...node, anchorSeq: anchorMessage?.seq ?? null }))
}

/**
 * Elige la rama a mostrar: la pedida en la URL, si es válida; si no, la última activa; si no, la raíz.
 * Nunca confía en un id que no pertenezca a esta conversación.
 */
export function pickNodeId(
  nodes: TreeNode[],
  rootId: string,
  requested: string | null | undefined,
  active: string | null | undefined,
) {
  const ids = new Set(nodes.map((n) => n.id))
  if (requested && isUuid(requested) && ids.has(requested)) return requested
  if (active && ids.has(active)) return active
  return rootId
}

/** Rama completa para mostrar o continuar: camino raíz→nodo y mensajes visibles con su origen. */
export async function loadBranch(
  conversationId: string,
  userId: string,
  nodeId: string,
  preloaded?: TreeNode[],
) {
  const nodes = preloaded ?? (await loadTree(conversationId, userId))
  const path = pathTo(nodes, nodeId)
  if (!path.length) throw new Error('La rama no existe en esta conversación.')

  const rows = await db.message.findMany({
    where: { conversationId, userId, nodeId: { in: path.map((n) => n.id) } },
    include: { agentActions: { orderBy: { createdAt: 'asc' } } },
    orderBy: { seq: 'asc' },
  })
  return { nodes, path, visible: visibleMessages(path, rows) }
}

export type MapNode = {
  id: string
  parentId: string | null
  alias: string
  topic: string
  messageCount: number
  hasSummary: boolean
  questions: { id: string; text: string }[]
}

/** Datos livianos para dibujar el mapa y buscar preguntas anteriores en cualquier rama. */
export async function listMapNodes(conversationId: string, userId: string): Promise<MapNode[]> {
  const [nodes, messages] = await Promise.all([
    db.conversationNode.findMany({
      where: { conversationId, userId },
      select: { id: true, parentId: true, alias: true, topic: true, contextSummary: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    }),
    db.message.findMany({
      where: { conversationId, userId, nodeId: { not: null }, role: { in: ['user', 'assistant'] } },
      select: { id: true, nodeId: true, role: true, content: true },
      orderBy: { seq: 'asc' },
    }),
  ])
  const byNode = new Map<string, MapNode>(
    nodes.map((n) => [
      n.id,
      {
        id: n.id,
        parentId: n.parentId,
        alias: n.alias,
        topic: n.topic,
        messageCount: 0,
        hasSummary: Boolean(n.contextSummary),
        questions: [],
      },
    ]),
  )
  for (const m of messages) {
    const node = m.nodeId ? byNode.get(m.nodeId) : undefined
    if (!node) continue
    node.messageCount += 1
    if (m.role === 'user') {
      node.questions.push({ id: m.id, text: m.content.slice(0, QUESTION_PREVIEW_CHARS) })
    }
  }
  return [...byNode.values()]
}
