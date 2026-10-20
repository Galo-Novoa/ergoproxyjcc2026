import { describe, expect, it } from 'vitest'
import { extractJson, recover, validateActions } from '@/lib/llm/recover'

const branchAction = {
  type: 'propose_history_branch',
  alias: 'Integrales por partes',
  description: 'descompone el cálculo en pasos',
}

describe('extractJson', () => {
  it('parsea JSON directo', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('parsea JSON dentro de un bloque de código', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('rescata el objeto cuando hay prosa alrededor', () => {
    expect(extractJson('Claro, acá va: {"a":1} listo')).toEqual({ a: 1 })
  })

  it('devuelve undefined si no hay JSON', () => {
    expect(extractJson('no hay nada acá')).toBeUndefined()
  })
})

describe('validateActions', () => {
  it('conserva las acciones válidas y descarta las inválidas', () => {
    const { valid, dropped } = validateActions([
      branchAction,
      { type: 'propose_history_branch' }, // falta alias/description
      { type: 'accion_inexistente' },
      'no es un objeto',
    ])
    expect(valid).toHaveLength(1)
    expect(valid[0]).toMatchObject({ type: 'propose_history_branch' })
    expect(dropped).toBe(3)
  })
})

describe('recover', () => {
  it('recupera JSON embebido con el esquema tolerante', () => {
    const result = recover('```json\n{"output":"hola","actions":[]}\n```')
    expect(result?.kind).toBe('extracted_json')
    expect(result?.response.output).toBe('hola')
    expect(result?.response.grounding).toBe('general')
  })

  it('descarta acciones inválidas dentro del JSON recuperado', () => {
    const result = recover(
      '{"output":"hola","actions":[{"type":"propose_history_branch"}, ' +
        JSON.stringify(branchAction) +
        ']}',
    )
    expect(result?.kind).toBe('extracted_json')
    expect(result?.response.actions).toHaveLength(1)
    expect(result?.dropped).toBe(1)
  })

  it('acepta texto plano como último recurso', () => {
    const result = recover('La derivada de x² es 2x.')
    expect(result?.kind).toBe('plain_text')
    expect(result?.response.output).toBe('La derivada de x² es 2x.')
    expect(result?.response.actions).toEqual([])
  })

  it('NO muestra JSON roto como respuesta correcta', () => {
    // Empieza con llave pero está malformado: debe descartarse, no exponerse.
    expect(recover('{"output": "parcial sin cerrar"')).toBeNull()
    // JSON roto con prosa antes: tampoco se expone.
    expect(recover('Acá va el JSON: {output: roto')).toBeNull()
    // Un array roto cuyos elementos no son JSON válido tampoco.
    expect(recover('[{output: roto}, {otra: cosa}')).toBeNull()
  })

  it('rescata el objeto válido embebido en un array roto', () => {
    // Si hay un objeto JSON válido adentro, se recupera con el esquema tolerante.
    const result = recover('[{"output":"x"}')
    expect(result?.kind).toBe('extracted_json')
    expect(result?.response.output).toBe('x')
  })

  it('devuelve null si no hay texto', () => {
    expect(recover('   ')).toBeNull()
    expect(recover(undefined)).toBeNull()
  })
})
