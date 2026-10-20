import 'server-only'

import { generateText, NoObjectGeneratedError, Output } from 'ai'
import { getLlmServerConfig } from '@/lib/llm/config'
import {
  jevLenientSchema,
  jevSchema,
  JEV_INTENTS,
  JEV_INTENT_LABELS,
  JEV_NEUTRAL,
  type JevClassification,
} from '@/lib/jev/contract'
import { heuristicClassify } from '@/lib/jev/heuristic'

/**
 * Clasificador Jev. Primero intenta con el LLM (salida estructurada) y, si no hay
 * modelo o falla, cae a una heurística léxica. Nunca lanza: siempre devuelve una
 * clasificación (como mínimo la neutra).
 */

const SYSTEM = [
  'Sos Jev, un clasificador de intención de consultas de estudio. No respondés la consulta: solo la clasificás.',
  'Intenciones posibles:',
  `- theory (${JEV_INTENT_LABELS.theory}): pide explicación de un concepto, una definición o una demostración.`,
  `- practice (${JEV_INTENT_LABELS.practice}): pide resolver o entender cómo se resuelve un ejercicio o problema.`,
  `- review (${JEV_INTENT_LABELS.review}): pide practicar, repasar, autoevaluarse o poner a prueba lo que sabe.`,
  `- organization (${JEV_INTENT_LABELS.organization}): pide guardar, ordenar, resumir o actualizar apuntes/conceptos.`,
  `- general (${JEV_INTENT_LABELS.general}): no encaja en las anteriores.`,
  'Devolvé: intent, confidence (0 a 1), isExercise (true si lo tratado es un ejercicio concreto) y evidence (frases breves del mensaje que justifican la decisión).',
  'Si el mensaje es ambiguo o muy corto, bajá la confianza en vez de adivinar.',
].join('\n')

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced ? fenced[1] : text).trim()
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s)
    } catch {
      return undefined
    }
  }
  const direct = tryParse(candidate)
  if (direct !== undefined) return direct
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  return start !== -1 && end > start ? tryParse(candidate.slice(start, end + 1)) : undefined
}

function coerce(raw: unknown): JevClassification | null {
  const lenient = jevLenientSchema.safeParse(raw)
  if (!lenient.success || !lenient.data.intent) return null
  return {
    intent: lenient.data.intent,
    confidence: typeof lenient.data.confidence === 'number' ? lenient.data.confidence : 0.5,
    isExercise: lenient.data.isExercise === true,
    evidence: Array.isArray(lenient.data.evidence)
      ? lenient.data.evidence.filter((e): e is string => typeof e === 'string').slice(0, 6)
      : [],
  }
}

/**
 * Clasifica un mensaje. `context` es opcional (p. ej. la pregunta anterior de la
 * rama) para desambiguar repreguntas cortas.
 */
export async function classifyIntent(text: string, context?: string): Promise<JevClassification> {
  const trimmed = text.trim()
  if (!trimmed) return JEV_NEUTRAL

  try {
    const { model } = getLlmServerConfig()
    const input = context ? `Contexto previo: ${context}\n\nMensaje: ${trimmed}` : trimmed
    const result = await generateText({
      model,
      system: SYSTEM,
      messages: [{ role: 'user', content: input }],
      output: Output.object({ schema: jevSchema }),
      timeout: 30_000,
    })
    const parsed = jevSchema.safeParse(result.output)
    if (parsed.success) return parsed.data
    return coerce(result.output) ?? heuristicClassify(trimmed)
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const recovered = coerce(extractJson(error.text ?? ''))
      if (recovered) return recovered
    }
    // Sin LLM o error del proveedor: heurística. Nunca interrumpe el flujo del chat.
    return heuristicClassify(trimmed)
  }
}

export { JEV_INTENTS }
