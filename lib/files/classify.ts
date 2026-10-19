import type { FileKind } from './constants'

type Signal = { label: string; pattern: RegExp; weight: number; kind: FileKind }

// Los patrones corren sobre texto en minúsculas y sin tildes.
const SIGNALS: Signal[] = [
  // Práctica: consignas y evaluaciones.
  { label: 'ejercicio', pattern: /\bejercicios?\b/g, weight: 1, kind: 'practice' },
  { label: 'problema', pattern: /\bproblemas?\b/g, weight: 1, kind: 'practice' },
  { label: 'consigna', pattern: /\bconsignas?\b/g, weight: 2, kind: 'practice' },
  { label: 'se pide', pattern: /\bse pide\b/g, weight: 2, kind: 'practice' },
  {
    label: 'verbos de consigna',
    pattern:
      /\b(resolver|resuelva|resuelve|calcule|calcular|determine|determinar|halle|hallar|justifique|justificar|encuentre|encontrar|indique|indicar|grafique|graficar|verifique|verificar)\b/g,
    weight: 1,
    kind: 'practice',
  },
  {
    label: 'parcial / examen',
    pattern:
      /\b(parcial|recuperatorio|examen|evaluacion|final|trabajo practico|guia de (ejercicios|practica|trabajos))\b/g,
    weight: 3,
    kind: 'practice',
  },
  { label: 'ítems numerados', pattern: /^\s*(\d{1,2}[).]|[a-e]\))\s+\S/gm, weight: 0.5, kind: 'practice' },

  // Teoría: definiciones y desarrollo conceptual.
  { label: 'definición', pattern: /\bdefinici(on|ones)\b/g, weight: 3, kind: 'theory' },
  { label: 'teorema', pattern: /\b(teorema|lema|corolario|proposicion|axioma)s?\b/g, weight: 3, kind: 'theory' },
  { label: 'demostración', pattern: /\bdemostracion(es)?\b/g, weight: 3, kind: 'theory' },
  {
    label: 'fórmulas de definición',
    pattern: /\b(se llama|se denomina|se dice que|decimos que|por definicion|se define)\b/g,
    weight: 2,
    kind: 'theory',
  },
  {
    label: 'conceptos',
    pattern: /\b(concepto|propiedad(es)?|caracteristicas?|introduccion|capitulo|clasificacion)\b/g,
    weight: 1,
    kind: 'theory',
  },
  { label: 'ejemplo', pattern: /\bejemplos?\b/g, weight: 0.5, kind: 'theory' },
]

const FILENAME_HINTS: { pattern: RegExp; kind: FileKind; label: string }[] = [
  { pattern: /\b(tp|practic|guia|ejercicio|parcial|final|examen|recuperatorio)/, kind: 'practice', label: 'práctica' },
  { pattern: /\b(teoria|teorico|apunte|resumen|clase|capitulo|unidad|libro)/, kind: 'theory', label: 'teoría' },
]

// Mínimo de puntaje total y proporción para animarse a sugerir; si no, se deja sin clasificar.
const MIN_TOTAL_SCORE = 8
const MIN_DOMINANCE = 0.65
const MAX_SAMPLED_CHARS = 250_000

export type Classification = {
  kind: FileKind | null
  reason: string
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Sugerencia heurística (no definitiva) de si un PDF es teoría o práctica,
 * según su nombre y el texto de sus páginas. Devuelve `kind: null` cuando las
 * señales son pocas o están mezcladas, para que decida la persona.
 */
export function classifyDocument(fileName: string, pageTexts: string[]): Classification {
  const text = normalize(pageTexts.join('\n').slice(0, MAX_SAMPLED_CHARS))
  const name = normalize(fileName.replace(/\.pdf$/i, '').replace(/[_\-.]+/g, ' '))

  const score: Record<FileKind, number> = { theory: 0, practice: 0 }
  const topSignals: Record<FileKind, { label: string; points: number }[]> = {
    theory: [],
    practice: [],
  }

  for (const signal of SIGNALS) {
    const matches = text.match(signal.pattern)?.length ?? 0
    if (matches === 0) continue
    const points = matches * signal.weight
    score[signal.kind] += points
    topSignals[signal.kind].push({ label: signal.label, points })
  }

  const nameHints: string[] = []
  for (const hint of FILENAME_HINTS) {
    if (hint.pattern.test(name)) {
      score[hint.kind] += 6
      nameHints.push(hint.label)
    }
  }

  const total = score.theory + score.practice
  if (total < MIN_TOTAL_SCORE) {
    return { kind: null, reason: 'Hay pocas señales para decidir: elegí el tipo a mano.' }
  }

  const kind: FileKind = score.practice >= score.theory ? 'practice' : 'theory'
  const dominance = score[kind] / total
  if (dominance < MIN_DOMINANCE) {
    return {
      kind: null,
      reason: 'El contenido mezcla teoría y práctica: elegí el tipo a mano.',
    }
  }

  const evidence = topSignals[kind]
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((s) => s.label)
  if (nameHints.length > 0 && nameHints.includes(kind === 'practice' ? 'práctica' : 'teoría')) {
    evidence.unshift('el nombre del archivo')
  }

  return {
    kind,
    reason: `Sugerido por ${evidence.join(', ')}. Podés cambiarlo.`,
  }
}
