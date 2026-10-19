-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'free';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN "description" TEXT,
ADD COLUMN "metadata" JSONB;

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "conversationId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "resultNodeId" UUID,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(6),

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_actions_user_idx" ON "agent_actions"("userId");

-- CreateIndex
CREATE INDEX "agent_actions_conversation_idx" ON "agent_actions"("conversationId");

-- CreateIndex
CREATE INDEX "agent_actions_message_idx" ON "agent_actions"("messageId");

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restricciones que Prisma no puede expresar
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_mode_check" CHECK ("mode" IN ('theory', 'practice', 'free'));
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_status_check" CHECK ("status" IN ('proposed', 'accepted', 'dismissed'));
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_type_check" CHECK ("type" IN ('propose_history_branch'));
