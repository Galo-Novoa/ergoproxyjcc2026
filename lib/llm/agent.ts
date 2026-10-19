import 'server-only'

import { APICallError, generateText, NoObjectGeneratedError, Output, RetryError, type LanguageModel } from 'ai'
import { getLlmFallback, getLlmServerConfig } from '@/lib/llm/config'
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
import { buildRagPrompt } from '@/lib/rag/prompt'
import type { RetrievalResult } from '@/lib/rag/retrieve'
import type { LabeledText } from '@/lib/tree/compose'
import { ALIAS_MAX, MAX_PROPOSALS_PER_MESSAGE } from '@/lib/tree/config'

export type BranchPromptInfo = {
  alias: string
  topic: string
  isRoot: boolean
  summaries: LabeledText[]
  existingChildAliases: string[]
  /** false cuando ya se alcanzó el tope de ramas o de profundidad. */
  canPropose: boolean
  truncated: boolean
}

export type AgentResult = { response: AgentResponse; metadata: MessageMetadata }

const MODE_GUIDANCE: Record<ConversationMode, string> = {
  theory:
    'Modo Teoría: explicá conceptos, definiciones y demostraciones con rigor, y enlazá las ideas entre sí.',
  practice:
    'Modo Práctica: guiá la resolución de ejercicios paso a paso, pedí que el estudiante intente y corregí sin dar todo resuelto de entrada.',
  free: 'Modo Libre: respondé de forma flexible según lo que pregunte el estudiante.',
}

function buildBranchPrompt(branch: BranchPromptInfo) {
  const lines = [
    `Esta conversación es un árbol de ramas independientes. Estás en la rama «${branch.alias}»${
      branch.isRoot ? ' (la inicial)' : ` (tema: ${branch.topic})`
    }. Solo conocés esta rama y lo que heredó de sus ancestros hasta el punto de bifurcación; no sabés qué se habló en otras ramas.`,
  ]
  if (branch.summaries.length) {
    lines.push(
      'Contexto resumido de la rama (reemplaza a los mensajes más antiguos; tomalo como cierto):',
      ...branch.summaries.map((s) => `### ${s.label}\n${s.text}`),
    )
  }
  if (branch.truncated) {
    lines.push('Parte del historial más antiguo no está disponible; no asumas lo que no figure arriba.')
  }
  if (branch.existingChildAliases.length) {
    lines.push(`Ramas que ya salen de esta: ${branch.existingChildAliases.map((a) => `«${a}»`).join(', ')}. No las repitas.`)
  }
  return lines.join('\n')
}

function buildSystemPrompt(
  mode: ConversationMode,
  branch: BranchPromptInfo,
  rag: RetrievalResult | undefined,
) {
  return [
    'Sos un tutor para estudiantes de ingeniería y ciencias exactas de la FCEIA (UNR). Respondé en español rioplatense, con claridad y paso a paso.',
    MODE_GUIDANCE[mode],
    'Tu respuesta es un objeto JSON con cuatro campos:',
    '- output: el texto visible para el estudiante, en Markdown (podés usar listas, tablas y bloques de código).',
    '- description: alias corto (2 a 5 palabras, máximo 80 caracteres) del concepto o problema específico tratado, por ejemplo «Sustitución en integrales». Nunca copies la pregunta completa.',
    '- grounding: "documents", "mixed", "general" o "insufficient" según cuánto de la respuesta se apoya en los documentos del estudiante (criterios abajo). Sin fragmentos de documentos, usá "general" o "insufficient".',
    branch.canPropose
      ? `- actions: lista de acciones PROPUESTAS; casi siempre debe estar vacía. Proponé ramas solo cuando la respuesta descompone la pregunta en subproblemas claramente distintos que conviene explorar por separado (por ejemplo, la definición que se usa y un paso del cálculo) o cuando el estudiante cambia de tema. Máximo ${MAX_PROPOSALS_PER_MESSAGE} por respuesta, nunca una por cada mensaje, y ninguna que repita lo que ya explicaste.`
      : '- actions: dejala vacía; esta conversación ya no admite más ramas.',
    `Única acción disponible: {"type":"propose_history_branch","alias":<alias de hasta ${ALIAS_MAX} caracteres>,"description":<tema específico de la rama>}. Las acciones son propuestas: el estudiante decide si las abre.`,
    buildBranchPrompt(branch),
    rag ? buildRagPrompt(rag) : '',
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
        grounding: lenient.data.grounding ?? 'general',
        actions: valid,
      },
      dropped,
      kind: 'extracted_json',
    }
  }

  // Si el texto parece un JSON roto, no se lo muestra tal cual al estudiante.
  if (json !== undefined || /^\s*[{[]/.test(stripFences(text))) return null

  return {
    response: { output: text, description: null, grounding: 'general', actions: [] },
    dropped: 0,
    kind: 'plain_text',
  }
}

export class AgentError extends Error {}

function providerStatus(error: unknown): number | undefined {
  const cause = RetryError.isInstance(error) ? error.lastError : error
  return APICallError.isInstance(cause) ? cause.statusCode : undefined
}

export async function runAgent({
  mode,
  branch,
  history,
  rag,
}: {
  mode: ConversationMode
  branch: BranchPromptInfo
  history: { role: 'user' | 'assistant'; content: string }[]
  rag?: RetrievalResult
}): Promise<AgentResult> {
  const config = getLlmServerConfig()
  const system = buildSystemPrompt(mode, branch, rag)

  const generate = (model: LanguageModel) =>
    generateText({
      model,
      system,
      messages: history,
      output: Output.object({ schema: agentResponseSchema }),
      timeout: 60_000,
    })

  let { modelId } = config

  try {
    let result
    try {
      result = await generate(config.model)
    } catch (error) {
      const status = providerStatus(error)
      const fallback = [401, 402, 403].includes(status ?? 0) ? getLlmFallback(config.provider) : null
      if (!fallback) throw error
      console.error(`[llm] ${config.provider} rechazó la clave (HTTP ${status}); se usa ${fallback.provider}.`)
      modelId = fallback.modelId
      result = await generate(fallback.model)
    }
    const { output, description, grounding, actions } = result.output
    return {
      response: { output, description, grounding, actions },
      metadata: { model: modelId, recovery: 'none', droppedActions: 0 },
    }
  } catch (error) {
    const cause = RetryError.isInstance(error) ? error.lastError : error
    console.error(
      '[llm] Falló la generación:',
      cause instanceof Error ? cause.message : cause,
      APICallError.isInstance(cause) ? `(HTTP ${cause.statusCode}) ${cause.responseBody?.slice(0, 500)}` : '',
    )
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
