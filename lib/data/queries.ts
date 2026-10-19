import 'server-only'
import { and, asc, count, desc, eq, getTableColumns, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
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
  return db
    .select({
      ...getTableColumns(subjects),
      fileCount: sql<number>`(select count(*)::int from files where files."subjectId" = ${subjects.id} and files."userId" = ${userId})`,
      conversationCount: sql<number>`(select count(*)::int from conversations where conversations."subjectId" = ${subjects.id} and conversations."userId" = ${userId})`,
      documentCount: sql<number>`(select count(*)::int from documents where documents."subjectId" = ${subjects.id} and documents."userId" = ${userId})`,
    })
    .from(subjects)
    .where(eq(subjects.userId, userId))
    .orderBy(asc(subjects.name))
}

export async function listSubjectOptions(userId: string) {
  return db
    .select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(eq(subjects.userId, userId))
    .orderBy(asc(subjects.name))
}

export async function getSubject(userId: string, id: string) {
  if (!isUuid(id)) return undefined
  const [row] = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))
  return row
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
