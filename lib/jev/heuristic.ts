import { JEV_NEUTRAL, type JevClassification, type JevIntent } from '@/lib/jev/contract'

/**
 * Heurística de clasificación de Jev, sin LLM. Módulo PURO: se usa como respaldo
 * del clasificador y como base para tests. Es deliberadamente simple y explicable.
 */

export const JEV_HINTS: { intent: JevIntent; patterns: RegExp[] }[] = [
  {
    intent: 'organization',
    patterns: [
      /\bguard(a|á)\b/,
      /\banot(a|á)\b/,
      /\bapuntes?\b/,
      /\bcarpeta\b/,
      /\bresum(i|í|ir|en)\b/,
      /\bordena\b/,
      /\borganiza\b/,
    ],
  },
  {
    intent: 'review',
    patterns: [
      /\brepas(o|ar|emos)\b/,
      /\bpractic(a|ar)\b/,
      /\bpong(a|á)me a prueba\b/,
      /\btom(a|á)me\b/,
      /\bevalu(a|á)me\b/,
      /\bpregunt(a|á)me\b/,
      /\bquiz\b/,
      /\bflashcards?\b/,
      /\btarjetas\b/,
      /\bautoevalu\w*/,
    ],
  },
  {
    intent: 'practice',
    patterns: [
      /\bejercicios?\b/,
      /\bproblemas?\b/,
      /\bresolver\b/,
      /\bresol(u|v)\w*/,
      /\bcalcular\b/,
      /\bcalcu(l|á)\w*/,
      /\bdemostrar\b/,
      /\bhallar\b/,
      /\bencontrar\b/,
      /\bcu[aá]nto vale\b/,
      /\bno me sale\b/,
    ],
  },
  {
    intent: 'theory',
    patterns: [
      /\bqu[eé] es\b/,
      /\bdefinici[oó]n\b/,
      /\bdefin(i|í)\w*/,
      /\bexplic(a|á|ame|arme|ar)\b/,
      /\bteor[ií]a\b/,
      /\bdemostraci[oó]n\b/,
      /\bpor qu[eé]\b/,
      /\bconcepto\b/,
      /\bdiferencia entre\b/,
      /\bsignifica\b/,
    ],
  },
]

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Clasificación por palabras clave. Devuelve la intención con más coincidencias. */
export function heuristicClassify(text: string): JevClassification {
  const normalized = normalize(text)
  const evidence: string[] = []
  let best: { intent: JevIntent; hits: number } = { intent: 'general', hits: 0 }
  for (const { intent, patterns } of JEV_HINTS) {
    let hits = 0
    for (const pattern of patterns) {
      const match = pattern.exec(normalized)
      if (match) {
        hits += 1
        if (evidence.length < 4) evidence.push(match[0])
      }
    }
    if (hits > best.hits) best = { intent, hits }
  }
  if (best.hits === 0) return { ...JEV_NEUTRAL, evidence: [] }
  const confidence = best.hits >= 2 ? 0.6 : 0.45
  return {
    intent: best.intent,
    confidence,
    isExercise: best.intent === 'practice' || normalized.includes('ejercicio'),
    evidence,
  }
}
