import { describe, expect, it } from 'vitest'
import { classifyText, decayedWeight, tokenOverlap, normalizeText } from '@/lib/study/signals'
import { estimateDifficulty } from '@/lib/study/estimate'
import type { StudyMessage, StudyQuestion, ThemeNode } from '@/lib/study/signals'

const theme = (id: string, title: string, conversationIds: string[] = []): ThemeNode => ({
  id,
  title,
  type: 'concept',
  conversationIds,
})

const msg = (id: string, content: string, opts?: Partial<StudyMessage>): StudyMessage => ({
  id,
  conversationId: 'c1',
  nodeId: 'n1',
  depth: 0,
  content,
  ...opts,
})

describe('normalizeText / classifyText', () => {
  it('normaliza tildes y mayúsculas', () => {
    expect(normalizeText('  No ENTIENDO la Deriváda ')).toBe('no entiendo la derivada')
  })

  it('detecta pedido de aclaración', () => {
    const signals = classifyText('No entiendo, ¿me lo explicás de nuevo?')
    expect(signals.map((s) => s.kind)).toContain('clarification')
  })

  it('detecta dificultad con un ejercicio', () => {
    expect(classifyText('Este ejercicio no me sale').map((s) => s.kind)).toContain(
      'exerciseStruggle',
    )
  })

  it('detecta pedido de repaso', () => {
    expect(classifyText('Quiero repasar integrales').map((s) => s.kind)).toContain(
      'reviewRequest',
    )
  })

  it('no marca señales en un mensaje neutro', () => {
    expect(classifyText('¿Cuál es la derivada de x al cuadrado?')).toEqual([])
  })
})

describe('decayedWeight', () => {
  it('atenúa por distancia con el factor de decaimiento', () => {
    expect(decayedWeight(0, { base: 1, decay: 0.5 })).toBe(1)
    expect(decayedWeight(1, { base: 1, decay: 0.5 })).toBe(0.5)
    expect(decayedWeight(2, { base: 1, decay: 0.5 })).toBe(0.25)
  })

  it('sin decaimiento (1) el peso es constante', () => {
    expect(decayedWeight(5, { base: 1, decay: 1 })).toBe(1)
  })
})

describe('tokenOverlap', () => {
  it('solapa por tokens significativos', () => {
    expect(tokenOverlap('no entiendo la integral por partes', 'Integrales por partes')).toBeGreaterThan(0.6)
  })

  it('no solapa temas distintos', () => {
    expect(tokenOverlap('derivada de un polinomio', 'Integrales por partes')).toBe(0)
  })
})

describe('estimateDifficulty', () => {
  it('prioriza el tema con más preguntas y aclaraciones', () => {
    const themes = [theme('t1', 'Integrales por partes'), theme('t2', 'Límites')]
    const messages = [
      msg('m1', 'no entiendo la integral por partes'),
      msg('m2', 'la integral por partes me da mal'),
      msg('m3', 'como seria la integral por partes otra vez'),
      msg('m4', 'que es un limite'),
    ]
    const scores = estimateDifficulty(themes, messages, [])
    expect(scores[0].theme.id).toBe('t1')
    expect(scores[0].score).toBeGreaterThan(scores[1].score)
    expect(scores[0].reasons.length).toBeGreaterThan(0)
  })

  it('deduplica el mismo mensaje una vez por tema y señal', () => {
    const themes = [theme('t1', 'Integrales por partes')]
    const scores = estimateDifficulty(themes, [msg('m1', 'integrales por partes')], [])
    const byKind = scores[0].byKind
    expect(byKind.question).toBe(1)
  })

  it('atenúa señales de conversaciones ajenas al tema', () => {
    const themes = [
      theme('t1', 'Integrales por partes', ['c1']),
      theme('t2', 'Integrales por partes', ['c2']),
    ]
    const scores = estimateDifficulty(themes, [msg('m1', 'integrales por partes', { conversationId: 'c1' })], [])
    const t1 = scores.find((s) => s.theme.id === 't1')!
    const t2 = scores.find((s) => s.theme.id === 't2')!
    expect(t1.score).toBeGreaterThan(t2.score)
  })

  it('cuenta dudas del mapa con repetición por profundidad', () => {
    const themes = [theme('t1', 'Integrales por partes')]
    const questions: StudyQuestion[] = [
      { id: 'q1', subjectId: 's1', conversationId: 'c1', depth: 0, question: 'integrales por partes' },
      { id: 'q2', subjectId: 's1', conversationId: 'c1', depth: 2, question: 'integrales por partes de nuevo' },
    ]
    const scores = estimateDifficulty(themes, [], questions)
    expect(scores[0].byKind.repetition).toBe(1)
  })

  it('no devuelve temas sin señales', () => {
    const scores = estimateDifficulty([theme('t1', 'Integrales por partes')], [], [])
    expect(scores).toEqual([])
  })
})
