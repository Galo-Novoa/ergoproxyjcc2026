/**
 * Agrega las señales crudas en un puntaje de dificultad por tema, con la lista
 * de razones que lo explican. Módulo PURO.
 *
 * Reglas de agregación:
 * - Cada mensaje/duda aporta a cada tema con el que se relaciona, pero cuenta UNA
 *   sola vez por tema y tipo de señal (dedupe por `subjectRef`), para que un
 *   mensaje mencionado repetidas veces no infle el puntaje.
 * - El peso se atenúa por la distancia al tema: `base × decaimiento^distancia`.
 * - Las personas señales (aclaración, repaso, dificultad) se registran con su
 *   fragmento para poder mostrar «por qué» este tema aparece arriba.
 */

import {
  DIFFICULTY_BASE_WEIGHT,
  DIFFICULTY_DECAY,
  SIGNAL_LABELS,
  SIGNAL_WEIGHTS,
  type SignalKind,
} from '@/lib/study/config'
import {
  classifyText,
  themesForText,
  THEME_MATCH_THRESHOLD,
  type StudyMessage,
  type StudyQuestion,
  type ThemeNode,
} from '@/lib/study/signals'

/** Una contribución concreta a un tema, ya deduplicada. */
type Contribution = {
  kind: SignalKind
  /** Identificador único de la fuente (mensaje o duda) para deduplicar. */
  ref: string
  weight: number
  /** Fragmento que disparó la señal, si aplica. */
  matched?: string
}

export type ThemeScore = {
  theme: ThemeNode
  score: number
  /** Cantidad de fuentes distintas que aportaron. */
  signals: number
  reasons: string[]
  byKind: Partial<Record<SignalKind, number>>
}

export type EstimateOptions = {
  base?: number
  decay?: number
}

function distance(theme: ThemeNode, conversationId: string | null, depth: number): number {
  // Si el tema ya está ligado a esta conversación, cuenta como cercano; si no,
  // se atenúa adicionalmente por el hecho de venir de otra sesión.
  const sameConversation = conversationId != null && theme.conversationIds.includes(conversationId)
  return depth + (sameConversation ? 0 : 1)
}

function addContribution(
  bucket: Map<string, Contribution>,
  contribution: Contribution,
) {
  // Dedupe por tipo + fuente: el mismo mensaje no se cuenta dos veces, pero
  // fuentes distintas del mismo tipo SÍ acumulan (dos preguntas sobre el mismo
  // tema pesan más que una). La clave es `${kind}:${ref}`.
  bucket.set(`${contribution.kind}:${contribution.ref}`, contribution)
}

function summarizeReasons(byKind: Partial<Record<SignalKind, number>>): string[] {
  const reasons: string[] = []
  const order: SignalKind[] = [
    'clarification',
    'exerciseStruggle',
    'reviewRequest',
    'repetition',
    'depth',
    'question',
  ]
  for (const kind of order) {
    const count = byKind[kind]
    if (!count) continue
    const labels = SIGNAL_LABELS[kind]
    reasons.push(count === 1 ? `1 ${labels.one}` : `${count} ${labels.many}`)
  }
  return reasons
}

/**
 * Calcula el puntaje de dificultad de cada tema a partir de los mensajes y dudas
 * disponibles. Los temas sin señales no se devuelven.
 */
export function estimateDifficulty(
  themes: ThemeNode[],
  messages: StudyMessage[],
  questions: StudyQuestion[],
  opts?: EstimateOptions,
): ThemeScore[] {
  const base = opts?.base ?? DIFFICULTY_BASE_WEIGHT
  const decay = opts?.decay ?? DIFFICULTY_DECAY
  const weight = (distance: number) => base * Math.pow(decay, Math.max(0, distance))

  const buckets = new Map<string, Map<string, Contribution>>()
  for (const theme of themes) buckets.set(theme.id, new Map())

  const themeById = new Map(themes.map((t) => [t.id, t]))

  // Mensajes del estudiante.
  for (const msg of messages) {
    const matchedThemes = themesForText(msg.content, themes)
    if (!matchedThemes.length) continue
    const textSignals = classifyText(msg.content)
    for (const theme of matchedThemes) {
      const bucket = buckets.get(theme.id)!
      const dist = distance(theme, msg.conversationId, msg.depth)
      addContribution(bucket, {
        kind: 'question',
        ref: msg.id,
        weight: weight(dist),
      })
      if (msg.depth > 0) {
        addContribution(bucket, {
          kind: 'depth',
          ref: `${msg.id}:depth`,
          weight: weight(dist) * (SIGNAL_WEIGHTS.depth / SIGNAL_WEIGHTS.question),
        })
      }
      for (const s of textSignals) {
        addContribution(bucket, {
          kind: s.kind,
          ref: `${msg.id}:${s.kind}`,
          weight:
            weight(dist) * (SIGNAL_WEIGHTS[s.kind] / SIGNAL_WEIGHTS.question),
          matched: s.matched,
        })
      }
    }
  }

  // Nodos del mapa de dudas.
  for (const q of questions) {
    const matchedThemes = themesForText(q.question, themes)
    if (!matchedThemes.length) continue
    // Una duda repetida sobre el mismo tema ya es señal de dificultad.
    for (const theme of matchedThemes) {
      if (!themeById.has(theme.id)) continue
      const bucket = buckets.get(theme.id)!
      const dist = distance(theme, q.conversationId, q.depth)
      addContribution(bucket, {
        kind: 'question',
        ref: `q:${q.id}`,
        weight: weight(dist) * 0.5,
      })
      if (q.depth > 0) {
        addContribution(bucket, {
          kind: 'depth',
          ref: `q:${q.id}:depth`,
          weight: weight(dist) * 0.5 * (SIGNAL_WEIGHTS.depth / SIGNAL_WEIGHTS.question),
        })
      }
      if (q.depth > 0) {
        addContribution(bucket, {
          kind: 'repetition',
          ref: `q:${q.id}:rep`,
          weight: weight(dist) * 0.5 * (SIGNAL_WEIGHTS.repetition / SIGNAL_WEIGHTS.question),
        })
      }
    }
  }

  const results: ThemeScore[] = []
  for (const theme of themes) {
    const bucket = buckets.get(theme.id)!
    if (!bucket.size) continue
    let score = 0
    let signals = 0
    const byKind: Partial<Record<SignalKind, number>> = {}
    for (const contribution of bucket.values()) {
      score += contribution.weight
      signals += 1
      byKind[contribution.kind] = (byKind[contribution.kind] ?? 0) + 1
    }
    if (score <= 0) continue
    results.push({
      theme,
      score: Math.round(score * 100) / 100,
      signals,
      reasons: summarizeReasons(byKind),
      byKind,
    })
  }

  return results.sort((a, b) => b.score - a.score)
}
