export const FOLDER_KINDS = ['concept', 'key_points', 'exercise', 'solution', 'note'] as const
export type FolderKind = (typeof FOLDER_KINDS)[number]

export const FOLDER_KIND_LABELS: Record<FolderKind, string> = {
  concept: 'Concepto',
  key_points: 'Puntos clave',
  exercise: 'Ejercicio',
  solution: 'Resolución',
  note: 'Apunte',
}

export const FOLDER_EDGE_KINDS = ['child', 'related'] as const
export type FolderEdgeKind = (typeof FOLDER_EDGE_KINDS)[number]

export const TITLE_MAX = 120
export const CONTENT_MAX = 20_000
export const REASON_MAX = 200
export const LABEL_MAX = 160

export const MAX_NODES_PER_WORKSPACE = 500
export const MAX_FOLDER_PROPOSALS_PER_MESSAGE = 2
/** Cuántos apuntes existentes se le muestran al agente para que reutilice en lugar de duplicar. */
export const PROMPT_INDEX_LIMIT = 80

/** Desde este puntaje, dos títulos del mismo grupo se consideran el mismo apunte. */
export const SIMILARITY_THRESHOLD = 0.7
