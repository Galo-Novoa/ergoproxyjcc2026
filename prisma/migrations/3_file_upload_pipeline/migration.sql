-- AlterTable
ALTER TABLE "files" ADD COLUMN "storagePath" TEXT,
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "kind" TEXT,
ADD COLUMN "kindSource" TEXT,
ADD COLUMN "kindReason" TEXT,
ADD COLUMN "pageCount" INTEGER,
ADD COLUMN "textPageCount" INTEGER,
ADD COLUMN "processedAt" TIMESTAMP(6),
ALTER COLUMN "status" SET DEFAULT 'uploading';

-- CreateTable
CREATE TABLE "file_pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fileId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_pages_file_page_key" ON "file_pages"("fileId", "pageNumber");

-- CreateIndex
CREATE INDEX "file_pages_user_idx" ON "file_pages"("userId");

-- AddForeignKey
ALTER TABLE "file_pages" ADD CONSTRAINT "file_pages_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_pages" ADD CONSTRAINT "file_pages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
