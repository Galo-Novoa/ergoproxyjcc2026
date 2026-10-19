'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { readScope, writeScope } from '@/lib/authz'
import { isUuid } from '@/lib/data/queries'
import { db } from '@/lib/db'
import { demoModeBlock, getUserId } from '@/lib/session'
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
  const blocked = demoModeBlock()
  if (blocked) return blocked
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
    const scope = await readScope(userId)
    const subject = await db.subject.findFirst({
      where: { AND: [scope, { id: subjectId }] },
      select: { id: true },
    })
    if (!subject) return { ok: false, error: 'No encontramos la materia.' }
    ownedSubjectId = subject.id
  }

  // Los documentos nuevos son privados; compartirlos con una organización es una acción aparte.
  const row = await db.document.create({
    data: { userId, title, contentMd, kind, subjectId: ownedSubjectId },
    select: { id: true },
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id: row.id } }
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(id)) return { ok: false, error: 'No encontramos el documento.' }
  const scope = await writeScope(userId)
  const { count } = await db.document.deleteMany({ where: { AND: [scope, { id }] } })
  if (count === 0) return { ok: false, error: 'No encontramos el documento.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}
