import 'server-only'

import { db } from '@/lib/db'
import { isDatabaseConfigured } from '@/lib/db/config'
import { DIFFICULTY_DECAY, MAX_CONVERSATIONS_PER_SUBJECT, MAX_MESSAGES_PER_CONVERSATION, MIN_PRIORITY_SCORE, PROMPT_PRIORITY_LIMIT } from '@/lib/study/config'
import { estimateDifficulty, type ThemeScore } from '@/lib/study/estimate'
import type { StudyMessage, StudyQuestion, ThemeNode } from '@/lib/study/signals'

/**
 * Carga las señales reales de una materia y devuelve los temas de su Carpeta
 * ordenados por dificultad estimada. Es de solo lectura: no escribe nada.
 *
 * Es una SEÑAL para priorizar el armado de la Carpeta, no una verdad: el agente
 * la usa como pista y todo lo que proponga sigue pasando por aprobación.
 */

/** Documento plano que se le pasa al prompt: qué priorizar y por qué. */
export type StudyPriority = {
  nodeId: string
  title: string
  type: string
  score: number
  reasons: string[]
}

function depthByParent(rows: { id: string; parentId: string | null }[]): Map<string, number> {
  const parentOf = new Map(rows.map((r) => [r.id, r.parentId]))
  const depth = new Map<string, number>()
  const resolve = (id: string): number => {
    const cached = depth.get(id)
    if (cached !== undefined) return cached
    const parent = parentOf.get(id)
    if (!parent) {
      depth.set(id, 0)
      return 0
    }
    const d = resolve(parent) + 1
    depth.set(id, d)
    return d
  }
  for (const r of rows) resolve(r.id)
  return depth
}

async function loadThemes(userId: string, subjectId: string | null): Promise<ThemeNode[]> {
  const nodes = await db.folderNode.findMany({
    where: { userId, subjectId },
    select: {
      id: true,
      title: true,
      type: true,
      sources: { select: { conversationId: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return nodes.map((n) => ({
    id: n.id,
    title: n.title,
    type: n.type,
    conversationIds: [
      ...new Set(n.sources.map((s) => s.conversationId).filter((c): c is string => Boolean(c))),
    ],
  }))
}

async function loadSignals(
  userId: string,
  subjectId: string | null,
): Promise<{ messages: StudyMessage[]; questions: StudyQuestion[] }> {
  const conversations = await db.conversation.findMany({
    where: { userId, subjectId },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    take: MAX_CONVERSATIONS_PER_SUBJECT,
  })
  const conversationIds = conversations.map((c) => c.id)

  const [messageRows, questionRows] = await Promise.all([
    conversationIds.length
      ? db.message.findMany({
          where: { userId, role: 'user', conversationId: { in: conversationIds } },
          select: { id: true, conversationId: true, nodeId: true, content: true, seq: true },
          orderBy: { seq: 'desc' },
          take: MAX_MESSAGES_PER_CONVERSATION * conversationIds.length,
        })
      : Promise.resolve([]),
    db.questionNode.findMany({
      where: { userId, subjectId },
      select: { id: true, subjectId: true, conversationId: true, parentId: true, question: true },
    }),
  ])

  // Profundidad de la rama en la que se escribió cada mensaje.
  const nodeRows = conversationIds.length
    ? await db.conversationNode.findMany({
        where: { userId, conversationId: { in: conversationIds } },
        select: { id: true, parentId: true },
      })
    : []
  const nodeDepth = depthByParent(nodeRows)

  const messages: StudyMessage[] = messageRows.map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    nodeId: m.nodeId,
    depth: m.nodeId ? (nodeDepth.get(m.nodeId) ?? 0) : 0,
    content: m.content,
  }))

  const questionDepth = depthByParent(questionRows)
  const questions: StudyQuestion[] = questionRows.map((q) => ({
    id: q.id,
    subjectId: q.subjectId,
    conversationId: q.conversationId,
    depth: questionDepth.get(q.id) ?? 0,
    question: q.question,
  }))

  return { messages, questions }
}

/**
 * Temas de la materia priorizados por dificultad. Vacío si la Carpeta no tiene
 * apuntes todavía o si nada supera el umbral (una sola pregunta casual no mueve
 * la aguja).
 */
export async function getStudyPriorities(
  userId: string,
  subjectId: string | null,
): Promise<ThemeScore[]> {
  if (!isDatabaseConfigured) return []
  const themes = await loadThemes(userId, subjectId)
  if (!themes.length) return []
  const { messages, questions } = await loadSignals(userId, subjectId)
  if (!messages.length && !questions.length) return []
  return estimateDifficulty(themes, messages, questions, { decay: DIFFICULTY_DECAY }).filter(
    (t) => t.score >= MIN_PRIORITY_SCORE,
  )
}

/** Versión compacta que se inyecta en el prompt del agente. */
export async function getStudyPrioritiesForPrompt(
  userId: string,
  subjectId: string | null,
): Promise<StudyPriority[]> {
  const scores = await getStudyPriorities(userId, subjectId)
  return scores.slice(0, PROMPT_PRIORITY_LIMIT).map((s) => ({
    nodeId: s.theme.id,
    title: s.theme.title,
    type: s.theme.type,
    score: s.score,
    reasons: s.reasons,
  }))
}
