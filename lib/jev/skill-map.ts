import type { FabricSkill } from '@/lib/fabric/config'
import type { JevClassification, JevIntent, JevMaterialKind } from '@/lib/jev/contract'
import { JEV_CONFIDENCE_THRESHOLD } from '@/lib/jev/contract'

/**
 * Mapeo de la intención de Jev a la skill de Fabric que conviene usar al
 * transformar contenido para la Carpeta. Módulo PURO.
 */

/** Skill por defecto según la intención. `null` = no transformar (usar el texto tal cual). */
export const INTENT_TO_SKILL: Record<JevIntent, FabricSkill | null> = {
  theory: 'extract_key_points',
  practice: 'study_steps',
  review: 'extract_concepts',
  organization: 'summarize',
  general: null,
}

/** Etiqueta del material para la Carpeta según la intención. */
export function materialKindFor(classification: JevClassification): JevMaterialKind {
  if (classification.isExercise) return 'practice'
  return classification.intent === 'practice' ? 'practice' : 'theory'
}

export type SkillDecision = {
  skill: FabricSkill | null
  material: JevMaterialKind
  /** true cuando la confianza fue baja y por eso NO se cambió de skill solo. */
  lowConfidence: boolean
  reason: string
}

/**
 * Decide la skill de Fabric a partir de la clasificación. Si la confianza es baja,
 * no se fuerza una skill derivada de la intención: se devuelve `summarize` como
 * transformación conservadora (o `null` para no transformar si el texto ya viene
 * listo). El usuario siempre puede elegir otra skill a mano.
 */
export function decideFabricSkill(
  classification: JevClassification,
  opts?: { threshold?: number; fallbackSkill?: FabricSkill | null },
): SkillDecision {
  const threshold = opts?.threshold ?? JEV_CONFIDENCE_THRESHOLD
  const material = materialKindFor(classification)
  const lowConfidence = classification.confidence < threshold

  if (lowConfidence) {
    // Conservador: una sola pasada de resumen, sin inventar según la intención.
    return {
      skill: opts?.fallbackSkill === undefined ? 'summarize' : opts.fallbackSkill,
      material,
      lowConfidence: true,
      reason: 'Clasificación de baja confianza: se usa una transformación conservadora.',
    }
  }

  return {
    skill: INTENT_TO_SKILL[classification.intent],
    material,
    lowConfidence: false,
    reason: `Intención ${classification.intent} (${classification.evidence.join(', ') || 'sin señales'}).`,
  }
}
