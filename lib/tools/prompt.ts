import type { WebSearchOutcome } from '@/lib/tools/web-search'

/**
 * Arma el bloque de prompt con los resultados de la búsqueda web. Es un canal
 * DISTINTO del RAG: las citas de la web son `[W1]`, no `[F1]`, para que la persona
 * vea qué vino de los apuntes y qué de internet.
 */

export function buildWebPrompt(outcome: WebSearchOutcome): string {
  if (!outcome.configured) {
    return [
      '## Búsqueda web',
      'No hay ningún proveedor de búsqueda configurado. NO intentes buscar en la web ni afirmes que lo hiciste.',
    ].join('\n')
  }
  if (outcome.error) {
    return [
      '## Búsqueda web',
      `La búsqueda falló (${outcome.error}). No afirmes que buscaste ni inventes resultados.`,
    ].join('\n')
  }
  if (!outcome.results.length) {
    return [
      '## Búsqueda web',
      'La búsqueda no devolvió resultados. No afirmes que encontraste información en la web.',
    ].join('\n')
  }
  const lines = outcome.results.map(
    (r, i) => `[W${i + 1}] ${r.title}\n${r.snippet}\n${r.url}`,
  )
  return [
    '## Resultados de la búsqueda web (información externa, NO de los apuntes)',
    'Si los usás, citá con [W1], [W2]… y aclaralo como fuente de internet. No los mezcles con las citas [F…] de los apuntes.',
    ...lines,
  ].join('\n')
}
