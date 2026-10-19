-- Requiere la extensión pgvector en el servidor (en Neon viene incluida).
-- La dimensión 1536 coincide con EMBEDDING_DIMENSIONS en lib/rag/config.ts:
-- si se cambia una, hay que cambiar la otra y reindexar los archivos.
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "file_chunks" ADD COLUMN "embedding" vector(1536);

-- CreateIndex
CREATE INDEX "file_chunks_embedding_idx" ON "file_chunks" USING hnsw ("embedding" vector_cosine_ops);
