import 'server-only'

/**
 * Configuración del proveedor de LLM, leída solo en el servidor.
 * La clave nunca sale de este módulo: a la UI solo se le expone el estado.
 *
 *   LLM_API_KEY   clave del proveedor
 *   LLM_MODEL     identificador del modelo
 *   LLM_BASE_URL  (opcional) endpoint compatible con la API de OpenAI
 */
export function getLlmServerConfig() {
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL
  const baseUrl = process.env.LLM_BASE_URL
  return { apiKey, model, baseUrl, configured: Boolean(apiKey && model) }
}

export type LlmStatus = { configured: boolean; model: string | null }

/** Versión segura para pasar a componentes: sin claves ni URLs. */
export function getLlmStatus(): LlmStatus {
  const { configured, model } = getLlmServerConfig()
  return { configured, model: configured ? (model ?? null) : null }
}
