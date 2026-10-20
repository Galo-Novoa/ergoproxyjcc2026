'use server'

import { revalidatePath } from 'next/cache'
import { readScope } from '@/lib/authz'
import { isUuid } from '@/lib/data/queries'
import { db } from '@/lib/db'
import { isDatabaseConfigured } from '@/lib/db/config'
import { getUserId } from '@/lib/session'
import type { ActionResult } from '@/lib/types'
const DEMO_ERROR =
  'Modo demo: esto necesita una base de datos conectada. Por ahora solo podés crear materias.'


export async function createConversation(
  subjectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!isDatabaseConfigured) return { ok: false, error: DEMO_ERROR }
  const userId = await getUserId()

  let ownedSubjectId: string | null = null
  if (subjectId && subjectId !== 'none') {
    if (!isUuid(subjectId)) return { ok: false, error: 'Materia inválida.' }
    const scope = await readScope(userId)
    const subject = await db.subject.findFirst({
      where: { AND: [scope, { id: subjectId }] },
      select: { id: true },
    })
    if (!subject) return { ok: false, error: 'No encontramos la materia.' }
    ownedSubjectId = subject.id
  }

  const row = await db.conversation.create({
    data: { userId, subjectId: ownedSubjectId, mode: 'free' },
    select: { id: true },
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id: row.id } }
}

export async function deleteConversation(id: string): Promise<ActionResult> {
  if (!isDatabaseConfigured) return { ok: false, error: DEMO_ERROR }
  const userId = await getUserId()
  if (!isUuid(id)) return { ok: false, error: 'No encontramos la conversación.' }
  // Los mensajes se borran solos (ON DELETE CASCADE) y las dudas ligadas conservan su texto.
  const { count } = await db.conversation.deleteMany({ where: { id, userId } })
  if (count === 0) return { ok: false, error: 'No encontramos la conversación.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}
