import 'server-only'

const DEFAULT_MODEL = 'openai/gpt-5.5'

/**
 * Configuración del proveedor de LLM, leída solo en el servidor.
 * Los modelos se invocan por el AI Gateway de Vercel con un id `proveedor/modelo`;
 * la autenticación la resuelve la plataforma, así que no hay claves en el código.
 *
 *   LLM_MODEL  (opcional) id del modelo en formato `proveedor/modelo`
 */
export function getLlmServerConfig() {
  const model = process.env.LLM_MODEL?.trim() || DEFAULT_MODEL
  return { model, configured: true as const }
}

export type LlmStatus = { configured: boolean; model: string | null }

/** Versión segura para pasar a componentes. */
export function getLlmStatus(): LlmStatus {
  const { configured, model } = getLlmServerConfig()
  return { configured, model }
}
