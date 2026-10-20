/**
 * Extracción de señales de dificultad. Módulo PURO: no toca la base ni el LLM,
 * así se puede testear con datos sintéticos y la heurística queda auditable.
 *
 * Idea: cada mensaje del estudiante y cada nodo de su mapa de dudas son una
 * señal. Un concepto pedido muchas veces, en varios niveles y con pedidos de
 * aclaración o repaso, pesa más que una pregunta suelta. La distancia al tema
 * atenúa el peso (`base × decaimiento^distancia`), y cada mensaje cuenta UNA
 * sola vez aunque toque varios temas (evita sumar dos veces el mismo mensaje).
 */

import {
  DIFFICULTY_BASE_WEIGHT,
  DIFFICULTY_DECAY,
  SIGNAL_WEIGHTS,
  type SignalKind,
} from '@/lib/study/config'

/** Un mensaje del estudiante, con la rama y profundidad en que fue escrito. */
export type StudyMessage = {
  id: string
  conversationId: string
  /** Rama del árbol de la conversación; null si quedó sin asignar. */
  nodeId: string | null
  /** Profundidad de la rama dentro de la conversación (0 = raíz). */
  depth: number
  content: string
}

/** Un nodo del mapa de dudas, con su profundidad en el árbol de dudas. */
export type StudyQuestion = {
  id: string
  subjectId: string | null
  conversationId: string | null
  depth: number
  question: string
}

/** Un concepto temático de la Carpeta al que se le puede asociar dificultad. */
export type ThemeNode = {
  id: string
  title: string
  type: string
  /** Ids de conversación de los que ya salió este tema (para asociarlo a sus sesiones). */
  conversationIds: string[]
}

/** Señal cruda detectada en un texto: qué tipo y qué frase la disparó (para explicar). */
export type TextSignal = {
  kind: Exclude<SignalKind, 'question' | 'depth' | 'repetition'>
  /** Fragmento que matcheó, tal cual aparece (para mostrar «por qué»). */
  matched: string
}

// --- Clasificación léxica explicable -----------------------------------------
// Cada regla es un patrón simple sobre el texto normalizado. La intención es que
// sea transparente y corregible, no un clasificador caja negra.

type Rule = { kind: TextSignal['kind']; pattern: RegExp }

const RULES: Rule[] = [
  // Dificultad explícita en un ejercicio.
  {
    kind: 'exerciseStruggle',
    pattern:
      /\b(no me sale|no lo puedo resolver|no puedo resolver|me dio mal|me da mal|no me da|lo hice mal|me equivoque|no entiendo el ejercicio|no entiendo como resolver|me trabe|no se como empezar)\b/,
  },
  // Pedido de repaso.
  {
    kind: 'reviewRequest',
    pattern:
      /\b(quiero repasar|necesito repasar|repasemos|repasar esto|dame otro ejercicio|otro ejercicio de|mas ejercicios|practicar mas|otra practica)\b/,
  },
  // Pedido de aclaración o explicación alternativa.
  {
    kind: 'clarification',
    pattern:
      /\b(no entiendo|no me queda claro|no me cierra|explicame (de nuevo|otra vez|mejor|mas)|otra explicacion|de otra forma|de otra manera|podes explicar(me)? (de nuevo|otra vez|mejor|mas)|como seria|no sigo (el paso|el razonamiento)|me perdi|a que te referis|no comprendo)\b/,
  },
]

/** Normaliza para matchear: minúsculas, sin tildes, espacios simples. */
export function normalizeText(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Clasifica un texto buscando señales de aclaración, dificultad o repaso.
 * Devuelve todas las que matcheen (un mensaje puede pedir aclaración Y repaso),
 * con el fragmento que las disparó.
 */
export function classifyText(text: string): TextSignal[] {
  const normalized = normalizeText(text)
  if (!normalized) return []
  const found: TextSignal[] = []
  for (const rule of RULES) {
    const match = rule.pattern.exec(normalized)
    if (match) found.push({ kind: rule.kind, matched: match[0] })
  }
  return found
}

// --- Distancia y decaimiento -------------------------------------------------

/** Peso de una señal a una distancia dada del tema. */
export function decayedWeight(distance: number, opts?: { base?: number; decay?: number }) {
  const base = opts?.base ?? DIFFICULTY_BASE_WEIGHT
  const decay = opts?.decay ?? DIFFICULTY_DECAY
  return base * Math.pow(decay, Math.max(0, distance))
}

// --- Asociación señal ↔ tema -------------------------------------------------
// Un texto "trata" un tema si comparte tokens significativos con su título.
// Se reutiliza la misma noción de similitud que el resto de la Carpeta para no
// introducir otro criterio de matching.

const STOPWORDS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'y',
  'e',
  'o',
  'en',
  'un',
  'una',
  'al',
  'a',
  'para',
  'por',
  'con',
  'que',
  'como',
  'es',
  'son',
  'se',
  'su',
])

function stem(token: string): string {
  // Stemming muy liviano, sólo para que singular y plural se reconozcan como el
  // mismo término (integral/integrales, limite/limites). No pretende ser exacto.
  let t = token
  if (t.length > 4 && t.endsWith('es')) t = t.slice(0, -2)
  else if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1)
  if (t.length > 3 && t.endsWith('e')) t = t.slice(0, -1)
  return t
}

function tokens(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(' ')
      .filter((t) => t.length > 2 && !STOPWORDS.has(t))
      .map(stem),
  )
}

/**
 * Cuánto se solapa un texto con el título de un tema: intersección sobre el
 * mínimo de tamaños, para no castigar títulos largos. 0 = sin relación.
 */
export function tokenOverlap(text: string, title: string) {
  const a = tokens(text)
  const b = tokens(title)
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const t of a) if (b.has(t)) shared += 1
  return shared / Math.min(a.size, b.size)
}

/** Umbral desde el cual un texto se considera "sobre" un tema. */
export const THEME_MATCH_THRESHOLD = 0.4

/**
 * Devuelve los temas con los que un texto se relaciona. Si un texto no matchea
 * ninguno, no se descarta: queda "sin tema" y lo agrupa `estimate.ts` por sus
 * propias palabras clave (para no perder señal de temas que todavía no son un
 * apunte de la Carpeta).
 */
export function themesForText(text: string, themes: ThemeNode[]): ThemeNode[] {
  const hits: { theme: ThemeNode; score: number }[] = []
  for (const theme of themes) {
    const score = tokenOverlap(text, theme.title)
    if (score >= THEME_MATCH_THRESHOLD) hits.push({ theme, score })
  }
  // Un texto puede tocar varios temas: se lo asigna a todos con su peso, pero el
  // dedupe por mensaje de estimate.ts asegura que cuente una sola vez por tema.
  return hits.map((h) => h.theme)
}
