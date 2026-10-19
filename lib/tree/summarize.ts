import 'server-only'

import { generateText } from 'ai'
import { db } from '@/lib/db'
import { getLlmServerConfig } from '@/lib/llm/config'
import { parseRagMetadata } from '@/lib/rag/types'
import { loadBranch } from '@/lib/tree/branch'
import { composeInherited, inheritedSize } from '@/lib/tree/compose'
import {
  INHERITED_COMPACT_CHARS,
  KEEP_RECENT_MESSAGES,
  OWN_COMPACT_CHARS,
  OWN_COMPACT_MESSAGES,
} from '@/lib/tree/config'

type SummaryInput = {
  role: string
  content: string
  metadata?: unknown
}

const SYSTEM = [
  'Resumí una conversación de estudio entre un estudiante y un tutor. El resumen reemplaza al texto en el contexto del modelo, así que no puede perder información útil.',
  'Respondé en español, en Markdown, con estas secciones (omití las que queden vacías): Objetivos, Definiciones y supuestos, Resultados intermedios, Dudas pendientes, Fuentes.',
  'Conservá fórmulas, nombres, valores y pasos clave tal como aparecen. En Fuentes listá los documentos y páginas citados (por ejemplo «apuntes.pdf p. 3»).',
  'No inventes nada que no esté en el texto. Máximo 350 palabras.',
].join('\n')

function citedSources(metadata: unknown) {
  const rag = parseRagMetadata(metadata)
  if (!rag) return ''
  const cited = rag.sources.filter((s) => s.cited)
  if (!cited.length) return ''
  return `\n[Fuentes citadas: ${cited.map((s) => `${s.fileName} p. ${s.pageNumber}`).join(', ')}]`
}

async function summarize(messages: SummaryInput[], previous?: string | null) {
  const transcript = messages
    .map((m) =>
      m.role === 'assistant'
        ? `Tutor: ${m.content}${citedSources(m.metadata)}`
        : `Estudiante: ${m.content}`,
    )
    .join('\n\n')
  const prompt = [
    previous ? `Resumen previo (conservalo y actualizalo):\n${previous}\n` : '',
    `Conversación a resumir:\n${transcript}`,
  ].join('\n')
  const { text } = await generateText({
    model: getLlmServerConfig().model,
    system: SYSTEM,
    prompt,
    timeout: 60_000,
  })
  const summary = text.trim()
  if (!summary) throw new Error('El modelo devolvió un resumen vacío.')
  return summary
}

/**
 * Resume los mensajes PROPIOS de una rama cuando se acumulan demasiados, conservando los más recientes
 * completos. Solo lee mensajes con `nodeId = nodeId`: nunca mezcla ramas hermanas. Los mensajes originales
 * no se tocan, y la actualización falla sin efecto si otro proceso resumió en el medio.
 */
export async function compactOwnContext(nodeId: string, userId: string) {
  try {
    const node = await db.conversationNode.findFirst({
      where: { id: nodeId, userId },
      select: { id: true, contextSummary: true, summaryUpToSeq: true, summaryVersion: true },
    })
    if (!node) return
    const pendingMessages = await db.message.findMany({
      where: {
        nodeId,
        userId,
        role: { in: ['user', 'assistant'] },
        ...(node.summaryUpToSeq !== null ? { seq: { gt: node.summaryUpToSeq } } : {}),
      },
      select: { seq: true, role: true, content: true, metadata: true },
      orderBy: { seq: 'asc' },
    })
    const chars = pendingMessages.reduce((n, m) => n + m.content.length, 0)
    if (chars <= OWN_COMPACT_CHARS && pendingMessages.length <= OWN_COMPACT_MESSAGES) return

    const toSummarize = pendingMessages.slice(0, -KEEP_RECENT_MESSAGES)
    if (!toSummarize.length) return
    const summary = await summarize(toSummarize, node.contextSummary)
    await db.conversationNode.updateMany({
      where: { id: nodeId, userId, summaryVersion: node.summaryVersion },
      data: {
        contextSummary: summary,
        summaryUpToSeq: toSummarize[toSummarize.length - 1].seq,
        summaryVersion: { increment: 1 },
        summaryUpdatedAt: new Date(),
      },
    })
  } catch (error) {
    console.error('[tree] No se pudo compactar la rama:', error instanceof Error ? error.message : error)
  }
}

/**
 * Resume una sola vez el tramo compartido hasta la bifurcación cuando es largo. Ese tramo no cambia
 * nunca (los mensajes anteriores al punto de bifurcación son inmutables), así que no necesita versiones.
 */
export async function ensureInheritedSummary(conversationId: string, userId: string, nodeId: string) {
  try {
    const branch = await loadBranch(conversationId, userId, nodeId)
    const target = branch.path[branch.path.length - 1]
    if (!target || branch.path.length < 2 || target.inheritedSummary) return
    const visible = branch.visible.map((v) => ({ ...v, message: v.message }))
    if (inheritedSize(branch.path, visible) <= INHERITED_COMPACT_CHARS) return

    const inherited = composeInherited(branch.path, visible)
    const rows = new Map(branch.visible.map((v) => [v.message.id, v.message]))
    const previous = inherited.summaries.map((s) => `${s.label}:\n${s.text}`).join('\n\n') || null
    const summary = await summarize(
      inherited.messages.map((m) => ({
        role: m.role,
        content: m.content,
        metadata: rows.get(m.id)?.metadata,
      })),
      previous,
    )
    await db.conversationNode.updateMany({
      where: { id: nodeId, userId, inheritedSummary: null },
      data: { inheritedSummary: summary },
    })
    target.inheritedSummary = summary
  } catch (error) {
    console.error(
      '[tree] No se pudo resumir el contexto heredado:',
      error instanceof Error ? error.message : error,
    )
  }
}
