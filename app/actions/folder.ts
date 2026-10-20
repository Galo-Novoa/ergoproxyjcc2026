'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { readScope, writeScope } from '@/lib/authz'
import { isUuid, searchFolderNodes } from '@/lib/data/queries'
import { nextNodePosition } from '@/lib/data/tree-layout'
import { db } from '@/lib/db'
import { canonicalRelates } from '@/lib/folder/logic'
import { FOLDER_EDGE_KINDS, FOLDER_NODE_TYPES } from '@/lib/llm/contract'
import { demoModeBlock, getUserId } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Escribí un título para el apunte.')
  .max(80, 'El título admite hasta 80 caracteres.')

const contentSchema = z
  .string()
  .max(20_000, 'El apunte admite hasta 20.000 caracteres.')

const typeSchema = z.enum(FOLDER_NODE_TYPES, 'Tipo de apunte inválido.')
const kindSchema = z.enum(FOLDER_EDGE_KINDS, 'Tipo de relación inválido.')

/** Materia del usuario con permiso de escritura, o null. */
async function writableSubject(userId: string, subjectId: string) {
  if (!isUuid(subjectId)) return null
  const scope = await writeScope(userId)
  return db.subject.findFirst({
    where: { AND: [scope, { id: subjectId }] },
    select: { id: true },
  })
}

export async function createFolderNode(
  subjectId: string,
  rawTitle: string,
  rawType: string,
  parentId?: string | null,
): Promise<ActionResult<{ id: string }>> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()

  const title = titleSchema.safeParse(rawTitle)
  if (!title.success) return { ok: false, error: title.error.issues[0].message }
  const type = typeSchema.safeParse(rawType)
  if (!type.success) return { ok: false, error: type.error.issues[0].message }

  const subject = await writableSubject(userId, subjectId)
  if (!subject) return { ok: false, error: 'No encontramos la materia.' }

  // El padre es opcional: el grafo admite apuntes sueltos.
  let parent: { id: string; posX: number; posY: number } | null = null
  if (parentId) {
    if (!isUuid(parentId)) return { ok: false, error: 'Apunte padre inválido.' }
    parent = await db.folderNode.findFirst({
      where: { id: parentId, userId, subjectId: subject.id },
      select: { id: true, posX: true, posY: true },
    })
    if (!parent) return { ok: false, error: 'No encontramos el apunte padre.' }
  }

  const siblingCount = await db.folderNode.count({ where: { userId, subjectId: subject.id } })
  const position = nextNodePosition({
    parent: parent ? { posX: parent.posX, posY: parent.posY } : null,
    siblingCount,
  })

  const nodeId = await db.$transaction(async (tx) => {
    const node = await tx.folderNode.create({
      data: {
        userId,
        subjectId: subject.id,
        title: title.data,
        type: type.data,
        origin: 'manual',
        ...position,
      },
      select: { id: true },
    })
    if (parent) {
      await tx.folderEdge.create({
        data: { userId, fromId: parent.id, toId: node.id, kind: 'contains' },
      })
    }
    return node.id
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id: nodeId } }
}

/** Guarda título, tipo y contenido Markdown del apunte. */
export async function updateFolderNode(
  id: string,
  rawTitle: string,
  rawContent: string,
  rawType: string,
): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(id)) return { ok: false, error: 'No encontramos el apunte.' }

  const title = titleSchema.safeParse(rawTitle)
  if (!title.success) return { ok: false, error: title.error.issues[0].message }
  const content = contentSchema.safeParse(rawContent)
  if (!content.success) return { ok: false, error: content.error.issues[0].message }
  const type = typeSchema.safeParse(rawType)
  if (!type.success) return { ok: false, error: type.error.issues[0].message }

  // Editar a mano lo vuelve propio: una propuesta de la IA ya no lo sobreescribe en silencio.
  const { count } = await db.folderNode.updateMany({
    where: { id, userId },
    data: {
      title: title.data,
      contentMd: content.data,
      type: type.data,
      origin: 'manual',
    },
  })
  if (count === 0) return { ok: false, error: 'No encontramos el apunte.' }

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function moveFolderNode(
  id: string,
  posX: number,
  posY: number,
): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(id)) return { ok: false, error: 'No encontramos el apunte.' }
  if (!Number.isFinite(posX) || !Number.isFinite(posY)) {
    return { ok: false, error: 'Posición inválida.' }
  }
  const clamp = (value: number) => Math.min(100, Math.max(0, value))
  const { count } = await db.folderNode.updateMany({
    where: { id, userId },
    data: { posX: clamp(posX), posY: clamp(posY) },
  })
  if (count === 0) return { ok: false, error: 'No encontramos el apunte.' }
  // Sin revalidate: el canvas ya lo movió en el cliente.
  return { ok: true }
}

export async function deleteFolderNode(id: string): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(id)) return { ok: false, error: 'No encontramos el apunte.' }
  // Las relaciones del apunte se van con él (ON DELETE CASCADE en folder_edges),
  // pero los apuntes al otro extremo quedan intactos.
  const { count } = await db.folderNode.deleteMany({ where: { id, userId } })
  if (count === 0) return { ok: false, error: 'No encontramos el apunte.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function connectFolderNodes(
  fromId: string,
  toId: string,
  rawKind: string,
): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(fromId) || !isUuid(toId)) return { ok: false, error: 'Apunte inválido.' }
  if (fromId === toId) return { ok: false, error: 'Un apunte no se relaciona consigo mismo.' }

  const kind = kindSchema.safeParse(rawKind)
  if (!kind.success) return { ok: false, error: kind.error.issues[0].message }

  // Los dos tienen que ser del usuario y de la misma materia.
  const nodes = await db.folderNode.findMany({
    where: { id: { in: [fromId, toId] }, userId },
    select: { id: true, subjectId: true },
  })
  if (nodes.length !== 2) return { ok: false, error: 'No encontramos alguno de los apuntes.' }
  if (nodes[0].subjectId !== nodes[1].subjectId) {
    return { ok: false, error: 'Los apuntes son de materias distintas.' }
  }

  // "se relaciona con" es simétrica: se guarda con el id menor primero para no duplicarla.
  const [from, to] = kind.data === 'relates' ? canonicalRelates(fromId, toId) : [fromId, toId]
  const { count } = await db.folderEdge.createMany({
    data: [{ userId, fromId: from, toId: to, kind: kind.data }],
    skipDuplicates: true,
  })
  if (count === 0) return { ok: false, error: 'Esos apuntes ya estaban relacionados así.' }

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function disconnectFolderNodes(edgeId: string): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(edgeId)) return { ok: false, error: 'No encontramos la relación.' }
  const { count } = await db.folderEdge.deleteMany({ where: { id: edgeId, userId } })
  if (count === 0) return { ok: false, error: 'No encontramos la relación.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Búsqueda por título y contenido, para el buscador de la pestaña Carpeta. */
export async function searchFolder(
  subjectId: string,
  query: string,
): Promise<ActionResult<{ results: { id: string; title: string; type: string }[] }>> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(subjectId)) return { ok: false, error: 'No encontramos la materia.' }

  // Solo lectura: alcanza con poder ver la materia.
  const scope = await readScope(userId)
  const subject = await db.subject.findFirst({
    where: { AND: [scope, { id: subjectId }] },
    select: { id: true },
  })
  if (!subject) return { ok: false, error: 'No encontramos la materia.' }

  const results = await searchFolderNodes(userId, subject.id, query)
  return { ok: true, data: { results } }
}
