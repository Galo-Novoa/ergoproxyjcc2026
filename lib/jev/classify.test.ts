import { describe, expect, it } from 'vitest'
import { heuristicClassify } from '@/lib/jev/heuristic'
import { decideFabricSkill, INTENT_TO_SKILL, materialKindFor } from '@/lib/jev/skill-map'
import { JEV_NEUTRAL, type JevClassification } from '@/lib/jev/contract'
import { fabricFallbackTransform } from '@/lib/fabric/fallback'

const classification = (over: Partial<JevClassification>): JevClassification => ({
  ...JEV_NEUTRAL,
  ...over,
})

describe('heuristicClassify', () => {
  it('marca organización cuando pide guardar', () => {
    expect(heuristicClassify('guardá esto en la carpeta').intent).toBe('organization')
  })

  it('marca repaso cuando pide practicar', () => {
    expect(heuristicClassify('quiero repasar integrales').intent).toBe('review')
  })

  it('marca práctica cuando hay un ejercicio', () => {
    const result = heuristicClassify('no me sale este ejercicio de límites')
    expect(result.intent).toBe('practice')
    expect(result.isExercise).toBe(true)
  })

  it('marca teoría cuando pide una explicación', () => {
    expect(heuristicClassify('¿qué es la derivada?').intent).toBe('theory')
  })

  it('devuelve general y confianza 0 sin señales', () => {
    const result = heuristicClassify('hola')
    expect(result.intent).toBe('general')
    expect(result.confidence).toBe(0)
  })

  it('sube la confianza con más de una señal', () => {
    const result = heuristicClassify('¿qué es un límite y cuál es su definición?')
    expect(result.confidence).toBeGreaterThan(0.5)
  })
})

describe('skill-map', () => {
  it('mapea cada intención a una skill', () => {
    expect(INTENT_TO_SKILL.theory).toBe('extract_key_points')
    expect(INTENT_TO_SKILL.practice).toBe('study_steps')
    expect(INTENT_TO_SKILL.organization).toBe('summarize')
  })

  it('detecta material práctico si es ejercicio', () => {
    expect(materialKindFor(classification({ intent: 'theory', isExercise: true }))).toBe('practice')
    expect(materialKindFor(classification({ intent: 'theory', isExercise: false }))).toBe('theory')
  })

  it('decide por intención con alta confianza', () => {
    const decision = decideFabricSkill(
      classification({ intent: 'practice', confidence: 0.9, isExercise: true }),
    )
    expect(decision.skill).toBe('study_steps')
    expect(decision.material).toBe('practice')
    expect(decision.lowConfidence).toBe(false)
  })

  it('con baja confianza usa la skill conservadora y marca lowConfidence', () => {
    const decision = decideFabricSkill(
      classification({ intent: 'practice', confidence: 0.2, isExercise: true }),
    )
    expect(decision.skill).toBe('summarize')
    expect(decision.lowConfidence).toBe(true)
  })

  it('respeta un fallbackSkill explícito (incluido null)', () => {
    const decision = decideFabricSkill(
      classification({ intent: 'general', confidence: 0.1 }),
      { fallbackSkill: null },
    )
    expect(decision.skill).toBeNull()
  })
})

describe('fabricFallbackTransform', () => {
  const text = 'Primera oración. Segunda oración. Tercera oración. Cuarta oración. Quinta oración.'

  it('resume tomando las primeras oraciones', () => {
    const out = fabricFallbackTransform('summarize', text)
    expect(out).toContain('Primera oración')
    expect(out).not.toContain('Quinta oración')
  })

  it('extrae conceptos como viñetas', () => {
    const out = fabricFallbackTransform('extract_concepts', text)
    expect(out.split('\n').every((l) => l.startsWith('- '))).toBe(true)
  })

  it('arma pasos numerados', () => {
    const out = fabricFallbackTransform('study_steps', text)
    expect(out.startsWith('1. ')).toBe(true)
  })

  it('devuelve vacío con texto vacío', () => {
    expect(fabricFallbackTransform('summarize', '   ')).toBe('')
  })
})
