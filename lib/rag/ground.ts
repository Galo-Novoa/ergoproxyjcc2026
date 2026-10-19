import type { Grounding, RagMetadata, RagSource } from './types'
import type { RetrievalResult } from './retrieve'

// Marcador de cita: [F1] o [F1, F2]. Se eligió "F" para no chocar con intervalos matemáticos como [0, 1].
const CITATION_PATTERN = /\[(F\d+(?:\s*[,;]\s*F?\d+)*)\]/g

/**
 * Verifica las citas que escribió el modelo contra los fragmentos que de verdad se le dieron.
 *
 * - Marcadores que no corresponden a un fragmento recuperado se eliminan del texto y se cuentan.
 * - `grounding` nunca promete más de lo que el texto respalda: sin citas válidas no puede ser
 *   'documents' ni 'mixed', y con citas válidas no puede ser 'general'.
 */
export function applyGrounding(
  output: string,
  declared: Grounding,
  retrieval: RetrievalResult,
): { output: string; rag: RagMetadata } {
  const validRefs = new Set(retrieval.sources.map((s) => s.ref))
  const cited = new Set<number>()
  let invalidCitations = 0

  const cleaned = output
    .replace(CITATION_PATTERN, (_match, inner: string) => {
      const refs = [...new Set((inner.match(/\d+/g) ?? []).map(Number))]
      const valid = refs.filter((ref) => validRefs.has(ref))
      invalidCitations += refs.length - valid.length
      for (const ref of valid) cited.add(ref)
      return valid.map((ref) => `[F${ref}]`).join('')
    })
    .replace(/[ \t]+([.,;:!?])/g, '$1')

  let grounding = declared
  if (retrieval.status !== 'ok') {
    // Sin fragmentos nada puede estar respaldado por documentos.
    grounding = declared === 'insufficient' ? 'insufficient' : 'general'
  } else if (cited.size === 0) {
    grounding = declared === 'insufficient' ? 'insufficient' : 'general'
  } else if (declared === 'general' || declared === 'insufficient') {
    grounding = declared === 'insufficient' ? 'insufficient' : 'mixed'
  }

  const sources: RagSource[] = retrieval.sources.map((s) => ({ ...s, cited: cited.has(s.ref) }))

  return {
    output: cleaned,
    rag: {
      status: retrieval.status,
      grounding,
      scope: retrieval.scope,
      workspaceName: retrieval.workspaceName,
      scopeFileNames: retrieval.scopeFileNames,
      sources,
      unindexedFiles: retrieval.unindexedFiles,
      invalidCitations,
      note: retrieval.note,
    },
  }
}
