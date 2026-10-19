import 'server-only'
import { and, asc, eq, getTableColumns, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { isDatabaseConfigured } from '@/lib/db/config'
import {
  conversations,
  documents,
  files,
  questionNodes,
  subjects,
} from '@/lib/db/schema'

// Dos adaptadores con la misma interfaz: Postgres (Neon) y memoria para el modo demo.
// Toda operación recibe `userId` y lo aplica: no hay RLS en Neon.

export type SubjectRecord = {
  id: string
  name: string
  code: string | null
  description: string | null
  color: string
  icon: string
  createdAt: Date
  updatedAt: Date
}

export type SubjectSummary = SubjectRecord & {
  fileCount: number
  conversationCount: number
  documentCount: number
  lastActivityAt: Date
}

export type SubjectInput = {
  name: string
  code: string | null
  description: string | null
  color: string
  icon: string
}

export interface SubjectsRepo {
  list(userId: string): Promise<SubjectSummary[]>
  get(userId: string, id: string): Promise<SubjectRecord | undefined>
  create(userId: string, input: SubjectInput): Promise<{ id: string }>
  createMany(userId: string, inputs: SubjectInput[]): Promise<number>
  update(userId: string, id: string, input: SubjectInput): Promise<boolean>
  remove(userId: string, id: string): Promise<boolean>
}

const uuid = z.uuid()

// --- Postgres --------------------------------------------------------------

// Drizzle entrega los timestamps crudos como string; se interpretan como UTC igual que sus columnas.
const asDate = (value: unknown) =>
  value instanceof Date ? value : new Date(`${String(value)}+0000`)

const postgresRepo: SubjectsRepo = {
  async list(userId) {
    return db
      .select({
        ...getTableColumns(subjects),
        fileCount: sql<number>`(select count(*)::int from files where files."subjectId" = ${subjects.id} and files."userId" = ${userId})`,
        conversationCount: sql<number>`(select count(*)::int from conversations where conversations."subjectId" = ${subjects.id} and conversations."userId" = ${userId})`,
        documentCount: sql<number>`(select count(*)::int from documents where documents."subjectId" = ${subjects.id} and documents."userId" = ${userId})`,
        lastActivityAt: sql<Date>`greatest(
          ${subjects.updatedAt},
          (select max(files."createdAt") from files where files."subjectId" = ${subjects.id} and files."userId" = ${userId}),
          (select max(conversations."updatedAt") from conversations where conversations."subjectId" = ${subjects.id} and conversations."userId" = ${userId}),
          (select max(documents."updatedAt") from documents where documents."subjectId" = ${subjects.id} and documents."userId" = ${userId})
        )`.mapWith(asDate),
      })
      .from(subjects)
      .where(eq(subjects.userId, userId))
      .orderBy(asc(subjects.name))
  },

  async get(userId, id) {
    if (!uuid.safeParse(id).success) return undefined
    const [row] = await db
      .select()
      .from(subjects)
      .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))
    return row
  },

  async create(userId, input) {
    const [row] = await db
      .insert(subjects)
      .values({ userId, ...input })
      .returning({ id: subjects.id })
    return row
  },

  async createMany(userId, inputs) {
    if (inputs.length === 0) return 0
    const rows = await db
      .insert(subjects)
      .values(inputs.map((input) => ({ userId, ...input })))
      .returning({ id: subjects.id })
    return rows.length
  },

  async update(userId, id, input) {
    if (!uuid.safeParse(id).success) return false
    const updated = await db
      .update(subjects)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))
      .returning({ id: subjects.id })
    return updated.length > 0
  },

  async remove(userId, id) {
    if (!uuid.safeParse(id).success) return false
    // Sin FK: se desvinculan los elementos para que pasen a General y no queden huérfanos.
    return db.transaction(async (tx) => {
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
  },
}

// --- Demo (memoria) --------------------------------------------------------
// Arranca vacío: solo guarda lo que la persona crea durante la sesión del servidor.

const globalForDemo = globalThis as unknown as {
  demoSubjects?: Map<string, SubjectRecord & { userId: string }>
}
const demoStore = (globalForDemo.demoSubjects ??= new Map())

const demoRepo: SubjectsRepo = {
  async list(userId) {
    return [...demoStore.values()]
      .filter((s) => s.userId === userId)
      .map(({ userId: _userId, ...s }) => ({
        ...s,
        fileCount: 0,
        conversationCount: 0,
        documentCount: 0,
        lastActivityAt: s.updatedAt,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  },

  async get(userId, id) {
    const found = demoStore.get(id)
    if (!found || found.userId !== userId) return undefined
    const { userId: _userId, ...record } = found
    return record
  },

  async create(userId, input) {
    const id = crypto.randomUUID()
    const now = new Date()
    demoStore.set(id, { id, userId, ...input, createdAt: now, updatedAt: now })
    return { id }
  },

  async createMany(userId, inputs) {
    for (const input of inputs) await demoRepo.create(userId, input)
    return inputs.length
  },

  async update(userId, id, input) {
    const found = demoStore.get(id)
    if (!found || found.userId !== userId) return false
    demoStore.set(id, { ...found, ...input, updatedAt: new Date() })
    return true
  },

  async remove(userId, id) {
    const found = demoStore.get(id)
    if (!found || found.userId !== userId) return false
    return demoStore.delete(id)
  },
}

export function getSubjectsRepo(): SubjectsRepo {
  return isDatabaseConfigured ? postgresRepo : demoRepo
}
