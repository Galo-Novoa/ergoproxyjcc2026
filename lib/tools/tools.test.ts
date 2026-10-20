import { describe, expect, it } from 'vitest'
import { callSignature } from '@/lib/tools/signature'
import { prepareGeneratedFile, storageKeyFor } from '@/lib/tools/file-builder'
import { detectToolNeeds } from '@/lib/tools/intent'
import { validateMermaid } from '@/lib/tools/mermaid'

describe('validateMermaid', () => {
  it('acepta tipos permitidos y normaliza alias', () => {
    expect(validateMermaid('flowchart TD\n A --> B')).toMatchObject({ ok: true, type: 'flowchart' })
    expect(validateMermaid('graph LR\n A --> B')).toMatchObject({ ok: true, type: 'flowchart' })
    expect(validateMermaid('sequenceDiagram\n A->>B: hola')).toMatchObject({
      ok: true,
      type: 'sequenceDiagram',
    })
  })

  it('rechaza vacío, tipo desconocido y construcciones peligrosas', () => {
    expect(validateMermaid('   ').ok).toBe(false)
    expect(validateMermaid('notadiagrama TD\nA-->B').ok).toBe(false)
    expect(validateMermaid('flowchart TD\nA-->B\nclick A href "javascript:alert(1)"').ok).toBe(false)
    expect(validateMermaid('flowchart TD\nA-->B\n%%{init: {}}%%').ok).toBe(false)
    expect(validateMermaid('flowchart TD\nA--><script>x</script>').ok).toBe(false)
  })

  it('rechaza diagramas demasiado largos', () => {
    expect(validateMermaid(`flowchart TD\n${'A-->B\n'.repeat(2000)}`).ok).toBe(false)
  })
})

describe('prepareGeneratedFile', () => {
  it('normaliza nombre y repone la extensión correcta', () => {
    const result = prepareGeneratedFile('Mi Apunte.csv', 'md', 'hola')
    expect(result).toMatchObject({ ok: true, name: 'Mi Apunte.md', format: 'md' })
  })

  it('quita separadores peligrosos del nombre', () => {
    const result = prepareGeneratedFile('a/b\\c:d*.txt', 'txt', 'contenido')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.name).not.toMatch(/[\\/:*?"<>|]/)
      expect(result.name.endsWith('.txt')).toBe(true)
    }
  })

  it('rechaza contenido vacío y usa un nombre por defecto', () => {
    expect(prepareGeneratedFile('x', 'txt', '   ').ok).toBe(false)
    const result = prepareGeneratedFile('   ', 'txt', 'algo')
    expect(result).toMatchObject({ ok: true, name: 'apunte.txt' })
  })

  it('storageKeyFor limpia acentos y caracteres raros', () => {
    expect(storageKeyFor('Apunté de Física.md')).toBe('Apunte-de-Fisica.md')
    expect(storageKeyFor('///')).toBe('archivo.txt')
  })
})

describe('detectToolNeeds', () => {
  it('detecta la búsqueda web solo cuando se pide explícitamente', () => {
    expect(detectToolNeeds('buscá en internet sobre grafos').web).toBe(true)
    expect(detectToolNeeds('googleá la definición de red').web).toBe(true)
    expect(detectToolNeeds('explicame los grafos').web).toBe(false)
  })

  it('detecta la necesidad de archivo y de diagrama', () => {
    expect(detectToolNeeds('exportá esto a un csv').file).toBe(true)
    expect(detectToolNeeds('hacé un diagrama de flujo').diagram).toBe(true)
    expect(detectToolNeeds('un mapa conceptual').diagram).toBe(true)
  })

  it('deja webQuery en null si no hay búsqueda', () => {
    const needs = detectToolNeeds('explicame los grafos')
    expect(needs.web).toBe(false)
    expect(needs.webQuery).toBeNull()
  })
})

describe('callSignature', () => {
  it('es estable y ordena las claves', () => {
    const a = callSignature('web_search', { query: 'x', limit: 5 })
    const b = callSignature('web_search', { limit: 5, query: 'x' })
    expect(a).toBe(b)
  })

  it('cambia si cambian los argumentos', () => {
    expect(callSignature('web_search', { query: 'x' })).not.toBe(
      callSignature('web_search', { query: 'y' }),
    )
  })
})
