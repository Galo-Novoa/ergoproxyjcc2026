/** Tipos de apunte de la Carpeta. */
export const FOLDER_NODE_TYPES = ['concept', 'key_points', 'exercise', 'solution', 'note'] as const
export type FolderNodeType = (typeof FOLDER_NODE_TYPES)[number]

export const FOLDER_NODE_LABELS: Record<FolderNodeType, string> = {
  concept: 'Concepto',
  key_points: 'Para recordar',
  exercise: 'Ejercicio',
  solution: 'Resolución',
  note: 'Apunte',
}

/** Tipos de relación entre apuntes. */
export const FOLDER_EDGE_KINDS = ['relates', 'contains', 'solves'] as const
export type FolderEdgeKind = (typeof FOLDER_EDGE_KINDS)[number]

export const FOLDER_EDGE_LABELS: Record<FolderEdgeKind, string> = {
  relates: 'se relaciona con',
  contains: 'contiene',
  solves: 'resuelve',
}

export const isFolderNodeType = (value: unknown): value is FolderNodeType =>
  typeof value === 'string' && (FOLDER_NODE_TYPES as readonly string[]).includes(value)

export const isFolderEdgeKind = (value: unknown): value is FolderEdgeKind =>
  typeof value === 'string' && (FOLDER_EDGE_KINDS as readonly string[]).includes(value)

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
