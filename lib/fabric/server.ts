import 'server-only'

import { generateText } from 'ai'
import { getLlmServerConfig } from '@/lib/llm/config'
import {
  FABRIC_BACKEND_LABELS,
  FABRIC_EXTERNAL_PATTERNS,
  FABRIC_MAX_INPUT,
  FABRIC_MAX_OUTPUT,
  getFabricExternalConfig,
  type FabricBackend,
  type FabricSkill,
} from '@/lib/fabric/config'
import { FABRIC_PATTERNS, wrapFabricInput } from '@/lib/fabric/patterns'
import { fabricFallbackTransform } from '@/lib/fabric/fallback'

export type FabricResult = {
  skill: FabricSkill
  /** Texto transformado, listo para editar por la persona. */
  output: string
  backend: FabricBackend
  backendLabel: string
  /** Si la skill no produjo nada (texto vacío), quien llama decide qué hacer. */
  empty: boolean
}

export type FabricInput = {
  skill: FabricSkill
  text: string
  /** Título o tema, para dar contexto al transformador. */
  title?: string
  /** Material de referencia (p. ej. fragmentos citados) que debe conservarse como fuente. */
  context?: string
}

/** Llama al servicio Fabric externo (`POST /chat`, respuesta SSE). Devuelve null si falla. */
async function runExternal(skill: FabricSkill, text: string): Promise<string | null> {
  const config = getFabricExternalConfig()
  if (!config) return null
  try {
    const response = await fetch(`${config.url}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'X-API-Key': config.apiKey } : {}),
      },
      body: JSON.stringify({
        prompts: [
          {
            userInput: text.slice(0, FABRIC_MAX_INPUT),
            vendor: config.vendor,
            model: config.model,
            patternName: FABRIC_EXTERNAL_PATTERNS[skill],
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!response.ok || !response.body) {
      console.error(`[fabric] servicio externo HTTP ${response.status}`)
      return null
    }
    // La respuesta es un stream SSE con líneas {"type":"content"|"complete",...}.
    const raw = await response.text()
    let out = ''
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('{')) continue
      try {
        const event = JSON.parse(trimmed) as { type?: string; content?: string }
        if (event.type === 'content' && typeof event.content === 'string') out += event.content
      } catch {
        // Líneas que no son JSON (p. ej. `data:`) se ignoran.
      }
    }
    const cleaned = out.trim()
    return cleaned ? cleaned.slice(0, FABRIC_MAX_OUTPUT) : null
  } catch (error) {
    console.error('[fabric] falló el servicio externo:', error instanceof Error ? error.message : error)
    return null
  }
}

/** Ejecuta la plantilla interna con el LLM de la app. Devuelve null si no hay LLM o falla. */
async function runInternal(input: FabricInput): Promise<string | null> {
  const pattern = FABRIC_PATTERNS[input.skill]
  const header = input.title ? `Tema: ${input.title}\n\n` : ''
  const context = input.context ? `Referencia (no la repitas literal):\n${input.context}\n\n` : ''
  try {
    const { model } = getLlmServerConfig()
    const result = await generateText({
      model,
      system: pattern.system,
      messages: [
        {
          role: 'user',
          content: `${pattern.instruction}\n\n${header}${context}${wrapFabricInput(input.text)}`,
        },
      ],
      timeout: 60_000,
    })
    const cleaned = result.text?.trim()
    return cleaned ? cleaned.slice(0, FABRIC_MAX_OUTPUT) : null
  } catch (error) {
    console.error('[fabric] falló la plantilla interna:', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Aplica una skill de Fabric al texto. Orden: servicio externo → plantilla interna
 * → recorte determinístico. Nunca lanza: siempre devuelve un resultado utilizable.
 */
export async function runFabricSkill(input: FabricInput): Promise<FabricResult> {
  const text = input.text.slice(0, FABRIC_MAX_INPUT)

  const external = await runExternal(input.skill, text)
  if (external) {
    return {
      skill: input.skill,
      output: external,
      backend: 'external',
      backendLabel: FABRIC_BACKEND_LABELS.external,
      empty: false,
    }
  }

  const internal = await runInternal(input)
  if (internal) {
    return {
      skill: input.skill,
      output: internal,
      backend: 'internal',
      backendLabel: FABRIC_BACKEND_LABELS.internal,
      empty: false,
    }
  }

  const fallback = fabricFallbackTransform(input.skill, text)
  return {
    skill: input.skill,
    output: fallback,
    backend: 'fallback',
    backendLabel: FABRIC_BACKEND_LABELS.fallback,
    empty: fallback.trim().length === 0,
  }
}
