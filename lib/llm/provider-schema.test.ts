import { describe, expect, it } from 'vitest'
import { zodSchema } from 'ai'
import type { ZodType } from 'zod'
import { agentResponseSchema, parseProposalPayload } from '@/lib/llm/contract'
import { jevProviderSchema } from '@/lib/jev/contract'

/**
 * El modo estricto de OpenAI exige que cada objeto liste TODAS sus propiedades en
 * `required`. Un `.optional()` o `.default()` en el esquema que se le manda al
 * proveedor rompe cada pedido con HTTP 400.
 */
async function propertiesOutsideRequired(schema: ZodType) {
  const jsonSchema = await zodSchema(schema).jsonSchema
  const missing: string[] = []
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return
    const { properties, required } = node as { properties?: object; required?: string[] }
    if (properties) {
      for (const key of Object.keys(properties)) {
        if (!required?.includes(key)) missing.push(`${path}.${key}`)
      }
    }
    for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`)
  }
  walk(jsonSchema, '$')
  return missing
}

describe('esquemas que se le exigen al proveedor', () => {
  it('la respuesta del agente marca todas las propiedades como requeridas', async () => {
    expect(await propertiesOutsideRequired(agentResponseSchema)).toEqual([])
  })

  it('la clasificación de Jev marca todas las propiedades como requeridas', async () => {
    expect(await propertiesOutsideRequired(jevProviderSchema)).toEqual([])
  })
})

describe('payloads guardados', () => {
  it('completa con null los anulables que faltan en una propuesta de Carpeta', () => {
    expect(
      parseProposalPayload({
        type: 'propose_folder_change',
        operation: 'create_node',
        title: 'Derivada',
        content_md: 'Tasa de cambio instantánea.',
        reason: 'concepto base',
      }),
    ).toMatchObject({ target_node_id: null, solution_md: null })
  })

  it('completa parent_node_id en un nodo del mapa de dudas', () => {
    expect(
      parseProposalPayload({ type: 'propose_question_node', title: 'Regla de la cadena', description: 'duda' }),
    ).toMatchObject({ parent_node_id: null })
  })
})
