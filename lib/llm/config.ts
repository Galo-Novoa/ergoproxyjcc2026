import 'server-only'

import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createGateway, type LanguageModel } from 'ai'

const GATEWAY_DEFAULT_MODEL = 'openai/gpt-5-mini'
const OPENCODE_DEFAULT_MODEL = 'big-pickle'
const OPENCODE_BASE_URL = 'https://opencode.ai/zen/v1'

export type LlmProvider = 'vercel-gateway' | 'opencode-zen' | 'gateway-default'
type LlmSelection = { model: LanguageModel; modelId: string; provider: LlmProvider }

function vercelGateway(apiKey: string, modelId: string): LlmSelection {
  const gateway = createGateway({ apiKey })
  return { model: gateway(modelId), modelId, provider: 'vercel-gateway' }
}

function opencodeZen(apiKey: string, modelId: string): LlmSelection {
  const opencode = createOpenAICompatible({ name: 'opencode-zen', baseURL: OPENCODE_BASE_URL, apiKey })
  return { model: opencode.chatModel(modelId), modelId, provider: 'opencode-zen' }
}

/**
 * Configuración del proveedor de LLM, leída solo en el servidor. Orden de prioridad:
 *
 *   VERCEL_API_KEY    clave del AI Gateway de Vercel; el modelo es un id `proveedor/modelo`
 *   OPENCODE_API_KEY  OpenCode Zen (endpoint compatible con OpenAI); el modelo es p. ej. `big-pickle`
 *   (ninguna)         AI Gateway con las credenciales del entorno de Vercel
 *   LLM_MODEL         (opcional) id del modelo del proveedor elegido
 *
 * Las claves nunca se escriben en el código: solo se leen de variables de entorno.
 */
export function getLlmServerConfig(): LlmSelection {
  const configuredModel = process.env.LLM_MODEL?.trim()
  const vercelKey = process.env.VERCEL_API_KEY?.trim()
  const opencodeKey = process.env.OPENCODE_API_KEY?.trim()

  if (vercelKey) {
    return vercelGateway(vercelKey, configuredModel?.includes('/') ? configuredModel : GATEWAY_DEFAULT_MODEL)
  }
  if (opencodeKey) {
    return opencodeZen(opencodeKey, configuredModel && !configuredModel.includes('/') ? configuredModel : OPENCODE_DEFAULT_MODEL)
  }
  const modelId = configuredModel?.includes('/') ? configuredModel : GATEWAY_DEFAULT_MODEL
  return { model: modelId, modelId, provider: 'gateway-default' }
}

/**
 * Proveedor alternativo cuando el principal rechaza la clave (401/402/403).
 * Devuelve null si no hay otro distinto al que ya falló.
 */
export function getLlmFallback(failed: LlmProvider): LlmSelection | null {
  const opencodeKey = process.env.OPENCODE_API_KEY?.trim()
  if (failed === 'vercel-gateway') {
    return opencodeKey ? opencodeZen(opencodeKey, OPENCODE_DEFAULT_MODEL) : null
  }
  if (failed === 'opencode-zen') {
    return { model: GATEWAY_DEFAULT_MODEL, modelId: GATEWAY_DEFAULT_MODEL, provider: 'gateway-default' }
  }
  return null
}

export type LlmStatus = { configured: boolean; model: string | null }

/** Versión segura para pasar a componentes. */
export function getLlmStatus(): LlmStatus {
  const { modelId } = getLlmServerConfig()
  return { configured: true, model: modelId }
}
