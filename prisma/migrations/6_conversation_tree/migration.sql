-- Árbol de ramas por conversación, orden global de mensajes y resúmenes de contexto.

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "activeNodeId" UUID;

-- CreateTable
CREATE TABLE "conversation_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversationId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" UUID,
    "anchorMessageId" UUID,
    "alias" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "contextSummary" TEXT,
    "summaryUpToSeq" BIGINT,
    "summaryVersion" INTEGER NOT NULL DEFAULT 0,
    "summaryUpdatedAt" TIMESTAMP(6),
    "inheritedSummary" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_nodes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversation_nodes_conversation_idx" ON "conversation_nodes"("conversationId");
CREATE INDEX "conversation_nodes_parent_idx" ON "conversation_nodes"("parentId");
CREATE INDEX "conversation_nodes_user_idx" ON "conversation_nodes"("userId");

-- Una sola raíz por conversación (Prisma no expresa índices parciales).
CREATE UNIQUE INDEX "conversation_nodes_root_key" ON "conversation_nodes"("conversationId") WHERE "parentId" IS NULL;

ALTER TABLE "conversation_nodes" ADD CONSTRAINT "conversation_nodes_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_nodes" ADD CONSTRAINT "conversation_nodes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_nodes" ADD CONSTRAINT "conversation_nodes_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "conversation_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Orden global de inserción de los mensajes, rellenado según el orden existente.
CREATE SEQUENCE "messages_seq_seq";
ALTER TABLE "messages" ADD COLUMN "seq" BIGINT;
UPDATE "messages" m SET "seq" = o.rn
FROM (SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS rn FROM "messages") o
WHERE m."id" = o."id";
SELECT setval('messages_seq_seq', COALESCE((SELECT max("seq") FROM "messages"), 0) + 1, false);
ALTER TABLE "messages" ALTER COLUMN "seq" SET DEFAULT nextval('messages_seq_seq');
ALTER TABLE "messages" ALTER COLUMN "seq" SET NOT NULL;
ALTER SEQUENCE "messages_seq_seq" OWNED BY "messages"."seq";

ALTER TABLE "messages" ADD COLUMN "nodeId" UUID;
CREATE INDEX "messages_node_seq_idx" ON "messages"("nodeId", "seq");
ALTER TABLE "messages" ADD CONSTRAINT "messages_nodeId_fkey"
  FOREIGN KEY ("nodeId") REFERENCES "conversation_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversation_nodes" ADD CONSTRAINT "conversation_nodes_anchorMessageId_fkey"
  FOREIGN KEY ("anchorMessageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Las conversaciones existentes pasan a tener una raíz que contiene todos sus mensajes.
INSERT INTO "conversation_nodes" ("conversationId", "userId", "alias", "topic")
SELECT "id", "userId", 'Pregunta inicial', "title" FROM "conversations";

UPDATE "messages" m SET "nodeId" = n."id"
FROM "conversation_nodes" n
WHERE n."conversationId" = m."conversationId" AND n."parentId" IS NULL;

UPDATE "conversations" c SET "activeNodeId" = n."id"
FROM "conversation_nodes" n
WHERE n."conversationId" = c."id" AND n."parentId" IS NULL;
