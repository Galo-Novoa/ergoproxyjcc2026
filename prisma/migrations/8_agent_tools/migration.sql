-- Herramientas del agente: archivos generados y auditoría de llamadas.
-- El binario de los archivos generados vive en Vercel Blob (privado); acá hay metadatos
-- y, si no hay Blob, el contenido textual como respaldo (la descarga lo sirve desde la base).
-- `tool_calls` deja registro de cada llamada (resultado/error) y evita repetir la misma
-- acción por reintentos de generación (índice por `signature`).

CREATE TABLE "generated_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "conversationId" UUID,
    "messageId" UUID,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "storagePath" TEXT,
    "storageUrl" TEXT,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generated_files_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "generated_files_format_check" CHECK ("format" IN ('md','csv','txt','mermaid')),
    CONSTRAINT "generated_files_status_check" CHECK ("status" IN ('ready','failed'))
);
CREATE INDEX "generated_files_user_idx" ON "generated_files"("userId");
CREATE INDEX "generated_files_conversation_idx" ON "generated_files"("conversationId");
CREATE INDEX "generated_files_message_idx" ON "generated_files"("messageId");
ALTER TABLE "generated_files" ADD CONSTRAINT "generated_files_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_files" ADD CONSTRAINT "generated_files_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "generated_files" ADD CONSTRAINT "generated_files_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "tool_calls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "conversationId" UUID,
    "messageId" UUID,
    "tool" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "args" JSONB,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tool_calls_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tool_calls_kind_check" CHECK ("kind" IN ('read','write','propose')),
    CONSTRAINT "tool_calls_status_check" CHECK ("status" IN ('ok','error','skipped_duplicate','not_configured'))
);
CREATE INDEX "tool_calls_user_idx" ON "tool_calls"("userId");
CREATE INDEX "tool_calls_conversation_idx" ON "tool_calls"("conversationId");
CREATE INDEX "tool_calls_signature_idx" ON "tool_calls"("signature");
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
