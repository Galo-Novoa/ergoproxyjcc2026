/**
 * Fabric: capa de "skills" (patrones de prompt reutilizables) para transformar
 * texto —resumir, extraer conceptos, armar pasos de estudio, etc.—.
 *
 * Se inspira en el proyecto Fabric (danielmiessler/fabric), que expone estos
 * flujos como "patterns" y, opcionalmente, como servicio REST (`fabric --serve`).
 *
 * Estrategia de integración (desacoplada):
 *   1. Si `FABRIC_URL` está definida, se usa el servicio externo real vía
 *      `POST /chat` con `patternName`.
 *   2. Si no, se ejecutan PLANTILLAS INTERNAS equivalentes con el LLM de la app.
 *   3. Si no hay LLM disponible, se usa una transformación determinística.
 *
 * Las tres rutas devuelven el mismo tipo, así que cambiar de backend no toca al
 * resto del código.
 */

/** Skills que el proyecto usa. Los nombres coinciden con patterns de Fabric cuando existen. */
export const FABRIC_SKILLS = [
  'summarize',
  'summarize_answer',
  'extract_concepts',
  'extract_key_points',
  'study_steps',
] as const
export type FabricSkill = (typeof FABRIC_SKILLS)[number]

export const FABRIC_SKILL_LABELS: Record<FabricSkill, string> = {
  summarize: 'Resumir',
  summarize_answer: 'Resumir la respuesta',
  extract_concepts: 'Extraer conceptos',
  extract_key_points: 'Puntos clave',
  study_steps: 'Pasos de estudio',
}

export const isFabricSkill = (value: string): value is FabricSkill =>
  (FABRIC_SKILLS as readonly string[]).includes(value)

/** Nombre del patrón externo en Fabric (por si difiere del interno). */
export const FABRIC_EXTERNAL_PATTERNS: Record<FabricSkill, string> = {
  summarize: 'summarize',
  summarize_answer: 'summarize',
  extract_concepts: 'extract_wisdom',
  extract_key_points: 'extract_wisdom',
  study_steps: 'create_study_steps',
}

/** De dónde salió el texto transformado (para mostrarlo y para trazabilidad). */
export type FabricBackend = 'external' | 'internal' | 'fallback'

export const FABRIC_BACKEND_LABELS: Record<FabricBackend, string> = {
  external: 'Fabric (servicio)',
  internal: 'Fabric (plantilla interna)',
  fallback: 'Recorte automático',
}

export const FABRIC_MAX_INPUT = 12_000
export const FABRIC_MAX_OUTPUT = 6_000

/** Configuración del servicio externo, leída solo en el servidor. */
export type FabricExternalConfig = { url: string; apiKey: string | null; vendor: string; model: string }

export function getFabricExternalConfig(): FabricExternalConfig | null {
  const url = process.env.FABRIC_URL?.trim()
  if (!url) return null
  return {
    url: url.replace(/\/$/, ''),
    apiKey: process.env.FABRIC_API_KEY?.trim() || null,
    vendor: process.env.FABRIC_VENDOR?.trim() || 'openai',
    model: process.env.FABRIC_MODEL?.trim() || 'gpt-4o-mini',
  }
}

/** Configuración con la que se resuelve un request (para exponerla en la UI/registro). */
export function fabricBackendHint(): FabricBackend {
  return getFabricExternalConfig() ? 'external' : 'internal'
}
