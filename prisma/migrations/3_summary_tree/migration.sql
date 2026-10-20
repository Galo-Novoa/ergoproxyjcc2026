-- CreateTable
CREATE TABLE "summary_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "subjectId" UUID NOT NULL,
    "parentId" UUID,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "posX" REAL NOT NULL DEFAULT 0,
    "posY" REAL NOT NULL DEFAULT 0,
    "origin" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summary_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "summary_nodes_user_idx" ON "summary_nodes"("userId");

-- CreateIndex
CREATE INDEX "summary_nodes_subject_idx" ON "summary_nodes"("subjectId");

-- CreateIndex
CREATE INDEX "summary_nodes_parent_idx" ON "summary_nodes"("parentId");

-- AddForeignKey
ALTER TABLE "summary_nodes" ADD CONSTRAINT "summary_nodes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summary_nodes" ADD CONSTRAINT "summary_nodes_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summary_nodes" ADD CONSTRAINT "summary_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "summary_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones que Prisma no puede expresar
ALTER TABLE "summary_nodes" ADD CONSTRAINT "summary_nodes_origin_check" CHECK ("origin" IN ('ai', 'manual'));
