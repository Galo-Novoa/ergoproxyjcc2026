import 'server-only'
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  isNull,
  max,
  sql,
} from 'drizzle-orm'
import { z } from 'zod'
import { getSubjectsRepo } from '@/lib/data/subjects-repo'
import { db } from '@/lib/db'
import { isDatabaseConfigured } from '@/lib/db/config'
import {
  conversations,
  documents,
  files,
  messages,
  questionNodes,
  subjects,
} from '@/lib/db/schema'

// Toda consulta recibe `userId` y lo aplica en el WHERE: no hay RLS en Neon.

const uuid = z.uuid()
export const isUuid = (value: string) => uuid.safeParse(value).success

export async function getOverview(userId: string) {
  const [s, f, c, d, q] = await Promise.all([
    db.select({ n: count() }).from(subjects).where(eq(subjects.userId, userId)),
    db.select({ n: count() }).from(files).where(eq(files.userId, userId)),
    db
      .select({ n: count() })
      .from(conversations)
      .where(eq(conversations.userId, userId)),
    db.select({ n: count() }).from(documents).where(eq(documents.userId, userId)),
    db
      .select({ n: count() })
      .from(questionNodes)
      .where(
        and(eq(questionNodes.userId, userId), eq(questionNodes.status, 'open')),
      ),
  ])
  return {
    subjects: s[0].n,
    files: f[0].n,
    conversations: c[0].n,
    documents: d[0].n,
    openQuestions: q[0].n,
  }
}

export async function listSubjects(userId: string) {
  return getSubjectsRepo().list(userId)
}

/** Resumen del workspace fijo General: lo que todavía no pertenece a ninguna materia. */
export async function getGeneralSummary(userId: string) {
  if (!isDatabaseConfigured) {
    return { fileCount: 0, documentCount: 0, conversationCount: 0, lastActivityAt: null }
  }
  const [f, d, c] = await Promise.all([
    db
      .select({ n: count(), last: max(files.createdAt) })
      .from(files)
      .where(and(eq(files.userId, userId), isNull(files.subjectId))),
    db
      .select({ n: count(), last: max(documents.updatedAt) })
      .from(documents)
      .where(and(eq(documents.userId, userId), isNull(documents.subjectId))),
    db
      .select({ n: count(), last: max(conversations.updatedAt) })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), isNull(conversations.subjectId))),
  ])
  const dates = [f[0].last, d[0].last, c[0].last].filter((v): v is Date => v instanceof Date)
  return {
    fileCount: f[0].n,
    documentCount: d[0].n,
    conversationCount: c[0].n,
    lastActivityAt: dates.length ? new Date(Math.max(...dates.map((x) => x.getTime()))) : null,
  }
}

export async function listGeneralFiles(userId: string) {
  return db
    .select()
    .from(files)
    .where(and(eq(files.userId, userId), isNull(files.subjectId)))
    .orderBy(desc(files.createdAt))
}

export async function listGeneralDocuments(userId: string) {
  return db
    .select({
      id: documents.id,
      title: documents.title,
      kind: documents.kind,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(and(eq(documents.userId, userId), isNull(documents.subjectId)))
    .orderBy(desc(documents.updatedAt))
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&')

/** Búsqueda por nombre/título en todo lo que pertenece a la persona. */
export async function searchAll(userId: string, query: string) {
  const term = query.trim()
  if (!term) return { subjects: [], files: [], documents: [], conversations: [] }
  const pattern = `%${escapeLike(term)}%`

  const matchingSubjects = (await getSubjectsRepo().list(userId)).filter(
    (s) =>
      s.name.toLowerCase().includes(term.toLowerCase()) ||
      (s.code ?? '').toLowerCase().includes(term.toLowerCase()),
  )
  if (!isDatabaseConfigured) {
    return { subjects: matchingSubjects, files: [], documents: [], conversations: [] }
  }

  const [f, d, c] = await Promise.all([
    db
      .select({ id: files.id, name: files.name, subjectId: files.subjectId })
      .from(files)
      .where(and(eq(files.userId, userId), ilike(files.name, pattern)))
      .orderBy(desc(files.createdAt))
      .limit(20),
    db
      .select({ id: documents.id, title: documents.title })
      .from(documents)
      .where(and(eq(documents.userId, userId), ilike(documents.title, pattern)))
      .orderBy(desc(documents.updatedAt))
      .limit(20),
    db
      .select({ id: conversations.id, title: conversations.title })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), ilike(conversations.title, pattern)))
      .orderBy(desc(conversations.updatedAt))
      .limit(20),
  ])
  return { subjects: matchingSubjects, files: f, documents: d, conversations: c }
}

export async function listSubjectOptions(userId: string) {
  return db
    .select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(eq(subjects.userId, userId))
    .orderBy(asc(subjects.name))
}

export async function getSubject(userId: string, id: string) {
  return getSubjectsRepo().get(userId, id)
}

export async function listFiles(userId: string, subjectId?: string) {
  return db
    .select({
      ...getTableColumns(files),
      subjectName: subjects.name,
    })
    .from(files)
    .leftJoin(
      subjects,
      and(eq(files.subjectId, subjects.id), eq(subjects.userId, userId)),
    )
    .where(
      and(
        eq(files.userId, userId),
        subjectId ? eq(files.subjectId, subjectId) : undefined,
      ),
    )
    .orderBy(desc(files.createdAt))
}

export async function listDocuments(userId: string, subjectId?: string) {
  return db
    .select({
      id: documents.id,
      title: documents.title,
      kind: documents.kind,
      subjectId: documents.subjectId,
      updatedAt: documents.updatedAt,
      subjectName: subjects.name,
    })
    .from(documents)
    .leftJoin(
      subjects,
      and(eq(documents.subjectId, subjects.id), eq(subjects.userId, userId)),
    )
    .where(
      and(
        eq(documents.userId, userId),
        subjectId ? eq(documents.subjectId, subjectId) : undefined,
      ),
    )
    .orderBy(desc(documents.updatedAt))
}

export async function getDocument(userId: string, id: string) {
  if (!isUuid(id)) return undefined
  const [row] = await db
    .select({
      ...getTableColumns(documents),
      subjectName: subjects.name,
    })
    .from(documents)
    .leftJoin(
      subjects,
      and(eq(documents.subjectId, subjects.id), eq(subjects.userId, userId)),
    )
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
  return row
}

export async function listConversations(userId: string, subjectId?: string) {
  return db
    .select({
      ...getTableColumns(conversations),
      subjectName: subjects.name,
      messageCount: sql<number>`(select count(*)::int from messages where messages."conversationId" = ${conversations.id} and messages."userId" = ${userId})`,
    })
    .from(conversations)
    .leftJoin(
      subjects,
      and(eq(conversations.subjectId, subjects.id), eq(subjects.userId, userId)),
    )
    .where(
      and(
        eq(conversations.userId, userId),
        subjectId ? eq(conversations.subjectId, subjectId) : undefined,
      ),
    )
    .orderBy(desc(conversations.updatedAt))
}

export async function getConversationWithMessages(userId: string, id: string) {
  if (!isUuid(id)) return undefined
  const [conversation] = await db
    .select({
      ...getTableColumns(conversations),
      subjectName: subjects.name,
    })
    .from(conversations)
    .leftJoin(
      subjects,
      and(eq(conversations.subjectId, subjects.id), eq(subjects.userId, userId)),
    )
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
  if (!conversation) return undefined

  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, id), eq(messages.userId, userId)))
    .orderBy(asc(messages.createdAt))

  return { conversation, messages: rows }
}

export async function listQuestionNodes(userId: string, subjectId?: string) {
  return db
    .select()
    .from(questionNodes)
    .where(
      and(
        eq(questionNodes.userId, userId),
        subjectId ? eq(questionNodes.subjectId, subjectId) : undefined,
      ),
    )
    .orderBy(asc(questionNodes.createdAt))
}

export type SubjectWithCounts = Awaited<ReturnType<typeof listSubjects>>[number]
export type FileRow = Awaited<ReturnType<typeof listFiles>>[number]
export type DocumentRow = Awaited<ReturnType<typeof listDocuments>>[number]
export type ConversationRow = Awaited<
  ReturnType<typeof listConversations>
>[number]
