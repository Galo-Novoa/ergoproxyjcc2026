-- Carpeta: grafo de conocimiento por materia, separado del árbol de ramas del historial.
-- Modelo unificado: apuntes tipados con contenido Markdown y posición en canvas (posX/posY),
-- relaciones 'contains' | 'relates' | 'solves', y FolderSource como provenance unificada
-- (sesión, mensaje, rama del historial o duda del mapa).

CREATE TABLE "folder_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "subjectId" UUID,
    "type" TEXT NOT NULL DEFAULT 'concept',
    "title" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL DEFAULT '',
    "posX" REAL NOT NULL DEFAULT 0,
    "posY" REAL NOT NULL DEFAULT 0,
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "folder_nodes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "folder_nodes_type_check" CHECK ("type" IN ('concept','key_points','exercise','solution','note')),
    CONSTRAINT "folder_nodes_origin_check" CHECK ("origin" IN ('ai','manual'))
);
CREATE INDEX "folder_nodes_user_subject_idx" ON "folder_nodes"("userId", "subjectId");
ALTER TABLE "folder_nodes" ADD CONSTRAINT "folder_nodes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folder_nodes" ADD CONSTRAINT "folder_nodes_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "folder_edges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "fromId" UUID NOT NULL,
    "toId" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'relates',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "folder_edges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "folder_edges_kind_check" CHECK ("kind" IN ('relates','contains','solves')),
    CONSTRAINT "folder_edges_no_self_check" CHECK ("fromId" <> "toId")
);
CREATE UNIQUE INDEX "folder_edges_unique" ON "folder_edges"("fromId", "toId", "kind");
CREATE INDEX "folder_edges_to_idx" ON "folder_edges"("toId");
CREATE INDEX "folder_edges_user_idx" ON "folder_edges"("userId");
ALTER TABLE "folder_edges" ADD CONSTRAINT "folder_edges_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folder_edges" ADD CONSTRAINT "folder_edges_fromId_fkey"
  FOREIGN KEY ("fromId") REFERENCES "folder_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folder_edges" ADD CONSTRAINT "folder_edges_toId_fkey"
  FOREIGN KEY ("toId") REFERENCES "folder_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "folder_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nodeId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" UUID,
    "messageId" UUID,
    "historyNodeId" UUID,
    "questionNodeId" UUID,
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "folder_sources_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "folder_sources_node_idx" ON "folder_sources"("nodeId");
CREATE INDEX "folder_sources_conversation_idx" ON "folder_sources"("conversationId");
CREATE INDEX "folder_sources_user_idx" ON "folder_sources"("userId");
ALTER TABLE "folder_sources" ADD CONSTRAINT "folder_sources_nodeId_fkey"
  FOREIGN KEY ("nodeId") REFERENCES "folder_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folder_sources" ADD CONSTRAINT "folder_sources_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folder_sources" ADD CONSTRAINT "folder_sources_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "folder_sources" ADD CONSTRAINT "folder_sources_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "folder_sources" ADD CONSTRAINT "folder_sources_historyNodeId_fkey"
  FOREIGN KEY ("historyNodeId") REFERENCES "conversation_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "folder_sources" ADD CONSTRAINT "folder_sources_questionNodeId_fkey"
  FOREIGN KEY ("questionNodeId") REFERENCES "question_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- El agente también propone cambios en la Carpeta y nodos del mapa de dudas.
ALTER TABLE "agent_actions" DROP CONSTRAINT IF EXISTS "agent_actions_type_check";
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_type_check" CHECK ("type" IN ('propose_history_branch', 'propose_question_node', 'propose_folder_change'));
