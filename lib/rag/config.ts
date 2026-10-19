import 'server-only'

/**
 * Dimensión de la columna `file_chunks.embedding` (migración 5_pgvector). Si cambia,
 * hay que crear una migración que ajuste la columna y reindexar todos los archivos.
 * Los modelos de OpenAI aceptan pedir esta dimensión, así que el modelo se puede
 * cambiar por EMBEDDING_MODEL sin tocar la base mientras devuelva 1536.
 */
export const EMBEDDING_DIMENSIONS = 1536

const DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small'

function intFromEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(process.env[name] ?? '', 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function floatFromEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseFloat(process.env[name] ?? '')
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

/**
 * Parámetros del RAG, todos opcionales por variable de entorno:
 *
 *   EMBEDDING_MODEL    id `proveedor/modelo` del modelo de embeddings
 *   RAG_CHUNK_SIZE     caracteres por fragmento (300 a 4000)
 *   RAG_CHUNK_OVERLAP  caracteres compartidos entre fragmentos contiguos de una página
 *   RAG_TOP_K          fragmentos máximos que se le pasan al modelo
 *   RAG_MIN_SCORE      similitud coseno mínima (0 a 1) para considerar relevante un fragmento
 *
 * Cambiar tamaño o solapamiento no reindexa solo: usar "Reindexar" en Archivos.
 */
export function getRagConfig() {
  const chunkSize = intFromEnv('RAG_CHUNK_SIZE', 1000, 300, 4000)
  return {
    embeddingModel: process.env.EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL,
    chunkSize,
    chunkOverlap: Math.min(intFromEnv('RAG_CHUNK_OVERLAP', 150, 0, 1000), Math.floor(chunkSize / 2)),
    topK: intFromEnv('RAG_TOP_K', 6, 1, 20),
    minScore: floatFromEnv('RAG_MIN_SCORE', 0.3, 0, 1),
  }
}
