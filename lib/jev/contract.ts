import { z } from 'zod'

/**
 * Jev: clasificador de intención del mensaje del estudiante.
 *
 * Devuelve una intención, un nivel de confianza y los parámetros que el orquestador
 * necesita para elegir la skill de Fabric y, cuando aplica, si el tema es teórico o
 * práctico a la hora de armar la Carpeta.
 *
 * IMPORTANTE: Jev NO cambia el modo de la conversación ni pisa una elección explícita
 * del estudiante. Solo aporta una pista para elegir la transformación de contenido.
 */

export const JEV_INTENTS = ['theory', 'practice', 'review', 'organization', 'general'] as const
export type JevIntent = (typeof JEV_INTENTS)[number]

export const JEV_INTENT_LABELS: Record<JevIntent, string> = {
  theory: 'Teoría',
  practice: 'Práctica',
  review: 'Repaso',
  organization: 'Organización',
  general: 'General',
}

export const isJevIntent = (value: string): value is JevIntent =>
  (JEV_INTENTS as readonly string[]).includes(value)

/** Intención del material: sirve para etiquetar el apunte de la Carpeta. */
export const JEV_MATERIAL_KINDS = ['theory', 'practice'] as const
export type JevMaterialKind = (typeof JEV_MATERIAL_KINDS)[number]

export const jevSchema = z.object({
  intent: z.enum(JEV_INTENTS),
  /** 0 a 1. Por debajo del umbral, el orquestador no cambia nada por su cuenta. */
  confidence: z.number().min(0).max(1),
  /** true si el tema tratado es más bien práctico (un ejercicio) que teórico. */
  isExercise: z.boolean().default(false),
  /** Señales legibles que justifican la clasificación (para auditar y mostrar). */
  evidence: z.array(z.string().trim().min(1).max(120)).max(6).default([]),
})

export type JevClassification = z.infer<typeof jevSchema>

/** Esquema tolerante para recuperar JSON crudo del proveedor. */
export const jevLenientSchema = z.object({
  intent: z.enum(JEV_INTENTS).nullish(),
  confidence: z.number().min(0).max(1).nullish(),
  isExercise: z.boolean().nullish(),
  evidence: z.array(z.unknown()).nullish(),
})

/**
 * Debajo de este umbral se considera "clasificación de baja confianza": el
 * orquestador conserva el comportamiento previo en vez de cambiar de skill solo.
 */
export const JEV_CONFIDENCE_THRESHOLD = Number(process.env.JEV_CONFIDENCE_THRESHOLD ?? 0.5)

/** Clasificación neutra: no altera nada. */
export const JEV_NEUTRAL: JevClassification = {
  intent: 'general',
  confidence: 0,
  isExercise: false,
  evidence: [],
}
