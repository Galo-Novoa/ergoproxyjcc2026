-- El árbol resumen (summary_nodes) se reemplaza por el grafo de Carpeta: apuntes
-- tipados con contenido Markdown, relaciones muchos-a-muchos y referencias al
-- historial. DROP y no ALTER porque no comparten forma.
DROP TABLE IF EXISTS "summary_nodes";

-- CreateTable
CREATE TABLE "folder_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "subjectId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'concept',
    "contentMd" TEXT NOT NULL DEFAULT '',
    "posX" REAL NOT NULL DEFAULT 0,
    "posY" REAL NOT NULL DEFAULT 0,
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folder_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder_edges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "fromId" UUID NOT NULL,
    "toId" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'relates',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folder_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder_node_refs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "nodeId" UUID NOT NULL,
    "conversationId" UUID,
    "messageId" UUID,
    "questionNodeId" UUID,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folder_node_refs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "folder_nodes_user_idx" ON "folder_nodes"("userId");

-- CreateIndex
CREATE INDEX "folder_nodes_subject_idx" ON "folder_nodes"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "folder_edges_unique" ON "folder_edges"("fromId", "toId", "kind");

-- CreateIndex
CREATE INDEX "folder_edges_user_idx" ON "folder_edges"("userId");

-- CreateIndex
CREATE INDEX "folder_edges_to_idx" ON "folder_edges"("toId");

-- CreateIndex
CREATE INDEX "folder_node_refs_user_idx" ON "folder_node_refs"("userId");

-- CreateIndex
CREATE INDEX "folder_node_refs_node_idx" ON "folder_node_refs"("nodeId");

-- AddForeignKey
ALTER TABLE "folder_nodes" ADD CONSTRAINT "folder_nodes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_nodes" ADD CONSTRAINT "folder_nodes_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_edges" ADD CONSTRAINT "folder_edges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_edges" ADD CONSTRAINT "folder_edges_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "folder_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_edges" ADD CONSTRAINT "folder_edges_toId_fkey" FOREIGN KEY ("toId") REFERENCES "folder_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_node_refs" ADD CONSTRAINT "folder_node_refs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_node_refs" ADD CONSTRAINT "folder_node_refs_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "folder_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_node_refs" ADD CONSTRAINT "folder_node_refs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_node_refs" ADD CONSTRAINT "folder_node_refs_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_node_refs" ADD CONSTRAINT "folder_node_refs_questionNodeId_fkey" FOREIGN KEY ("questionNodeId") REFERENCES "question_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones que Prisma no puede expresar
ALTER TABLE "folder_nodes" ADD CONSTRAINT "folder_nodes_type_check" CHECK ("type" IN ('concept', 'key_points', 'exercise', 'solution', 'note'));
ALTER TABLE "folder_nodes" ADD CONSTRAINT "folder_nodes_origin_check" CHECK ("origin" IN ('ai', 'manual'));
ALTER TABLE "folder_edges" ADD CONSTRAINT "folder_edges_kind_check" CHECK ("kind" IN ('relates', 'contains', 'solves'));
-- Un nodo no se relaciona consigo mismo.
ALTER TABLE "folder_edges" ADD CONSTRAINT "folder_edges_no_self_check" CHECK ("fromId" <> "toId");

-- El agente ahora también propone cambios en la Carpeta.
ALTER TABLE "agent_actions" DROP CONSTRAINT IF EXISTS "agent_actions_type_check";
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_type_check" CHECK ("type" IN ('propose_history_branch', 'propose_folder_change'));
