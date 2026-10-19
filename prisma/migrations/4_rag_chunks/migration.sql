-- AlterTable
ALTER TABLE "files" ADD COLUMN "indexStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "indexError" TEXT,
ADD COLUMN "chunkCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "indexedAt" TIMESTAMP(6),
ADD COLUMN "embeddingModel" TEXT;

-- CreateTable
CREATE TABLE "file_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fileId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" UUID,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "subjectId" UUID,
    "pageNumber" INTEGER NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_chunks_file_page_chunk_key" ON "file_chunks"("fileId", "pageNumber", "chunkIndex");

-- CreateIndex
CREATE INDEX "file_chunks_user_idx" ON "file_chunks"("userId");

-- CreateIndex
CREATE INDEX "file_chunks_subject_idx" ON "file_chunks"("subjectId");

-- AddForeignKey
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
