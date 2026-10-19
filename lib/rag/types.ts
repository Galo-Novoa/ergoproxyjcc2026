// Tipos compartidos entre servidor y cliente (sin dependencias del servidor).

export const GROUNDING_VALUES = ['documents', 'mixed', 'general', 'insufficient'] as const
/**
 * Cómo se apoya una respuesta en los documentos de la persona:
 *   documents     todo lo que afirma sale de fragmentos citados
 *   mixed         parte sale de fragmentos citados y parte es explicación general
 *   general       no usa los documentos (o no había nada que consultar)
 *   insufficient  se consultaron documentos pero no alcanzan para responder
 */
export type Grounding = (typeof GROUNDING_VALUES)[number]

export const GROUNDING_LABEL: Record<Grounding, string> = {
  documents: 'Basado en tus documentos',
  mixed: 'En parte de tus documentos',
  general: 'Explicación general',
  insufficient: 'Sin evidencia suficiente en tus documentos',
}

/**
 * Resultado de la búsqueda previa a responder:
 *   ok           hubo fragmentos relevantes
 *   no_match     había documentos indexados pero nada superó el umbral de relevancia
 *   no_sources   no hay documentos indexados en el alcance de la consulta
 *   unavailable  la búsqueda vectorial no está disponible (ver `note`)
 */
export type RetrievalStatus = 'ok' | 'no_match' | 'no_sources' | 'unavailable'

/** 'workspace' = todos los documentos del workspace; 'selected' = elegidos a mano; 'mention' = nombrado en el mensaje. */
export type RetrievalScopeKind = 'workspace' | 'selected' | 'mention'

export type RagSource = {
  ref: number
  fileId: string
  fileName: string
  pageNumber: number
  text: string
  score: number
  cited: boolean
}

export type RagMetadata = {
  status: RetrievalStatus
  grounding: Grounding
  scope: RetrievalScopeKind
  workspaceName: string | null
  /** Nombres de los archivos en el alcance cuando es 'selected' o 'mention'. */
  scopeFileNames: string[]
  sources: RagSource[]
  unindexedFiles: number
  invalidCitations: number
  note?: string
}

const STATUSES: RetrievalStatus[] = ['ok', 'no_match', 'no_sources', 'unavailable']
const SCOPES: RetrievalScopeKind[] = ['workspace', 'selected', 'mention']

/** Valida lo guardado en `Message.metadata`: nunca confía en que tenga la forma esperada. */
export function parseRagMetadata(value: unknown): RagMetadata | null {
  if (!value || typeof value !== 'object') return null
  const rag = (value as { rag?: unknown }).rag
  if (!rag || typeof rag !== 'object') return null
  const r = rag as Record<string, unknown>
  if (!STATUSES.includes(r.status as RetrievalStatus)) return null
  if (!GROUNDING_VALUES.includes(r.grounding as Grounding)) return null

  const sources: RagSource[] = Array.isArray(r.sources)
    ? r.sources.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const s = item as Record<string, unknown>
        if (
          typeof s.ref !== 'number' ||
          typeof s.fileId !== 'string' ||
          typeof s.fileName !== 'string' ||
          typeof s.pageNumber !== 'number' ||
          typeof s.text !== 'string'
        ) {
          return []
        }
        return [
          {
            ref: s.ref,
            fileId: s.fileId,
            fileName: s.fileName,
            pageNumber: s.pageNumber,
            text: s.text,
            score: typeof s.score === 'number' ? s.score : 0,
            cited: s.cited === true,
          },
        ]
      })
    : []

  return {
    status: r.status as RetrievalStatus,
    grounding: r.grounding as Grounding,
    scope: SCOPES.includes(r.scope as RetrievalScopeKind) ? (r.scope as RetrievalScopeKind) : 'workspace',
    workspaceName: typeof r.workspaceName === 'string' ? r.workspaceName : null,
    scopeFileNames: Array.isArray(r.scopeFileNames)
      ? r.scopeFileNames.filter((n): n is string => typeof n === 'string')
      : [],
    sources,
    unindexedFiles: typeof r.unindexedFiles === 'number' ? r.unindexedFiles : 0,
    invalidCitations: typeof r.invalidCitations === 'number' ? r.invalidCitations : 0,
    note: typeof r.note === 'string' ? r.note : undefined,
  }
}
