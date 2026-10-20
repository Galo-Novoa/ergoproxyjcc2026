'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { readScope } from '@/lib/authz'
import { isUuid } from '@/lib/data/queries'
import { nextNodePosition } from '@/lib/data/tree-layout'
import { db } from '@/lib/db'
import { demoModeBlock, getUserId } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

const questionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'Escribí la duda.')
    .max(500, 'La duda admite hasta 500 caracteres.'),
  subjectId: z.string(),
  parentId: z.string(),
})

export async function createQuestion(formData: FormData): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  const parsed = questionSchema.safeParse({
    question: formData.get('question') ?? '',
    subjectId: formData.get('subjectId') ?? 'none',
    parentId: formData.get('parentId') ?? 'none',
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const { question, subjectId, parentId } = parsed.data

  let ownedSubjectId: string | null = null
  if (subjectId !== 'none') {
    if (!isUuid(subjectId)) return { ok: false, error: 'Materia inválida.' }
    const scope = await readScope(userId)
    const subject = await db.subject.findFirst({
      where: { AND: [scope, { id: subjectId }] },
      select: { id: true },
    })
    if (!subject) return { ok: false, error: 'No encontramos la materia.' }
    ownedSubjectId = subject.id
  }

  let ownedParentId: string | null = null
  let parentPosition: { posX: number; posY: number } | null = null
  if (parentId !== 'none') {
    if (!isUuid(parentId)) return { ok: false, error: 'Duda padre inválida.' }
    const parent = await db.questionNode.findFirst({
      where: { id: parentId, userId },
      select: { id: true, subjectId: true, posX: true, posY: true },
    })
    if (!parent) return { ok: false, error: 'No encontramos la duda padre.' }
    ownedParentId = parent.id
    ownedSubjectId = ownedSubjectId ?? parent.subjectId
    parentPosition = { posX: parent.posX, posY: parent.posY }
  }

  const siblingCount = await db.questionNode.count({
    where: ownedParentId
      ? { userId, parentId: ownedParentId }
      : { userId, parentId: null, subjectId: ownedSubjectId },
  })
  const position = nextNodePosition({ parent: parentPosition, siblingCount })

  await db.questionNode.create({
    data: {
      userId,
      question,
      subjectId: ownedSubjectId,
      parentId: ownedParentId,
      ...position,
    },
  })

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function setQuestionStatus(
  id: string,
  status: 'open' | 'resolved',
): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(id)) return { ok: false, error: 'No encontramos la duda.' }
  const { count } = await db.questionNode.updateMany({
    where: { id, userId },
    data: { status },
  })
  if (count === 0) return { ok: false, error: 'No encontramos la duda.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function deleteQuestion(id: string): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(id)) return { ok: false, error: 'No encontramos la duda.' }
  // Las dudas hijas pasan a ser raíces (ON DELETE SET NULL en parentId): no quedan huérfanas.
  const { count } = await db.questionNode.deleteMany({ where: { id, userId } })
  if (count === 0) return { ok: false, error: 'No encontramos la duda.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Guarda la posición de un nodo en el canvas del mapa de dudas. Las coordenadas son porcentajes. */
export async function moveQuestionNode(
  id: string,
  posX: number,
  posY: number,
): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(id)) return { ok: false, error: 'No encontramos la duda.' }
  if (!Number.isFinite(posX) || !Number.isFinite(posY)) {
    return { ok: false, error: 'Posición inválida.' }
  }
  const clamp = (value: number) => Math.min(100, Math.max(0, value))
  const { count } = await db.questionNode.updateMany({
    where: { id, userId },
    data: { posX: clamp(posX), posY: clamp(posY) },
  })
  if (count === 0) return { ok: false, error: 'No encontramos la duda.' }
  // Sin revalidate: el canvas ya movió el nodo en el cliente y un refresh lo haría saltar.
  return { ok: true }
}
