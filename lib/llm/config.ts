import 'server-only'

import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

const GATEWAY_DEFAULT_MODEL = 'openai/gpt-5.5'
const OPENCODE_DEFAULT_MODEL = 'big-pickle'
const OPENCODE_BASE_URL = 'https://opencode.ai/zen/v1'

/**
 * Configuración del proveedor de LLM, leída solo en el servidor.
 *
 *   OPENCODE_API_KEY  si está definida, se usa OpenCode Zen (endpoint compatible con OpenAI)
 *   LLM_MODEL         (opcional) id del modelo. Con OpenCode Zen es p. ej. `big-pickle`;
 *                     sin esa clave es un id `proveedor/modelo` del AI Gateway de Vercel.
 *
 * La clave nunca se escribe en el código: solo se lee de la variable de entorno.
 */
export function getLlmServerConfig(): { model: LanguageModel; modelId: string; provider: string } {
  const configuredModel = process.env.LLM_MODEL?.trim()
  const opencodeKey = process.env.OPENCODE_API_KEY?.trim()

  if (opencodeKey) {
    const modelId = configuredModel || OPENCODE_DEFAULT_MODEL
    const opencode = createOpenAICompatible({
      name: 'opencode-zen',
      baseURL: OPENCODE_BASE_URL,
      apiKey: opencodeKey,
    })
    return { model: opencode.chatModel(modelId), modelId, provider: 'opencode-zen' }
  }

  const modelId = configuredModel || GATEWAY_DEFAULT_MODEL
  return { model: modelId, modelId, provider: 'gateway' }
}

/** Modelo del AI Gateway, usado cuando OpenCode Zen rechaza la clave. */
export function getGatewayFallback(): { model: LanguageModel; modelId: string } {
  return { model: GATEWAY_DEFAULT_MODEL, modelId: GATEWAY_DEFAULT_MODEL }
}

export type LlmStatus = { configured: boolean; model: string | null }

/** Versión segura para pasar a componentes. */
export function getLlmStatus(): LlmStatus {
  const { modelId } = getLlmServerConfig()
  return { configured: true, model: modelId }
}
