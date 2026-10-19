'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  conversations,
  documents,
  files,
  questionNodes,
  subjects,
} from '@/lib/db/schema'
import { getUserId } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

const subjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Ingresá el nombre de la materia.')
    .max(120, 'El nombre admite hasta 120 caracteres.'),
  code: z.string().trim().max(20, 'El código admite hasta 20 caracteres.'),
  description: z
    .string()
    .trim()
    .max(500, 'La descripción admite hasta 500 caracteres.'),
})

function parseSubject(formData: FormData) {
  return subjectSchema.safeParse({
    name: formData.get('name') ?? '',
    code: formData.get('code') ?? '',
    description: formData.get('description') ?? '',
  })
}

export async function createSubject(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getUserId()
  const parsed = parseSubject(formData)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { name, code, description } = parsed.data
  const [row] = await db
    .insert(subjects)
    .values({
      userId,
      name,
      code: code || null,
      description: description || null,
    })
    .returning({ id: subjects.id })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id: row.id } }
}

export async function updateSubject(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await getUserId()
  const parsed = parseSubject(formData)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { name, code, description } = parsed.data
  const updated = await db
    .update(subjects)
    .set({
      name,
      code: code || null,
      description: description || null,
      updatedAt: new Date(),
    })
    .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))
    .returning({ id: subjects.id })

  if (updated.length === 0) return { ok: false, error: 'No encontramos la materia.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function deleteSubject(id: string): Promise<ActionResult> {
  const userId = await getUserId()

  // Sin FK: se desvinculan los elementos de la materia para no dejar huérfanos.
  const deleted = await db.transaction(async (tx) => {
    const owned = and(eq(subjects.id, id), eq(subjects.userId, userId))
    const [found] = await tx.select({ id: subjects.id }).from(subjects).where(owned)
    if (!found) return false

    await tx
      .update(files)
      .set({ subjectId: null })
      .where(and(eq(files.subjectId, id), eq(files.userId, userId)))
    await tx
      .update(documents)
      .set({ subjectId: null })
      .where(and(eq(documents.subjectId, id), eq(documents.userId, userId)))
    await tx
      .update(conversations)
      .set({ subjectId: null })
      .where(and(eq(conversations.subjectId, id), eq(conversations.userId, userId)))
    await tx
      .update(questionNodes)
      .set({ subjectId: null })
      .where(and(eq(questionNodes.subjectId, id), eq(questionNodes.userId, userId)))
    await tx.delete(subjects).where(owned)
    return true
  })

  if (!deleted) return { ok: false, error: 'No encontramos la materia.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}
