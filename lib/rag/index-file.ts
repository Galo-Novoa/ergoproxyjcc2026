import 'server-only'
import { db } from '@/lib/db'
import { chunkPageText } from './chunk'
import { getRagConfig } from './config'
import { EmbeddingError, embedTexts, toVectorLiteral } from './embed'
import { getVectorStatus } from './vector'

const INSERT_BATCH_SIZE = 100

export type IndexResult = { ok: true; chunkCount: number } | { ok: false; error: string }

/**
 * Parte el texto extraído de un archivo en fragmentos por página, les calcula el embedding y
 * los guarda con los permisos del archivo. Es idempotente (reemplaza los fragmentos previos) y
 * nunca lanza: el resultado queda en `File.indexStatus`. El que llama debe haber verificado
 * antes que la persona puede escribir sobre el archivo.
 */
export async function indexFile(fileId: string): Promise<IndexResult> {
  const file = await db.file.findUnique({
    where: { id: fileId },
    select: { id: true, userId: true, organizationId: true, visibility: true, subjectId: true, status: true },
  })
  if (!file) return { ok: false, error: 'No encontramos el archivo.' }
  if (file.status !== 'ready') return { ok: false, error: 'El archivo todavía no tiene texto para indexar.' }

  const vector = await getVectorStatus()
  if (!vector.ready) {
    await db.file.update({
      where: { id: file.id },
      data: { indexStatus: 'unavailable', indexError: vector.message, chunkCount: 0 },
    })
    return { ok: false, error: vector.message }
  }

  await db.file.update({ where: { id: file.id }, data: { indexStatus: 'indexing', indexError: null } })

  try {
    const { chunkSize, chunkOverlap, embeddingModel } = getRagConfig()
    const pages = await db.filePage.findMany({
      where: { fileId: file.id },
      orderBy: { pageNumber: 'asc' },
      select: { pageNumber: true, text: true },
    })
    const chunks = pages.flatMap((page) =>
      chunkPageText(page.text, chunkSize, chunkOverlap).map((chunk) => ({
        pageNumber: page.pageNumber,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
      })),
    )
    if (chunks.length === 0) throw new EmbeddingError('El archivo no tiene texto suficiente para indexar.')

    const vectors = await embedTexts(chunks.map((chunk) => chunk.content))

    await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`DELETE FROM "file_chunks" WHERE "fileId" = ${file.id}::uuid`
        for (let i = 0; i < chunks.length; i += INSERT_BATCH_SIZE) {
          const batch = chunks.slice(i, i + INSERT_BATCH_SIZE)
          const batchVectors = vectors.slice(i, i + INSERT_BATCH_SIZE).map(toVectorLiteral)
          await tx.$executeRaw`
            INSERT INTO "file_chunks"
              ("fileId", "userId", "organizationId", "visibility", "subjectId",
               "pageNumber", "chunkIndex", "content", "embeddingModel", "embedding")
            SELECT ${file.id}::uuid, ${file.userId}, ${file.organizationId}::uuid, ${file.visibility},
                   ${file.subjectId}::uuid, t."page", t."idx", t."content", ${embeddingModel}, t."emb"::vector
            FROM unnest(
              ${batch.map((c) => c.pageNumber)}::int[],
              ${batch.map((c) => c.chunkIndex)}::int[],
              ${batch.map((c) => c.content)}::text[],
              ${batchVectors}::text[]
            ) AS t("page", "idx", "content", "emb")
          `
        }
        await tx.file.update({
          where: { id: file.id },
          data: {
            indexStatus: 'indexed',
            indexError: null,
            chunkCount: chunks.length,
            indexedAt: new Date(),
            embeddingModel,
          },
        })
      },
      { timeout: 60_000 },
    )
    return { ok: true, chunkCount: chunks.length }
  } catch (error) {
    const message =
      error instanceof EmbeddingError ? error.message : 'No se pudo indexar el archivo. Probá de nuevo en unos minutos.'
    if (!(error instanceof EmbeddingError)) console.error('[rag] indexFile failed', error)
    await db.file.update({
      where: { id: file.id },
      data: { indexStatus: 'failed', indexError: message },
    })
    return { ok: false, error: message }
  }
}
