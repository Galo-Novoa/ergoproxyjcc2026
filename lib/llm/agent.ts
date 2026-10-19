import 'server-only'

import { generateText, NoObjectGeneratedError, Output } from 'ai'
import { getLlmServerConfig } from '@/lib/llm/config'
import {
  agentActionSchema,
  agentResponseSchema,
  lenientResponseSchema,
  MODE_LABELS,
  type AgentActionProposal,
  type AgentResponse,
  type ConversationMode,
  type MessageMetadata,
  type RecoveryKind,
} from '@/lib/llm/contract'

export type KnownNode = { id: string; question: string }

export type AgentResult = { response: AgentResponse; metadata: MessageMetadata }

const MODE_GUIDANCE: Record<ConversationMode, string> = {
  theory:
    'Modo Teoría: explicá conceptos, definiciones y demostraciones con rigor, y enlazá las ideas entre sí.',
  practice:
    'Modo Práctica: guiá la resolución de ejercicios paso a paso, pedí que el estudiante intente y corregí sin dar todo resuelto de entrada.',
  free: 'Modo Libre: respondé de forma flexible según lo que pregunte el estudiante.',
}

function buildSystemPrompt(mode: ConversationMode, nodes: KnownNode[]) {
  const nodeList = nodes.length
    ? nodes.map((n) => `- ${n.id}: ${n.question}`).join('\n')
    : '(todavía no hay nodos)'

  return [
    'Sos un tutor para estudiantes de ingeniería y ciencias exactas de la FCEIA (UNR). Respondé en español rioplatense, con claridad y paso a paso.',
    MODE_GUIDANCE[mode],
    'Tu respuesta es un objeto JSON con tres campos:',
    '- output: el texto visible para el estudiante, en Markdown (podés usar listas, tablas y bloques de código).',
    '- description: alias corto (2 a 5 palabras, máximo 80 caracteres) del concepto o problema específico tratado, por ejemplo «Sustitución en integrales». Nunca copies la pregunta completa.',
    '- actions: lista de acciones PROPUESTAS; casi siempre debe estar vacía. Solo proponé una rama cuando la respuesta abre un subtema que merece su propio nodo en el mapa de dudas.',
    'Única acción disponible: {"type":"propose_history_branch","parent_node_id":<id de la lista o null>,"title":<alias corto>,"description":<tema específico de la rama>}.',
    'Usá en parent_node_id solo un id de la lista de nodos existentes, o null. Nunca inventes ids. Las acciones son propuestas: el estudiante decide si las acepta.',
    'Nodos existentes del mapa de dudas:',
    nodeList,
  ].join('\n')
}

function stripFences(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fenced ? fenced[1] : text).trim()
}

function extractJson(text: string): unknown {
  const candidate = stripFences(text)
  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start === -1 || end <= start) return undefined
    try {
      return JSON.parse(candidate.slice(start, end + 1))
    } catch {
      return undefined
    }
  }
}

/** Valida cada acción por separado: las inválidas se descartan, nunca se ejecutan. */
function validateActions(raw: unknown[]) {
  const valid: AgentActionProposal[] = []
  let dropped = 0
  for (const item of raw) {
    const parsed = agentActionSchema.safeParse(item)
    if (parsed.success) valid.push(parsed.data)
    else dropped += 1
  }
  return { valid, dropped }
}

/** Recupera una respuesta cuando el proveedor no cumplió el esquema. Devuelve null si no hay texto utilizable. */
function recover(
  rawText: string | undefined,
): { response: AgentResponse; dropped: number; kind: RecoveryKind } | null {
  const text = rawText?.trim()
  if (!text) return null

  const json = extractJson(text)
  const lenient = lenientResponseSchema.safeParse(json)
  if (lenient.success) {
    const { valid, dropped } = validateActions(lenient.data.actions ?? [])
    return {
      response: {
        output: lenient.data.output,
        description: lenient.data.description ?? null,
        actions: valid,
      },
      dropped,
      kind: 'extracted_json',
    }
  }

  // Si el texto parece un JSON roto, no se lo muestra tal cual al estudiante.
  if (json !== undefined || /^\s*[{[]/.test(stripFences(text))) return null

  return { response: { output: text, description: null, actions: [] }, dropped: 0, kind: 'plain_text' }
}

export class AgentError extends Error {}

export async function runAgent({
  mode,
  nodes,
  history,
}: {
  mode: ConversationMode
  nodes: KnownNode[]
  history: { role: 'user' | 'assistant'; content: string }[]
}): Promise<AgentResult> {
  const { model, modelId } = getLlmServerConfig()

  try {
    const result = await generateText({
      model,
      system: buildSystemPrompt(mode, nodes),
      messages: history,
      output: Output.object({ schema: agentResponseSchema }),
      timeout: 60_000,
    })
    const { output, description, actions } = result.output
    return {
      response: { output, description, actions },
      metadata: { model: modelId, recovery: 'none', droppedActions: 0 },
    }
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const recovered = recover(error.text)
      if (recovered) {
        return {
          response: recovered.response,
          metadata: { model: modelId, recovery: recovered.kind, droppedActions: recovered.dropped },
        }
      }
      throw new AgentError('El modelo devolvió una respuesta que no pudimos interpretar. Probá de nuevo.')
    }
    throw new AgentError('No pudimos comunicarnos con el modelo de lenguaje. Probá de nuevo en unos minutos.')
  }
}

export { MODE_LABELS }
