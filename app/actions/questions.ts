'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isUuid } from '@/lib/data/queries'
import { db } from '@/lib/db'
import { questionNodes, subjects } from '@/lib/db/schema'
import { getUserId } from '@/lib/session'
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
    const [s] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    if (!s) return { ok: false, error: 'No encontramos la materia.' }
    ownedSubjectId = s.id
  }

  let ownedParentId: string | null = null
  if (parentId !== 'none') {
    if (!isUuid(parentId)) return { ok: false, error: 'Duda padre inválida.' }
    const [p] = await db
      .select({ id: questionNodes.id, subjectId: questionNodes.subjectId })
      .from(questionNodes)
      .where(and(eq(questionNodes.id, parentId), eq(questionNodes.userId, userId)))
    if (!p) return { ok: false, error: 'No encontramos la duda padre.' }
    ownedParentId = p.id
    ownedSubjectId = ownedSubjectId ?? p.subjectId
  }

  await db.insert(questionNodes).values({
    userId,
    question,
    subjectId: ownedSubjectId,
    parentId: ownedParentId,
  })

  revalidatePath('/map')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function setQuestionStatus(
  id: string,
  status: 'open' | 'resolved',
): Promise<ActionResult> {
  const userId = await getUserId()
  const updated = await db
    .update(questionNodes)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(questionNodes.id, id), eq(questionNodes.userId, userId)))
    .returning({ id: questionNodes.id })
  if (updated.length === 0) return { ok: false, error: 'No encontramos la duda.' }
  revalidatePath('/map')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function deleteQuestion(id: string): Promise<ActionResult> {
  const userId = await getUserId()
  const removed = await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(questionNodes)
      .where(and(eq(questionNodes.id, id), eq(questionNodes.userId, userId)))
      .returning({ id: questionNodes.id })
    if (deleted.length === 0) return false
    // Las dudas hijas pasan a ser raíces para no quedar huérfanas.
    await tx
      .update(questionNodes)
      .set({ parentId: null })
      .where(and(eq(questionNodes.parentId, id), eq(questionNodes.userId, userId)))
    return true
  })
  if (!removed) return { ok: false, error: 'No encontramos la duda.' }
  revalidatePath('/map')
  revalidatePath('/', 'layout')
  return { ok: true }
}
