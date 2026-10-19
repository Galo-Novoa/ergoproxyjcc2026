'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { isUuid } from '@/lib/data/queries'
import { db } from '@/lib/db'
import { conversations, messages, subjects } from '@/lib/db/schema'
import { getUserId } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

export async function createConversation(
  subjectId?: string,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getUserId()

  let ownedSubjectId: string | null = null
  if (subjectId && subjectId !== 'none') {
    if (!isUuid(subjectId)) return { ok: false, error: 'Materia inválida.' }
    const [subject] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    if (!subject) return { ok: false, error: 'No encontramos la materia.' }
    ownedSubjectId = subject.id
  }

  const [row] = await db
    .insert(conversations)
    .values({ userId, subjectId: ownedSubjectId })
    .returning({ id: conversations.id })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id: row.id } }
}

export async function deleteConversation(id: string): Promise<ActionResult> {
  const userId = await getUserId()
  const deleted = await db.transaction(async (tx) => {
    const removed = await tx
      .delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning({ id: conversations.id })
    if (removed.length === 0) return false
    await tx
      .delete(messages)
      .where(and(eq(messages.conversationId, id), eq(messages.userId, userId)))
    return true
  })
  if (!deleted) return { ok: false, error: 'No encontramos la conversación.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}
