import 'server-only'
import { db } from '@/lib/db'
import { isDatabaseConfigured } from '@/lib/db/config'

export type VectorStatus = { ready: true } | { ready: false; message: string }

let readyUntil = 0

/**
 * Comprueba que la búsqueda vectorial puede funcionar de verdad: extensión pgvector instalada
 * y columna `file_chunks.embedding` creada. Si falta algo devuelve qué hacer; nunca se simula
 * la búsqueda con otra técnica.
 */
export async function getVectorStatus(): Promise<VectorStatus> {
  if (!isDatabaseConfigured) {
    return { ready: false, message: 'No hay una base de datos conectada, así que no hay búsqueda en documentos.' }
  }
  if (Date.now() < readyUntil) return { ready: true }

  try {
    const [row] = await db.$queryRaw<
      { available: boolean; installed: boolean; hasColumn: boolean }[]
    >`
      SELECT
        EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') AS "available",
        EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS "installed",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'file_chunks' AND column_name = 'embedding'
        ) AS "hasColumn"
    `
    if (row?.installed && row.hasColumn) {
      readyUntil = Date.now() + 60_000
      return { ready: true }
    }
    if (!row?.available) {
      return {
        ready: false,
        message:
          'La extensión pgvector no está disponible en esta base de datos. Habilitala en tu proveedor de Postgres (en Neon: CREATE EXTENSION vector) y aplicá la migración prisma/migrations/5_pgvector.',
      }
    }
    return {
      ready: false,
      message:
        'pgvector está disponible pero falta aplicar la migración prisma/migrations/5_pgvector (npx prisma migrate deploy).',
    }
  } catch (error) {
    console.error('[rag] vector status check failed', error)
    return {
      ready: false,
      message:
        'No se pudo comprobar pgvector. Verificá que estén aplicadas las migraciones 4_rag_chunks y 5_pgvector (npx prisma migrate deploy).',
    }
  }
}
