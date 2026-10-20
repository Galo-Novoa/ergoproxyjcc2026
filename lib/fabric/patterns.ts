import type { FabricSkill } from '@/lib/fabric/config'

/**
 * Plantillas internas equivalentes a los patterns de Fabric. Se usan cuando no
 * hay servicio externo configurado. El registro se mantiene pequeño y explícito:
 * cada skill es un prompt de sistema + la instrucción de salida.
 */

export type FabricPattern = {
  /** Rol y criterio del transformador. */
  system: string
  /** Qué debe producir, en formato explícito. */
  instruction: string
}

export const FABRIC_PATTERNS: Record<FabricSkill, FabricPattern> = {
  summarize: {
    system:
      'Sos un asistente que resume material de estudio en español rioplatense. Sos fiel al contenido: no agregás datos que no estén en el texto.',
    instruction:
      'Resumí el material de forma fiel y concisa (unos pocos párrafos o una lista breve). Mantené los términos técnicos y las fórmulas tal cual aparecen. No inventes nada que no esté en el texto.',
  },
  summarize_answer: {
    system:
      'Sos un asistente que condensa la explicación de un tutor en un apunte claro, en español rioplatense. No agregás contenido nuevo.',
    instruction:
      'Condensá esta explicación en un apunte breve para estudiar después: las ideas centrales y los pasos, sin relleno ni saludos. No agregues información que no esté en la explicación.',
  },
  extract_concepts: {
    system:
      'Sos un asistente que detecta los conceptos clave de un material de estudio, en español rioplatense.',
    instruction:
      'Extraé los conceptos y definiciones principales como una lista Markdown: un concepto por ítem, con una frase que lo defina usando solo lo que dice el texto.',
  },
  extract_key_points: {
    system:
      'Sos un asistente que arma listas de puntos clave para recordar, en español rioplatense.',
    instruction:
      'Armá una lista de puntos clave para recordar, en Markdown. Cada ítem debe ser una idea concreta y autosuficiente, tomada del texto.',
  },
  study_steps: {
    system:
      'Sos un asistente que convierte una resolución extensa en pasos de estudio ordenados, en español rioplatense.',
    instruction:
      'Transformá esta resolución en pasos de estudio numerados: qué se hizo en cada paso y por qué. No omitas pasos y no agregues pasos que no estén en el texto.',
  },
}

/** Envuelve el texto del usuario para que el modelo lo trate como material, no como órdenes. */
export function wrapFabricInput(text: string): string {
  const safe = text.replace(/<\/?material[^>]*>/gi, '')
  return `<material>\n${safe}\n</material>`
}
