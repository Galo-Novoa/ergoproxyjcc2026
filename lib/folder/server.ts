import 'server-only'

import { db } from '@/lib/db'
import {
  LABEL_MAX,
  MAX_FOLDER_PROPOSALS_PER_MESSAGE,
  MAX_NODES_PER_WORKSPACE,
} from '@/lib/folder/config'
import {
  canonicalRelated,
  edgeExists,
  mergeContent,
  normalizeFolderProposal,
  wouldCreateCycle,
  type EdgeRef,
  type NodeRef,
} from '@/lib/folder/logic'
import type { FolderProposal } from '@/lib/folder/schema'

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

export class FolderError extends Error {}

export type FolderSourceRef = {
  conversationId: string
  messageId: string | null
  historyNodeId: string | null
  label: string
}

/** Apuntes y relaciones de un workspace (`subjectId` null = General). Siempre acotado al usuario. */
export async function loadFolderIndex(
  userId: string,
  subjectId: string | null,
  client: Tx | typeof db = db,
): Promise<{ nodes: NodeRef[]; edges: EdgeRef[] }> {
  const nodes = await client.folderNode.findMany({
    where: { userId, subjectId },
    select: { id: true, title: true, kind: true },
    orderBy: { updatedAt: 'desc' },
  })
  if (!nodes.length) return { nodes: [], edges: [] }
  const edges = await client.folderEdge.findMany({
    where: { userId, fromId: { in: nodes.map((n) => n.id) } },
    select: { fromId: true, toId: true, kind: true },
  })
  return { nodes, edges }
}

/**
 * Filtra las propuestas del modelo contra la Carpeta real: descarta ids inventados, duplicados y relaciones
 * inválidas, y convierte "crear" en "ampliar" cuando ya existe un apunte parecido.
 */
export async function prepareFolderProposals(
  userId: string,
  subjectId: string | null,
  proposals: FolderProposal[],
) {
  const ctx = await loadFolderIndex(userId, subjectId)
  const valid: FolderProposal[] = []
  let room = MAX_NODES_PER_WORKSPACE - ctx.nodes.length

  for (const raw of proposals) {
    if (valid.length >= MAX_FOLDER_PROPOSALS_PER_MESSAGE) break
    const result = normalizeFolderProposal(raw, ctx)
    if (!result.ok) continue
    const p = result.proposal
    if (p.operation === 'create') {
      if (room <= 0) continue
      room -= 1
      // Un segundo apunte igual dentro de la misma respuesta se detecta como duplicado del primero.
      ctx.nodes.push({ id: `pending-${valid.length}`, title: p.title ?? '', kind: p.kind ?? 'concept' })
    }
    valid.push(p)
  }
  return { valid, dropped: proposals.length - valid.length }
}

async function addSource(tx: Tx, userId: string, nodeId: string, source: FolderSourceRef) {
  const exists = await tx.folderSource.findFirst({
    where: {
      nodeId,
      userId,
      conversationId: source.conversationId,
      messageId: source.messageId,
      historyNodeId: source.historyNodeId,
    },
    select: { id: true },
  })
  if (exists) return
  await tx.folderSource.create({
    data: {
      nodeId,
      userId,
      conversationId: source.conversationId,
      messageId: source.messageId,
      historyNodeId: source.historyNodeId,
      label: source.label.slice(0, LABEL_MAX),
    },
  })
}

async function addEdge(tx: Tx, userId: string, fromId: string, toId: string, kind: 'child' | 'related') {
  const [from, to] = kind === 'related' ? canonicalRelated(fromId, toId) : [fromId, toId]
  await tx.folderEdge.upsert({
    where: { fromId_toId_kind: { fromId: from, toId: to, kind } },
    create: { userId, fromId: from, toId: to, kind },
    update: {},
  })
}

/**
 * Ejecuta una propuesta ya aceptada por el usuario. Revalida contra el estado ACTUAL de la Carpeta (pudo
 * cambiar desde la propuesta) y lanza `FolderError` si ya no se puede aplicar; quien llama revierte la transacción.
 */
export async function applyFolderProposal(
  tx: Tx,
  userId: string,
  subjectId: string | null,
  proposal: FolderProposal,
  source: FolderSourceRef | null,
): Promise<{ nodeId: string }> {
  const ctx = await loadFolderIndex(userId, subjectId, tx)
  const result = normalizeFolderProposal(proposal, ctx)
  if (!result.ok) throw new FolderError(result.reason)
  const p = result.proposal

  if (p.operation === 'create') {
    if (ctx.nodes.length >= MAX_NODES_PER_WORKSPACE) {
      throw new FolderError('Esta carpeta ya tiene el máximo de apuntes.')
    }
    const node = await tx.folderNode.create({
      data: {
        userId,
        subjectId,
        kind: p.kind ?? 'concept',
        title: p.title ?? '',
        content: p.content ?? '',
      },
      select: { id: true },
    })
    if (p.parentNodeId) await addEdge(tx, userId, p.parentNodeId, node.id, 'child')
    if (p.relatedNodeId) await addEdge(tx, userId, node.id, p.relatedNodeId, 'related')
    if (source) await addSource(tx, userId, node.id, source)
    if (p.kind === 'exercise' && p.solution) {
      const solution = await tx.folderNode.create({
        data: { userId, subjectId, kind: 'solution', title: `Resolución: ${p.title}`.slice(0, 120), content: p.solution },
        select: { id: true },
      })
      await addEdge(tx, userId, node.id, solution.id, 'child')
      if (source) await addSource(tx, userId, solution.id, source)
    }
    return { nodeId: node.id }
  }

  if (p.operation === 'append') {
    const target = await tx.folderNode.findFirst({
      where: { id: p.targetNodeId ?? '', userId, subjectId },
      select: { id: true, content: true },
    })
    if (!target) throw new FolderError('El apunte de destino ya no existe.')
    const merged = mergeContent(target.content, p.content ?? '')
    if (!merged.ok) throw new FolderError(merged.error)
    if (!merged.changed) throw new FolderError('El apunte ya contiene ese contenido.')
    await tx.folderNode.update({ where: { id: target.id }, data: { content: merged.content } })
    if (source) await addSource(tx, userId, target.id, source)
    return { nodeId: target.id }
  }

  const from = p.targetNodeId as string
  const to = p.relatedNodeId as string
  const relation = p.relation === 'child' ? 'child' : 'related'
  if (edgeExists(ctx.edges, from, to, relation)) throw new FolderError('Esos apuntes ya están relacionados.')
  if (relation === 'child' && wouldCreateCycle(ctx.edges, from, to)) {
    throw new FolderError('Esa relación crearía un ciclo.')
  }
  await addEdge(tx, userId, from, to, relation)
  return { nodeId: from }
}
