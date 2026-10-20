import 'server-only'

import { db } from '@/lib/db'
import {
  LABEL_MAX,
  MAX_FOLDER_PROPOSALS_PER_MESSAGE,
  MAX_NODES_PER_WORKSPACE,
} from '@/lib/folder/config'
import {
  canonicalRelates,
  edgeExists,
  mergeContent,
  normalizeFolderProposal,
  wouldCreateCycle,
  type EdgeRef,
  type NodeRef,
} from '@/lib/folder/logic'
import type { FolderProposal } from '@/lib/folder/schema'
import { nextNodePosition } from '@/lib/data/tree-layout'

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

export class FolderError extends Error {}

export type FolderSourceRef = {
  conversationId: string | null
  messageId: string | null
  historyNodeId: string | null
  questionNodeId: string | null
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
    select: { id: true, title: true, type: true },
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
    const createsNodes =
      p.operation === 'create_node' || p.operation === 'create_exercise_with_solution'
    if (createsNodes) {
      const needed = p.operation === 'create_exercise_with_solution' ? 2 : 1
      if (room < needed) continue
      room -= needed
      // Un segundo apunte igual dentro de la misma respuesta se detecta como duplicado del primero.
      ctx.nodes.push({ id: `pending-${valid.length}`, title: p.title ?? '', type: p.node_type ?? 'concept' })
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
      questionNodeId: source.questionNodeId,
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
      questionNodeId: source.questionNodeId,
      label: source.label.slice(0, LABEL_MAX),
    },
  })
}

async function addEdge(tx: Tx, userId: string, fromId: string, toId: string, kind: string) {
  const [from, to] = kind === 'relates' ? canonicalRelates(fromId, toId) : [fromId, toId]
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

  if (p.operation === 'create_node' || p.operation === 'create_exercise_with_solution') {
    if (ctx.nodes.length >= MAX_NODES_PER_WORKSPACE) {
      throw new FolderError('Esta carpeta ya tiene el máximo de apuntes.')
    }
    const parentPosition = p.target_node_id
      ? await tx.folderNode.findFirst({
          where: { id: p.target_node_id },
          select: { posX: true, posY: true },
        })
      : null
    const placed = nextNodePosition({ parent: parentPosition, siblingCount: ctx.nodes.length })

    const node = await tx.folderNode.create({
      data: {
        userId,
        subjectId,
        type: p.node_type ?? 'concept',
        title: p.title ?? '',
        contentMd: p.content_md ?? '',
        origin: 'ai',
        ...placed,
      },
      select: { id: true },
    })
    if (p.target_node_id) await addEdge(tx, userId, p.target_node_id, node.id, 'contains')
    if (source) await addSource(tx, userId, node.id, source)
    if (p.operation === 'create_exercise_with_solution' && p.solution_md) {
      const solutionPosition = nextNodePosition({ parent: placed, siblingCount: 0 })
      const solution = await tx.folderNode.create({
        data: {
          userId,
          subjectId,
          type: 'solution',
          title: `Resolución · ${p.title ?? ''}`.slice(0, 120),
          contentMd: p.solution_md,
          origin: 'ai',
          ...solutionPosition,
        },
        select: { id: true },
      })
      await addEdge(tx, userId, solution.id, node.id, 'solves')
      if (source) await addSource(tx, userId, solution.id, source)
    }
    return { nodeId: node.id }
  }

  if (p.operation === 'append_content' || p.operation === 'replace_content') {
    const target = await tx.folderNode.findFirst({
      where: { id: p.target_node_id ?? '', userId, subjectId },
      select: { id: true, contentMd: true },
    })
    if (!target) throw new FolderError('El apunte de destino ya no existe.')
    let contentMd = p.content_md ?? ''
    if (p.operation === 'append_content') {
      const merged = mergeContent(target.contentMd, contentMd)
      if (!merged.ok) throw new FolderError(merged.error)
      if (!merged.changed) throw new FolderError('El apunte ya contiene ese contenido.')
      contentMd = merged.content
    }
    await tx.folderNode.update({ where: { id: target.id }, data: { contentMd } })
    if (source) await addSource(tx, userId, target.id, source)
    return { nodeId: target.id }
  }

  const from = p.target_node_id as string
  const to = p.related_node_id as string
  const kind = p.edge_kind ?? 'relates'
  if (edgeExists(ctx.edges, from, to, kind)) throw new FolderError('Esos apuntes ya están relacionados.')
  if (kind === 'contains' && wouldCreateCycle(ctx.edges, from, to)) {
    throw new FolderError('Esa relación crearía un ciclo.')
  }
  await addEdge(tx, userId, from, to, kind)
  return { nodeId: from }
}
