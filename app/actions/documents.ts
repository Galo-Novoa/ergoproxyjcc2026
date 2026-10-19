'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isUuid } from '@/lib/data/queries'
import { db } from '@/lib/db'
import { documents, subjects } from '@/lib/db/schema'
import { getUserId } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

const documentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Ingresá un título.')
    .max(160, 'El título admite hasta 160 caracteres.'),
  contentMd: z.string().max(50_000, 'El contenido es demasiado largo.'),
  kind: z.enum(['note', 'summary']),
  subjectId: z.string(),
})

export async function createDocument(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getUserId()
  const parsed = documentSchema.safeParse({
    title: formData.get('title') ?? '',
    contentMd: formData.get('contentMd') ?? '',
    kind: formData.get('kind') ?? 'note',
    subjectId: formData.get('subjectId') ?? 'none',
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { title, contentMd, kind, subjectId } = parsed.data
  let ownedSubjectId: string | null = null
  if (subjectId !== 'none') {
    if (!isUuid(subjectId)) return { ok: false, error: 'Materia inválida.' }
    const [subject] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    if (!subject) return { ok: false, error: 'No encontramos la materia.' }
    ownedSubjectId = subject.id
  }

  const [row] = await db
    .insert(documents)
    .values({ userId, title, contentMd, kind, subjectId: ownedSubjectId })
    .returning({ id: documents.id })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id: row.id } }
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  const userId = await getUserId()
  const deleted = await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .returning({ id: documents.id })
  if (deleted.length === 0) return { ok: false, error: 'No encontramos el documento.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}
