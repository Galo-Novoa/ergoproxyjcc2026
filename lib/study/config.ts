/**
 * Parámetros del estimador de dificultad.
 *
 * El puntaje es una SEÑAL APROXIMADA, no una evaluación de capacidad: mide cuánta
 * atención pidió un tema (preguntas, repeticiones, aclaraciones, ejercicios), no
 * cuánto sabe la persona. Todos los valores son configurables.
 *
 * Se usa para priorizar en qué conceptos conviene escribir más al armar la
 * Carpeta. Nunca se le muestra a la persona como una certeza ni se aplica solo:
 * las propuestas de Carpeta siguen pasando por su aprobación.
 */

/** Factor multiplicado por `decay^distancia`. Escala general de todos los pesos. */
export const DIFFICULTY_BASE_WEIGHT = 1

/**
 * Cuánto se atenúa una señal por cada nivel de distancia al tema.
 * 0.5 = a distancia 1 pesa la mitad, a distancia 2 un cuarto, etc.
 * Configurable: 1 = sin decaimiento; más cerca de 0 = solo lo inmediato importa.
 */
export const DIFFICULTY_DECAY = Number(process.env.ACRASIA_DIFFICULTY_DECAY ?? 0.5)

/**
 * Peso de cada tipo de señal. No pretenden ser exactos: se calibran a ojo para
 * que las señales fuertes (dificultad explícita, pedido de repaso) dominen por
 * sobre las débiles (una pregunta suelta).
 */
export const SIGNAL_WEIGHTS = {
  /** Una pregunta del estudiante relacionada con el tema. */
  question: 1,
  /** Cada nivel de profundidad explorado en el árbol de dudas (subpreguntas encadenadas). */
  depth: 0.8,
  /** La misma duda/concepto abordada más de una vez. */
  repetition: 1.2,
  /** Pedido de aclaración o explicación alternativa ("no entiendo", "explicame de nuevo"). */
  clarification: 1.6,
  /** Dificultad explícita en un ejercicio ("no me sale", "me dio mal"). */
  exerciseStruggle: 1.8,
  /** Pedido explícito de repaso ("quiero repasar", "dame otro ejercicio de esto"). */
  reviewRequest: 1.5,
} as const

export type SignalKind = keyof typeof SIGNAL_WEIGHTS

/** Etiquetas legibles por señal, para explicar de dónde sale el puntaje (plural / singular). */
export const SIGNAL_LABELS: Record<SignalKind, { many: string; one: string }> = {
  question: { many: 'preguntas', one: 'pregunta' },
  depth: { many: 'niveles explorados', one: 'nivel explorado' },
  repetition: { many: 'repeticiones', one: 'repetición' },
  clarification: { many: 'pedidos de aclaración', one: 'pedido de aclaración' },
  exerciseStruggle: { many: 'dificultades en ejercicios', one: 'dificultad en ejercicio' },
  reviewRequest: { many: 'pedidos de repaso', one: 'pedido de repaso' },
}

/**
 * Puntaje mínimo para que un tema entre en la lista priorizada que ve el agente.
 * Por debajo, el ruido (una sola pregunta casual) no mueve la aguja.
 */
export const MIN_PRIORITY_SCORE = Number(process.env.ACRASIA_MIN_PRIORITY_SCORE ?? 1.5)

/** Cuántos temas priorizados como máximo se le pasan al agente. */
export const PROMPT_PRIORITY_LIMIT = 12

/**
 * Máximo de mensajes por conversación que se analizan al estimar. Acota el costo
 * en conversaciones largas; prioriza lo más reciente.
 */
export const MAX_MESSAGES_PER_CONVERSATION = 400

/** Máximo de conversaciones de una materia que se analizan. */
export const MAX_CONVERSATIONS_PER_SUBJECT = 50
